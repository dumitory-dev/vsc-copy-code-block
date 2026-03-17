"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/extension.ts
var extension_exports = {};
__export(extension_exports, {
  activate: () => activate,
  deactivate: () => deactivate
});
module.exports = __toCommonJS(extension_exports);
var vscode = __toESM(require("vscode"));

// src/codeBlock.ts
function makeCodeBlock(code, filePath, startLine) {
  const codeLines = code.split("\n");
  const maxLineNumber = startLine + codeLines.length - 1;
  const maxPadding = maxLineNumber.toString().length;
  const lineNumberedCode = codeLines.map((line, index) => {
    const lineNumber = startLine + index;
    const paddedLineNumber = lineNumber.toString().padStart(maxPadding, " ");
    return `${paddedLineNumber}: ${line}`;
  });
  return [`path: ${filePath}`, lineNumberedCode.join("\n")].join("\n");
}

// src/extension.ts
var COPY_CODE_BLOCK_COMMAND = "vsc-code-block-copier.copyCodeBlock";
function activate(context) {
  console.log("Code Block Copier is now active");
  const disposable = vscode.commands.registerCommand(COPY_CODE_BLOCK_COMMAND, async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage("No active editor found");
      return;
    }
    const document = editor.document;
    const selection = editor.selection;
    const selectedText = document.getText(selection);
    if (!selectedText) {
      vscode.window.showErrorMessage("No text selected");
      return;
    }
    const filePath = document.uri.fsPath;
    const relativePath = vscode.workspace.asRelativePath(filePath);
    const startLine = selection.start.line + 1;
    const output = makeCodeBlock(selectedText, relativePath, startLine);
    await vscode.env.clipboard.writeText(output);
    const lineCount = selectedText.split("\n").length;
    vscode.window.showInformationMessage(
      `${lineCount} line${lineCount !== 1 ? "s" : ""} copied with metadata!`
    );
  });
  context.subscriptions.push(disposable);
}
function deactivate() {
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate,
  deactivate
});
//# sourceMappingURL=extension.js.map
