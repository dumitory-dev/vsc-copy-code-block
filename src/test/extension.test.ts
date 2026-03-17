import * as assert from 'assert';
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
});
