import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';

const LARGE_FILE_CHAR_THRESHOLD = 60_000;
const LARGE_FILE_LINE_THRESHOLD = 1_500;
const RENDER_TIMEOUT_MS = 20_000;
const CONFIG_SECTION = 'vsc-code-block-copier';
const SCREENSHOT_OUTPUT_FOLDER_KEY = 'screenshotOutputFolder';
const SCREENSHOT_THEME_KEY = 'screenshotTheme';
const DEFAULT_THEME_ID = 'vscode-dark';

type ScreenshotTheme = {
    label: string;
    description: string;
    background: string;
    border: string;
    headerBackground: string;
    headerText: string;
    codeText: string;
    lineNumber: string;
    hljsStylesheet: string;
};

const SCREENSHOT_THEMES: Record<string, ScreenshotTheme> = {
    'vscode-dark': {
        label: 'VS Code Dark',
        description: 'Default — matches the VS Code editor',
        background: '#1e1e1e',
        border: '#2d2d2d',
        headerBackground: '#252526',
        headerText: '#cccccc',
        codeText: '#d4d4d4',
        lineNumber: '#858585',
        hljsStylesheet: 'vs2015.min.css',
    },
    'vscode-light': {
        label: 'VS Code Light',
        description: 'Clean light theme, good for printed docs',
        background: '#ffffff',
        border: '#e1e4e8',
        headerBackground: '#f3f3f3',
        headerText: '#333333',
        codeText: '#000000',
        lineNumber: '#237893',
        hljsStylesheet: 'vs.min.css',
    },
    'github-dark': {
        label: 'GitHub Dark',
        description: "Matches GitHub's dark mode",
        background: '#0d1117',
        border: '#30363d',
        headerBackground: '#161b22',
        headerText: '#c9d1d9',
        codeText: '#c9d1d9',
        lineNumber: '#6e7681',
        hljsStylesheet: 'github-dark.min.css',
    },
    'github-light': {
        label: 'GitHub Light',
        description: "Matches GitHub's light mode",
        background: '#ffffff',
        border: '#d0d7de',
        headerBackground: '#f6f8fa',
        headerText: '#24292f',
        codeText: '#24292f',
        lineNumber: '#8c959f',
        hljsStylesheet: 'github.min.css',
    },
    'monokai': {
        label: 'Monokai',
        description: 'Classic warm dark theme',
        background: '#272822',
        border: '#3e3d32',
        headerBackground: '#1e1f1c',
        headerText: '#f8f8f2',
        codeText: '#f8f8f2',
        lineNumber: '#75715e',
        hljsStylesheet: 'monokai.min.css',
    },
    'dracula': {
        label: 'Dracula',
        description: 'Popular purple-tinted dark theme',
        background: '#282a36',
        border: '#44475a',
        headerBackground: '#21222c',
        headerText: '#f8f8f2',
        codeText: '#f8f8f2',
        lineNumber: '#6272a4',
        hljsStylesheet: 'base16/dracula.min.css',
    },
    'nord': {
        label: 'Nord',
        description: 'Cool arctic dark theme',
        background: '#2e3440',
        border: '#3b4252',
        headerBackground: '#3b4252',
        headerText: '#eceff4',
        codeText: '#d8dee9',
        lineNumber: '#4c566a',
        hljsStylesheet: 'nord.min.css',
    },
    'solarized-dark': {
        label: 'Solarized Dark',
        description: 'Ethan Schoonover’s low-contrast dark palette',
        background: '#002b36',
        border: '#073642',
        headerBackground: '#073642',
        headerText: '#93a1a1',
        codeText: '#839496',
        lineNumber: '#586e75',
        hljsStylesheet: 'base16/solarized-dark.min.css',
    },
    'solarized-light': {
        label: 'Solarized Light',
        description: 'Ethan Schoonover’s low-contrast light palette',
        background: '#fdf6e3',
        border: '#eee8d5',
        headerBackground: '#eee8d5',
        headerText: '#586e75',
        codeText: '#657b83',
        lineNumber: '#93a1a1',
        hljsStylesheet: 'base16/solarized-light.min.css',
    },
    'one-dark': {
        label: 'Atom One Dark',
        description: 'Atom editor’s dark theme',
        background: '#282c34',
        border: '#3e4451',
        headerBackground: '#21252b',
        headerText: '#abb2bf',
        codeText: '#abb2bf',
        lineNumber: '#5c6370',
        hljsStylesheet: 'atom-one-dark.min.css',
    },
    'one-light': {
        label: 'Atom One Light',
        description: 'Atom editor’s light theme',
        background: '#fafafa',
        border: '#e5e5e6',
        headerBackground: '#eaeaeb',
        headerText: '#383a42',
        codeText: '#383a42',
        lineNumber: '#9d9d9f',
        hljsStylesheet: 'atom-one-light.min.css',
    },
};

function getActiveTheme(): ScreenshotTheme {
    const id = vscode.workspace
        .getConfiguration(CONFIG_SECTION)
        .get<string>(SCREENSHOT_THEME_KEY, DEFAULT_THEME_ID);
    return SCREENSHOT_THEMES[id] ?? SCREENSHOT_THEMES[DEFAULT_THEME_ID];
}

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
        const theme = getActiveTheme();
        const dataUrl = await renderCodeToPngInWebview(normalizedCode, fileName, startLine, languageId, theme);
        const outputFolder = await resolveScreenshotOutputFolder();
        const outputPath = await writePngDataUrlToFile(dataUrl, outputFolder);

        const action = await vscode.window.showInformationMessage(
            `Code screenshot saved: ${outputPath}`,
            'Reveal in Explorer',
            'Open Image',
            'Change Folder…',
        );

        if (action === 'Reveal in Explorer') {
            await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(outputPath));
        } else if (action === 'Open Image') {
            await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(outputPath));
        } else if (action === 'Change Folder…') {
            await setScreenshotOutputFolder();
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown render error';
        vscode.window.showErrorMessage(`Failed to generate screenshot: ${message}`);
    }
}

export async function setScreenshotOutputFolder(): Promise<void> {
    const currentValue = vscode.workspace
        .getConfiguration(CONFIG_SECTION)
        .get<string>(SCREENSHOT_OUTPUT_FOLDER_KEY, '')
        .trim();

    const defaultUri = currentValue && path.isAbsolute(currentValue)
        ? vscode.Uri.file(currentValue)
        : vscode.Uri.file(path.join(os.homedir(), 'Pictures'));

    const picked = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        defaultUri,
        openLabel: 'Use This Folder',
        title: 'Choose where to save code screenshots',
    });

    if (!picked || picked.length === 0) {
        return;
    }

    const folderPath = picked[0].fsPath;
    const target = await pickConfigurationTarget();
    if (target === undefined) {
        return;
    }

    await vscode.workspace
        .getConfiguration(CONFIG_SECTION)
        .update(SCREENSHOT_OUTPUT_FOLDER_KEY, folderPath, target);

    const scopeLabel = target === vscode.ConfigurationTarget.Workspace ? 'workspace' : 'user';
    vscode.window.showInformationMessage(
        `Screenshots will be saved to: ${folderPath} (${scopeLabel} settings)`,
    );
}

export async function openScreenshotThemePicker(): Promise<void> {
    const panel = vscode.window.createWebviewPanel(
        'codeBlockCopierThemePicker',
        'Code Block Copier — Choose Screenshot Theme',
        vscode.ViewColumn.Active,
        { enableScripts: true, retainContextWhenHidden: true },
    );

    const hasWorkspace = !!vscode.workspace.workspaceFolders?.length;
    panel.webview.html = buildThemePickerHtml(getCurrentThemeId(), hasWorkspace);

    panel.webview.onDidReceiveMessage(async (message: unknown) => {
        if (!isPickerMessage(message)) {
            return;
        }

        if (message.type === 'select') {
            if (!SCREENSHOT_THEMES[message.themeId]) {
                return;
            }

            const target = message.scope === 'workspace' && hasWorkspace
                ? vscode.ConfigurationTarget.Workspace
                : vscode.ConfigurationTarget.Global;

            await vscode.workspace
                .getConfiguration(CONFIG_SECTION)
                .update(SCREENSHOT_THEME_KEY, message.themeId, target);

            panel.webview.postMessage({ type: 'saved', themeId: message.themeId, scope: message.scope });
        }
    });
}

function getCurrentThemeId(): string {
    return vscode.workspace
        .getConfiguration(CONFIG_SECTION)
        .get<string>(SCREENSHOT_THEME_KEY, DEFAULT_THEME_ID);
}

type PickerMessage = { type: 'select'; themeId: string; scope: 'user' | 'workspace' };

function isPickerMessage(message: unknown): message is PickerMessage {
    if (!message || typeof message !== 'object') {
        return false;
    }
    const candidate = message as { type?: unknown; themeId?: unknown; scope?: unknown };
    return (
        candidate.type === 'select' &&
        typeof candidate.themeId === 'string' &&
        (candidate.scope === 'user' || candidate.scope === 'workspace')
    );
}

function buildThemePickerHtml(currentThemeId: string, hasWorkspace: boolean): string {
    const cards = Object.entries(SCREENSHOT_THEMES)
        .map(([id, theme]) => renderThemeCard(id, theme, id === currentThemeId))
        .join('\n');

    const workspaceButton = hasWorkspace
        ? `<button type="button" class="scope-btn" data-scope="workspace">Workspace Settings</button>`
        : `<button type="button" class="scope-btn" data-scope="workspace" disabled title="No workspace open">Workspace Settings</button>`;

    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    body {
      margin: 0;
      padding: 24px;
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
    }
    h1 {
      margin: 0 0 6px;
      font-size: 20px;
      font-weight: 600;
    }
    .subtitle {
      margin: 0 0 20px;
      color: var(--vscode-descriptionForeground);
      font-size: 13px;
    }
    .scope {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 20px;
      padding: 12px 14px;
      background: var(--vscode-editorWidget-background);
      border: 1px solid var(--vscode-widget-border, var(--vscode-editorWidget-border, transparent));
      border-radius: 4px;
    }
    .scope-label {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
      margin-right: 4px;
    }
    .scope-btn {
      padding: 4px 12px;
      font-size: 12px;
      border: 1px solid var(--vscode-button-border, transparent);
      border-radius: 3px;
      background: transparent;
      color: var(--vscode-foreground);
      cursor: pointer;
      font-family: inherit;
    }
    .scope-btn:hover:not(:disabled) {
      background: var(--vscode-toolbar-hoverBackground);
    }
    .scope-btn.active {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border-color: var(--vscode-button-background);
    }
    .scope-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 14px;
    }
    .card {
      position: relative;
      display: block;
      cursor: pointer;
      border: 2px solid transparent;
      border-radius: 6px;
      padding: 10px;
      background: var(--vscode-editorWidget-background);
      transition: border-color 0.15s, transform 0.05s;
    }
    .card:hover {
      border-color: var(--vscode-focusBorder);
    }
    .card:active {
      transform: scale(0.99);
    }
    .card.selected {
      border-color: var(--vscode-focusBorder);
      box-shadow: 0 0 0 1px var(--vscode-focusBorder);
    }
    .card input[type="radio"] {
      position: absolute;
      opacity: 0;
      pointer-events: none;
    }
    .card-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
    }
    .radio-dot {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      border: 2px solid var(--vscode-input-border, var(--vscode-foreground));
      flex-shrink: 0;
      position: relative;
    }
    .card.selected .radio-dot {
      border-color: var(--vscode-focusBorder);
    }
    .card.selected .radio-dot::after {
      content: '';
      position: absolute;
      top: 2px;
      left: 2px;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--vscode-focusBorder);
    }
    .name-block {
      flex: 1;
      margin-left: 10px;
    }
    .name {
      font-size: 13px;
      font-weight: 600;
      line-height: 1.2;
    }
    .desc {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      margin-top: 2px;
      line-height: 1.3;
    }
    .saved-tag {
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 8px;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      opacity: 0;
      transition: opacity 0.2s;
    }
    .card.just-saved .saved-tag {
      opacity: 1;
    }
    .preview {
      border: 1px solid var(--preview-border);
      border-radius: 3px;
      overflow: hidden;
      font-family: Consolas, "Courier New", monospace;
    }
    .preview-header {
      padding: 4px 8px;
      font-size: 10px;
      border-bottom: 1px solid var(--preview-border);
    }
    .preview-code {
      display: grid;
      grid-template-columns: auto 1fr;
      column-gap: 10px;
      padding: 6px 10px;
      font-size: 11px;
      line-height: 1.5;
    }
    .preview-ln { text-align: right; }
    .swatches {
      display: flex;
      gap: 4px;
      margin-top: 8px;
    }
    .swatch {
      width: 14px;
      height: 14px;
      border-radius: 3px;
      border: 1px solid var(--vscode-widget-border, transparent);
    }
  </style>
</head>
<body>
  <h1>Choose Screenshot Theme</h1>
  <p class="subtitle">Pick a color palette for generated code screenshots. Selection saves automatically.</p>

  <div class="scope">
    <span class="scope-label">Save to:</span>
    <button type="button" class="scope-btn active" data-scope="user">User Settings</button>
    ${workspaceButton}
  </div>

  <div class="grid">
${cards}
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    let scope = 'user';

    document.querySelectorAll('.scope-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        document.querySelectorAll('.scope-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        scope = btn.dataset.scope;
      });
    });

    document.querySelectorAll('.card').forEach(card => {
      card.addEventListener('click', () => {
        const themeId = card.dataset.themeId;
        document.querySelectorAll('.card').forEach(c => c.classList.remove('selected', 'just-saved'));
        card.classList.add('selected');
        vscode.postMessage({ type: 'select', themeId, scope });
      });
    });

    window.addEventListener('message', event => {
      const msg = event.data;
      if (msg && msg.type === 'saved') {
        const card = document.querySelector('.card[data-theme-id="' + msg.themeId + '"]');
        if (!card) return;
        card.classList.add('just-saved');
        setTimeout(() => card.classList.remove('just-saved'), 1500);
      }
    });
  </script>
</body>
</html>`;
}

function renderThemeCard(id: string, theme: ScreenshotTheme, isCurrent: boolean): string {
    const selectedClass = isCurrent ? ' selected' : '';
    const checked = isCurrent ? ' checked' : '';

    return `    <div class="card${selectedClass}" data-theme-id="${id}" style="--preview-border: ${theme.border};">
      <input type="radio" name="theme" value="${id}"${checked} />
      <div class="card-head">
        <div class="radio-dot"></div>
        <div class="name-block">
          <div class="name">${escapeHtml(theme.label)}</div>
          <div class="desc">${escapeHtml(theme.description)}</div>
        </div>
        <span class="saved-tag">Saved ✓</span>
      </div>
      <div class="preview" style="background: ${theme.background};">
        <div class="preview-header" style="background: ${theme.headerBackground}; color: ${theme.headerText};">example.ts</div>
        <div class="preview-code">
          <span class="preview-ln" style="color: ${theme.lineNumber};">1</span>
          <span style="color: ${theme.codeText};">function hello() {</span>
          <span class="preview-ln" style="color: ${theme.lineNumber};">2</span>
          <span style="color: ${theme.codeText};">  return "hi";</span>
          <span class="preview-ln" style="color: ${theme.lineNumber};">3</span>
          <span style="color: ${theme.codeText};">}</span>
        </div>
      </div>
      <div class="swatches">
        <div class="swatch" style="background: ${theme.background};" title="Background"></div>
        <div class="swatch" style="background: ${theme.headerBackground};" title="Header"></div>
        <div class="swatch" style="background: ${theme.codeText};" title="Code text"></div>
        <div class="swatch" style="background: ${theme.lineNumber};" title="Line numbers"></div>
        <div class="swatch" style="background: ${theme.border};" title="Border"></div>
      </div>
    </div>`;
}

async function pickConfigurationTarget(): Promise<vscode.ConfigurationTarget | undefined> {
    const hasWorkspace = !!vscode.workspace.workspaceFolders?.length;
    if (!hasWorkspace) {
        return vscode.ConfigurationTarget.Global;
    }

    const choice = await vscode.window.showQuickPick(
        [
            {
                label: 'User Settings',
                description: 'Apply to all projects',
                target: vscode.ConfigurationTarget.Global,
            },
            {
                label: 'Workspace Settings',
                description: 'Apply only to this project',
                target: vscode.ConfigurationTarget.Workspace,
            },
        ],
        { placeHolder: 'Where should this folder setting be saved?' },
    );

    return choice?.target;
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
    theme: ScreenshotTheme,
): Promise<string> {
    const panel = vscode.window.createWebviewPanel(
        'copyCodeBlockScreenshot',
        'Generating Code Screenshot',
        { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
        { enableScripts: true },
    );

    panel.webview.html = buildRenderHtml(code, fileName, startLine, languageId, theme);

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

function buildRenderHtml(
    code: string,
    fileName: string,
    startLine: number,
    languageId: string,
    theme: ScreenshotTheme,
): string {
    const escapedFileName = escapeHtml(fileName);
    const codeJson = JSON.stringify(code);
    const languageJson = JSON.stringify(languageId);
    const stylesheetUrl = `https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/${theme.hljsStylesheet}`;
    const backgroundJson = JSON.stringify(theme.background);

    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="stylesheet" href="${stylesheetUrl}" />
  <style>
    body {
      margin: 0;
      background: ${theme.background};
      display: flex;
      justify-content: center;
      align-items: flex-start;
      padding: 0;
      font-family: Consolas, "Courier New", monospace;
    }
    .card {
      width: max-content;
      border-radius: 0;
      background: ${theme.background};
      border: 1px solid ${theme.border};
      overflow: visible;
    }
    .header {
      background: ${theme.headerBackground};
      color: ${theme.headerText};
      padding: 8px 12px;
      border-bottom: 1px solid ${theme.border};
      font-size: 12px;
    }
    .code {
      margin: 0;
      color: ${theme.codeText};
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
      color: ${theme.lineNumber};
      user-select: none;
    }
    .line-code {
      color: ${theme.codeText};
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
    const backgroundColor = ${backgroundJson};

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
          backgroundColor,
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
