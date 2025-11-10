"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = require("vscode");
function activate(context) {
    console.log('Code Block Copier is now active');
    // Register the command to copy code block with metadata (overwrite clipboard)
    let disposable = vscode.commands.registerCommand('vsc-code-block-copier.copyCodeBlock', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor found');
            return;
        }
        const document = editor.document;
        const selection = editor.selection;
        // If no selection, use the entire document
        const range = selection && !selection.isEmpty
            ? new vscode.Range(selection.start, selection.end)
            : new vscode.Range(new vscode.Position(0, 0), new vscode.Position(document.lineCount - 1, document.lineAt(document.lineCount - 1).range.end.character));
        const selectedText = document.getText(range);
        if (!selectedText) {
            vscode.window.showErrorMessage('No text to copy');
            return;
        }
        const filePath = document.uri.fsPath;
        const relativePath = vscode.workspace.asRelativePath(filePath);
        // Start at selection start (1-based) or 1 if whole file
        const startLine = (selection && !selection.isEmpty ? selection.start.line : 0) + 1;
        const output = makeCodeBlock(selectedText, relativePath, startLine);
        await vscode.env.clipboard.writeText(output);
        const lineCount = selectedText.split('\n').length;
        vscode.window.showInformationMessage(`${lineCount} line${lineCount !== 1 ? 's' : ''} copied with metadata!`);
    });
    // Register a second command to append to the clipboard instead of overwriting
    let disposableAppend = vscode.commands.registerCommand('vsc-code-block-copier.copyCodeBlockAppend', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor found');
            return;
        }
        const document = editor.document;
        const selection = editor.selection;
        // If no selection, use the entire document
        const range = selection && !selection.isEmpty
            ? new vscode.Range(selection.start, selection.end)
            : new vscode.Range(new vscode.Position(0, 0), new vscode.Position(document.lineCount - 1, document.lineAt(document.lineCount - 1).range.end.character));
        const selectedText = document.getText(range);
        if (!selectedText) {
            vscode.window.showErrorMessage('No text to copy');
            return;
        }
        const filePath = document.uri.fsPath;
        const relativePath = vscode.workspace.asRelativePath(filePath);
        const startLine = (selection && !selection.isEmpty ? selection.start.line : 0) + 1;
        const output = makeCodeBlock(selectedText, relativePath, startLine);
        const existing = await vscode.env.clipboard.readText();
        // Prepend two newlines before existing clipboard content
        await vscode.env.clipboard.writeText(existing ? `${output}\n\n${existing}` : output);
        const lineCount = selectedText.split('\n').length;
        vscode.window.showInformationMessage(`${lineCount} line${lineCount !== 1 ? 's' : ''} appended to clipboard with metadata!`);
    });
    // Register disposables
    context.subscriptions.push(disposable, disposableAppend);
}
function makeCodeBlock(code, filePath, startLine) {
    const lines = [];
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
function deactivate() {
}
//# sourceMappingURL=extension.js.map