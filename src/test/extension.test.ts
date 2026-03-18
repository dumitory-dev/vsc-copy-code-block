import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
    test('extension should be present', () => {
        const extension = vscode.extensions.getExtension('dumitory-dev.vsc-code-block-copier');
        assert.ok(extension);
    });

    test('copyCodeBlock command should be registered', async () => {
        const commands = await vscode.commands.getCommands(true);
        assert.ok(commands.includes('vsc-code-block-copier.copyCodeBlock'));
    });

    test('copyCodeBlockAppend command should be registered', async () => {
        const commands = await vscode.commands.getCommands(true);
        assert.ok(commands.includes('vsc-code-block-copier.copyCodeBlockAppend'));
    });

    test('copyCodeBlockMarkdown command should be registered', async () => {
        const commands = await vscode.commands.getCommands(true);
        assert.ok(commands.includes('vsc-code-block-copier.copyCodeBlockMarkdown'));
    });

    test('copyCodeBlockMarkdownAppend command should be registered', async () => {
        const commands = await vscode.commands.getCommands(true);
        assert.ok(commands.includes('vsc-code-block-copier.copyCodeBlockMarkdownAppend'));
    });

    test('copyCodeBlock copies entire file when no text is selected', async () => {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        assert.ok(workspaceFolder);

        const fileUri = vscode.Uri.joinPath(
            workspaceFolder.uri,
            path.join('.tmp', 'copy-whole-file.ts')
        );

        await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(workspaceFolder.uri, '.tmp'));
        await vscode.workspace.fs.writeFile(
            fileUri,
            Buffer.from('const a = 1;\nconst b = 2;', 'utf8')
        );

        const doc = await vscode.workspace.openTextDocument(fileUri);
        const editor = await vscode.window.showTextDocument(doc);

        editor.selection = new vscode.Selection(0, 0, 0, 0);

        await vscode.commands.executeCommand('vsc-code-block-copier.copyCodeBlock');

        const clipboard = await vscode.env.clipboard.readText();
        assert.strictEqual(
            clipboard,
            [
                `path: ${vscode.workspace.asRelativePath(doc.uri.fsPath)}`,
                '1: const a = 1;',
                '2: const b = 2;',
            ].join('\n')
        );
    });



    test('copyCodeBlockMarkdown copies fenced markdown with language when known', async () => {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        assert.ok(workspaceFolder);

        const fileUri = vscode.Uri.joinPath(
            workspaceFolder.uri,
            path.join('.tmp', 'copy-markdown.json')
        );

        await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(workspaceFolder.uri, '.tmp'));
        await vscode.workspace.fs.writeFile(
            fileUri,
            Buffer.from('{\n  "firstName": "John"\n}', 'utf8')
        );

        const doc = await vscode.workspace.openTextDocument(fileUri);
        const editor = await vscode.window.showTextDocument(doc);
        editor.selection = new vscode.Selection(0, 0, 0, 0);

        await vscode.commands.executeCommand('vsc-code-block-copier.copyCodeBlockMarkdown');

        const clipboard = await vscode.env.clipboard.readText();
        assert.strictEqual(
            clipboard,
            [
                `path: ${vscode.workspace.asRelativePath(doc.uri.fsPath)}`,
                '```json',
                '{',
                '  "firstName": "John"',
                '}',
                '```',
            ].join('\n')
        );
    });

    test('copyCodeBlockAppend appends snippet to existing clipboard with separator', async () => {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        assert.ok(workspaceFolder);

        const fileUri = vscode.Uri.joinPath(
            workspaceFolder.uri,
            path.join('.tmp', 'copy-append.ts')
        );

        await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(workspaceFolder.uri, '.tmp'));
        await vscode.workspace.fs.writeFile(
            fileUri,
            Buffer.from('const append = true;', 'utf8')
        );

        const doc = await vscode.workspace.openTextDocument(fileUri);
        const editor = await vscode.window.showTextDocument(doc);
        editor.selection = new vscode.Selection(0, 0, 0, 0);

        await vscode.env.clipboard.writeText('previous clipboard text');
        await vscode.commands.executeCommand('vsc-code-block-copier.copyCodeBlockAppend');

        const clipboard = await vscode.env.clipboard.readText();
        const expectedSnippet = [
            `path: ${vscode.workspace.asRelativePath(doc.uri.fsPath)}`,
            '1: const append = true;',
        ].join('\n');

        assert.strictEqual(
            clipboard,
            ['previous clipboard text', expectedSnippet].join('\n\n')
        );
    });
});
