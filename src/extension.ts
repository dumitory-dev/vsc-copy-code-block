import * as vscode from 'vscode';
import { makeCodeBlock } from './codeBlock';

const COPY_CODE_BLOCK_COMMAND = 'vsc-code-block-copier.copyCodeBlock';

export function activate(context: vscode.ExtensionContext) {
    console.log('Code Block Copier is now active');

    const disposable = vscode.commands.registerCommand(COPY_CODE_BLOCK_COMMAND, async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor found');
            return;
        }

        const document = editor.document;
        const selection = editor.selection;
        const selectedText = document.getText(selection);
        if (!selectedText) {
            vscode.window.showErrorMessage('No text selected');
            return;
        }

        const filePath = document.uri.fsPath;
        const relativePath = vscode.workspace.asRelativePath(filePath);
        const startLine = selection.start.line + 1; // VS Code lines are 0-based, display as 1-based

        const output = makeCodeBlock(selectedText, relativePath, startLine);
        await vscode.env.clipboard.writeText(output);

        const lineCount = selectedText.split('\n').length;
        vscode.window.showInformationMessage(
            `${lineCount} line${lineCount !== 1 ? 's' : ''} copied with metadata!`
        );
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {}
