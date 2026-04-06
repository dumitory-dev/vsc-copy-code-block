import * as vscode from 'vscode';
import { makeCodeBlock, makeMarkdownCodeBlock } from './codeBlock';
import { appendToClipboard } from './clipboard';
import { generateCodeScreenshot } from './screenshot';

const COPY_CODE_BLOCK_COMMAND = 'vsc-code-block-copier.copyCodeBlock';
const COPY_CODE_BLOCK_APPEND_COMMAND = 'vsc-code-block-copier.copyCodeBlockAppend';
const COPY_CODE_BLOCK_MARKDOWN_COMMAND = 'vsc-code-block-copier.copyCodeBlockMarkdown';
const COPY_CODE_BLOCK_MARKDOWN_APPEND_COMMAND = 'vsc-code-block-copier.copyCodeBlockMarkdownAppend';
const GENERATE_SCREENSHOT_COMMAND = 'copyCodeBlock.generateScreenshot';

type CopyFormat = 'lineNumbers' | 'markdown';

async function copyCodeBlock({ append, format }: { append: boolean; format: CopyFormat }) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showErrorMessage('No active editor found');
        return;
    }

    const document = editor.document;
    const selection = editor.selection;
    const hasSelection = !selection.isEmpty;
    const selectedText = hasSelection
        ? document.getText(selection)
        : document.getText();
    const normalizedText = normalizeLineEndings(selectedText);

    const filePath = document.uri.fsPath;
    const relativePath = vscode.workspace.asRelativePath(filePath);
    const startLine = hasSelection
        ? selection.start.line + 1
        : 1; // VS Code lines are 0-based, display as 1-based

    const output = normalizedText
        ? format === 'markdown'
            ? makeMarkdownCodeBlock(normalizedText, relativePath)
            : makeCodeBlock(normalizedText, relativePath, startLine)
        : `path: ${relativePath}`;

    if (append) {
        const existingClipboard = await vscode.env.clipboard.readText();
        const appendedOutput = appendToClipboard(existingClipboard, output);
        await vscode.env.clipboard.writeText(appendedOutput);
    } else {
        await vscode.env.clipboard.writeText(output);
    }

    const lineCount = normalizedText ? normalizedText.split('\n').length : 0;
    vscode.window.showInformationMessage(
        `${lineCount} line${lineCount !== 1 ? 's' : ''} copied with metadata${append ? ' (appended to clipboard)' : ''}!`
    );
}

export function activate(context: vscode.ExtensionContext) {
    console.log('Code Block Copier is now active');

    const disposable = vscode.commands.registerCommand(COPY_CODE_BLOCK_COMMAND, async () => {
        await copyCodeBlock({ append: false, format: 'lineNumbers' });
    });

    const appendDisposable = vscode.commands.registerCommand(COPY_CODE_BLOCK_APPEND_COMMAND, async () => {
        await copyCodeBlock({ append: true, format: 'lineNumbers' });
    });

    const markdownDisposable = vscode.commands.registerCommand(COPY_CODE_BLOCK_MARKDOWN_COMMAND, async () => {
        await copyCodeBlock({ append: false, format: 'markdown' });
    });

    const markdownAppendDisposable = vscode.commands.registerCommand(COPY_CODE_BLOCK_MARKDOWN_APPEND_COMMAND, async () => {
        await copyCodeBlock({ append: true, format: 'markdown' });
    });

    const screenshotDisposable = vscode.commands.registerCommand(GENERATE_SCREENSHOT_COMMAND, async () => {
        await generateCodeScreenshot();
    });

    context.subscriptions.push(disposable);
    context.subscriptions.push(appendDisposable);
    context.subscriptions.push(markdownDisposable);
    context.subscriptions.push(markdownAppendDisposable);
    context.subscriptions.push(screenshotDisposable);
}

export function deactivate() {}

function normalizeLineEndings(value: string): string {
    return value.replace(/\r\n?/g, '\n');
}
