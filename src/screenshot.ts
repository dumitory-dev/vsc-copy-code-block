import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';

const LARGE_FILE_CHAR_THRESHOLD = 60_000;
const LARGE_FILE_LINE_THRESHOLD = 1_500;
const RENDER_TIMEOUT_MS = 20_000;
const CONFIG_SECTION = 'vsc-code-block-copier';
const SCREENSHOT_OUTPUT_FOLDER_KEY = 'screenshotOutputFolder';

export async function generateCodeScreenshot(): Promise<void> {
    const editor = vscode.window.activeTextEditor;

    if (!editor) {
        vscode.window.showErrorMessage('No active editor found. Open a file and try again.');
        return;
    }

    const selection = editor.selection;
    const hasSelection = !selection.isEmpty;
    const code = hasSelection ? editor.document.getText(selection) : editor.document.getText();
    const normalizedCode = normalizeLineEndings(code);
    const startLine = hasSelection ? selection.start.line + 1 : 1;
    const languageId = editor.document.languageId;

    if (!normalizedCode.trim()) {
        vscode.window.showErrorMessage('No code to render. Select some code or use a non-empty file.');
        return;
    }

    const shouldContinue = await confirmLargeRender(normalizedCode);
    if (!shouldContinue) {
        return;
    }

    const fileName = path.basename(editor.document.fileName || 'untitled');

    try {
        const dataUrl = await renderCodeToPngInWebview(normalizedCode, fileName, startLine, languageId);
        const outputFolder = await resolveScreenshotOutputFolder();
        const outputPath = await writePngDataUrlToFile(dataUrl, outputFolder);

        vscode.window.showInformationMessage(`Code screenshot saved: ${outputPath}`);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown render error';
        vscode.window.showErrorMessage(`Failed to generate screenshot: ${message}`);
    }
}

async function confirmLargeRender(code: string): Promise<boolean> {
    const lineCount = code.split('\n').length;
    const isLarge = code.length > LARGE_FILE_CHAR_THRESHOLD || lineCount > LARGE_FILE_LINE_THRESHOLD;

    if (!isLarge) {
        return true;
    }

    const result = await vscode.window.showWarningMessage(
        `This is a large snippet (${lineCount} lines). Rendering may take longer. Continue?`,
        { modal: true },
        'Continue',
    );

    return result === 'Continue';
}

async function renderCodeToPngInWebview(
    code: string,
    fileName: string,
    startLine: number,
    languageId: string,
): Promise<string> {
    const panel = vscode.window.createWebviewPanel(
        'copyCodeBlockScreenshot',
        'Generating Code Screenshot',
        { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
        { enableScripts: true },
    );

    panel.webview.html = buildRenderHtml(code, fileName, startLine, languageId);

    return await new Promise<string>((resolve, reject) => {
        let settled = false;
        let panelDisposed = false;

        const finish = (result: { ok: true; dataUrl: string } | { ok: false; error: Error }) => {
            if (settled) {
                return;
            }

            settled = true;
            clearTimeout(timeout);
            messageDisposable.dispose();
            disposeDisposable.dispose();

            if (!panelDisposed) {
                panel.dispose();
            }

            if (result.ok) {
                resolve(result.dataUrl);
            } else {
                reject(result.error);
            }
        };

        const timeout = setTimeout(() => {
            finish({ ok: false, error: new Error('Timed out while rendering screenshot.') });
        }, RENDER_TIMEOUT_MS);

        const messageDisposable = panel.webview.onDidReceiveMessage((message: unknown) => {
            if (!isRenderMessage(message)) {
                return;
            }

            if (message.type === 'render:success') {
                finish({ ok: true, dataUrl: message.dataUrl });
                return;
            }

            finish({ ok: false, error: new Error(message.error || 'Rendering failed in webview.') });
        });

        const disposeDisposable = panel.onDidDispose(() => {
            panelDisposed = true;
            if (settled) {
                return;
            }

            settled = true;
            clearTimeout(timeout);
            messageDisposable.dispose();
            disposeDisposable.dispose();
            reject(new Error('Render view closed before completion.'));
        });
    });
}

type RenderMessage =
    | { type: 'render:success'; dataUrl: string }
    | { type: 'render:error'; error?: string };

function isRenderMessage(message: unknown): message is RenderMessage {
    if (!message || typeof message !== 'object') {
        return false;
    }

    const candidate = message as { type?: unknown };
    return candidate.type === 'render:success' || candidate.type === 'render:error';
}

function buildRenderHtml(code: string, fileName: string, startLine: number, languageId: string): string {
    const escapedFileName = escapeHtml(fileName);
    const codeJson = JSON.stringify(code);
    const languageJson = JSON.stringify(languageId);

    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/vs2015.min.css" />
  <style>
    :root { color-scheme: dark; }
    body {
      margin: 0;
      background: #1e1e1e;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      padding: 0;
      font-family: Consolas, "Courier New", monospace;
    }
    .card {
      width: max-content;
      border-radius: 0;
      background: #1e1e1e;
      border: 1px solid #2d2d2d;
      overflow: visible;
    }
    .header {
      background: #252526;
      color: #cccccc;
      padding: 8px 12px;
      border-bottom: 1px solid #2d2d2d;
      font-size: 12px;
    }
    .code {
      margin: 0;
      color: #d4d4d4;
      background: transparent;
      font-size: 14px;
      line-height: 1.45;
      padding: 12px 16px;
      white-space: pre;
      tab-size: 4;
      overflow: visible;
      display: grid;
      grid-template-columns: auto 1fr;
      column-gap: 14px;
    }
    .line-number {
      text-align: right;
      color: #858585;
      user-select: none;
    }
    .line-code {
      color: #d4d4d4;
    }
    .line-code .hljs {
      color: inherit;
      background: transparent;
      padding: 0;
      display: inline;
    }
  </style>
</head>
<body>
  <div id="capture" class="card">
    <div class="header">${escapedFileName}</div>
    <div id="code" class="code"></div>
  </div>

  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/highlight.min.js"></script>
  <script src="https://unpkg.com/html-to-image@1.11.13/dist/html-to-image.js"></script>
  <script>
    const vscode = acquireVsCodeApi();
    const rawCode = ${codeJson};
    const startLine = ${startLine};
    const languageId = ${languageJson};

    function escapeHtml(value) {
      return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function renderCodeRows() {
      const container = document.getElementById('code');
      if (!container) {
        throw new Error('Code container not found.');
      }

      const lines = rawCode.split('\\n');
      const supportsLang = !!(window.hljs && window.hljs.getLanguage(languageId));

      const rows = lines.map((line, index) => {
        const lineNumber = startLine + index;
        const lineContent = line.length === 0 ? ' ' : line;
        const highlighted = supportsLang
          ? window.hljs.highlight(lineContent, { language: languageId, ignoreIllegals: true }).value
          : escapeHtml(lineContent);

        return '<span class=\"line-number\">' + lineNumber + '</span><span class=\"line-code\"><span class=\"hljs\">' + highlighted + '</span></span>';
      }).join('');

      container.innerHTML = rows;
    }

    async function render() {
      try {
        renderCodeRows();
        const node = document.getElementById('capture');
        if (!node || !window.htmlToImage || !window.htmlToImage.toPng) {
          throw new Error('html-to-image did not load.');
        }

        const width = node.scrollWidth;
        const height = node.scrollHeight;

        const dataUrl = await window.htmlToImage.toPng(node, {
          backgroundColor: '#1e1e1e',
          pixelRatio: 2,
          width,
          height,
          skipAutoScale: true,
        });

        vscode.postMessage({ type: 'render:success', dataUrl });
      } catch (error) {
        vscode.postMessage({
          type: 'render:error',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    render();
  </script>
</body>
</html>`;
}

async function resolveScreenshotOutputFolder(): Promise<string> {
    const configuredFolderRaw = vscode.workspace
        .getConfiguration(CONFIG_SECTION)
        .get<string>(SCREENSHOT_OUTPUT_FOLDER_KEY, '')
        .trim();

    let outputFolder: string;
    if (!configuredFolderRaw) {
        outputFolder = path.join(os.homedir(), 'Pictures', 'vsc-code-block-copier');
    } else if (path.isAbsolute(configuredFolderRaw)) {
        outputFolder = configuredFolderRaw;
    } else {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        outputFolder = workspaceRoot
            ? path.resolve(workspaceRoot, configuredFolderRaw)
            : path.resolve(configuredFolderRaw);
    }

    await fs.mkdir(outputFolder, { recursive: true });
    return outputFolder;
}

async function writePngDataUrlToFile(dataUrl: string, outputFolder: string): Promise<string> {
    const prefix = 'data:image/png;base64,';
    if (!dataUrl.startsWith(prefix)) {
        throw new Error('Renderer returned invalid PNG data.');
    }

    const pngBytes = Buffer.from(dataUrl.slice(prefix.length), 'base64');
    const fileName = `code-screenshot-${Date.now()}.png`;
    const outputPath = path.join(outputFolder, fileName);

    await fs.writeFile(outputPath, pngBytes);
    return outputPath;
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function normalizeLineEndings(value: string): string {
    return value.replace(/\r\n?/g, '\n');
}
