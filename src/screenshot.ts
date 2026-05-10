import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { renderCodeToPngDataUrl } from './screenshot/nodeRenderer';
import { buildThemePickerHtml, isPickerMessage } from './screenshot/themePicker';
import { DEFAULT_THEME_ID, getScreenshotTheme, SCREENSHOT_THEMES, type ScreenshotTheme } from './screenshot/theme';

const LARGE_FILE_CHAR_THRESHOLD = 60_000;
const LARGE_FILE_LINE_THRESHOLD = 1_500;
const CONFIG_SECTION = 'vsc-code-block-copier';
const SCREENSHOT_OUTPUT_FOLDER_KEY = 'screenshotOutputFolder';
const SCREENSHOT_THEME_KEY = 'screenshotTheme';

function getActiveTheme(): ScreenshotTheme {
    const id = vscode.workspace
        .getConfiguration(CONFIG_SECTION)
        .get<string>(SCREENSHOT_THEME_KEY, DEFAULT_THEME_ID);
    return getScreenshotTheme(id);
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
        const dataUrl = await renderCodeToPngDataUrl(normalizedCode, fileName, startLine, languageId, theme);
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
    });
}

function getCurrentThemeId(): string {
    return vscode.workspace
        .getConfiguration(CONFIG_SECTION)
        .get<string>(SCREENSHOT_THEME_KEY, DEFAULT_THEME_ID);
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

function normalizeLineEndings(value: string): string {
    return value.replace(/\r\n?/g, '\n');
}
