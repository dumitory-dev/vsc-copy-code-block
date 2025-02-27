import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    console.log('Code Block Copier is now active');

    // Register the command to copy code block with metadata
    let disposable = vscode.commands.registerCommand('vsc-code-block-copier.copyCodeBlock', async () => {
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
        const startLine = selection.start.line + 1; // 1-based line numbers

        const output = makeCodeBlock(
            selectedText,
            relativePath,
            startLine,
        );

        await vscode.env.clipboard.writeText(output);

        const lineCount = selectedText.split('\n').length;
        vscode.window.showInformationMessage(
            `${lineCount} line${lineCount !== 1 ? 's' : ''} copied with metadata!`
        );
    });

    // Register a command to configure formatting options
    context.subscriptions.push(disposable);
}

function makeCodeBlock(
    code: string,
    filePath: string,
    startLine: number,
): string {
    const lines: string[] = [];
    lines.push(`path: ${filePath}`);
    const codeLines = code.split('\n');
    const maxLineNumber = startLine + codeLines.length - 1;
    const maxPadding = maxLineNumber.toString().length;
    const lineNumberedCode = codeLines.map((line, index) => {
        const lineNumber = startLine + index;
        const paddedLineNumber = lineNumber.toString().padStart(maxPadding, ' ');
        return `${paddedLineNumber}: ${line}`;
    });
    const processedCode = lineNumberedCode.join('\n');
    lines.push(processedCode);
    return lines.join('\n');
}

export function deactivate() {
}