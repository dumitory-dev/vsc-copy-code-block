import * as vscode from 'vscode';
import { makeCodeBlock } from './codeBlock';
import { appendToClipboard } from './clipboard';

const COPY_CODE_BLOCK_COMMAND = 'vsc-code-block-copier.copyCodeBlock';
const COPY_CODE_BLOCK_APPEND_COMMAND = 'vsc-code-block-copier.copyCodeBlockAppend';

async function copyCodeBlock({ append }: { append: boolean }) {
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

    const filePath = document.uri.fsPath;
    const relativePath = vscode.workspace.asRelativePath(filePath);
    const startLine = hasSelection
        ? selection.start.line + 1
        : 1; // VS Code lines are 0-based, display as 1-based

    const output = selectedText
        ? makeCodeBlock(selectedText, relativePath, startLine)
        : `path: ${relativePath}`;

    if (append) {
        const existingClipboard = await vscode.env.clipboard.readText();
        const appendedOutput = appendToClipboard(existingClipboard, output);
        await vscode.env.clipboard.writeText(appendedOutput);
    } else {
        await vscode.env.clipboard.writeText(output);
    }

    const lineCount = selectedText ? selectedText.split('\n').length : 0;
    vscode.window.showInformationMessage(
        `${lineCount} line${lineCount !== 1 ? 's' : ''} copied with metadata${append ? ' (appended to clipboard)' : ''}!`
    );
}

export function activate(context: vscode.ExtensionContext) {
    console.log('Code Block Copier is now active');

    const disposable = vscode.commands.registerCommand(COPY_CODE_BLOCK_COMMAND, async () => {
        await copyCodeBlock({ append: false });
    });

    const appendDisposable = vscode.commands.registerCommand(COPY_CODE_BLOCK_APPEND_COMMAND, async () => {
        await copyCodeBlock({ append: true });
    });

    context.subscriptions.push(disposable);
    context.subscriptions.push(appendDisposable);
}

export function deactivate() {}
