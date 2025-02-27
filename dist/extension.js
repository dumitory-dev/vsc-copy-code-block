"use strict";var v=Object.create;var d=Object.defineProperty;var g=Object.getOwnPropertyDescriptor;var w=Object.getOwnPropertyNames;var h=Object.getPrototypeOf,b=Object.prototype.hasOwnProperty;var x=(e,o)=>{for(var t in o)d(e,t,{get:o[t],enumerable:!0})},p=(e,o,t,i)=>{if(o&&typeof o=="object"||typeof o=="function")for(let n of w(o))!b.call(e,n)&&n!==t&&d(e,n,{get:()=>o[n],enumerable:!(i=g(o,n))||i.enumerable});return e};var f=(e,o,t)=>(t=e!=null?v(h(e)):{},p(o||!e||!e.__esModule?d(t,"default",{value:e,enumerable:!0}):t,e)),C=e=>p(d({},"__esModule",{value:!0}),e);var P={};x(P,{activate:()=>N,deactivate:()=>L});module.exports=C(P);var s=f(require("vscode"));function N(e){console.log("Code Block Copier is now active");let o=s.commands.registerCommand("vsc-code-block-copier.copyCodeBlock",async()=>{let t=s.window.activeTextEditor;if(!t){s.window.showErrorMessage("No active editor found");return}let i=t.document,n=t.selection,c=i.getText(n);if(!c){s.window.showErrorMessage("No text selected");return}let a=i.uri.fsPath,m=s.workspace.asRelativePath(a),l=n.start.line+1,u=k(c,m,l);await s.env.clipboard.writeText(u);let r=c.split(`
`).length;s.window.showInformationMessage(`${r} line${r!==1?"s":""} copied with metadata!`)});e.subscriptions.push(o)}function k(e,o,t){let i=[];i.push(`path: ${o}`);let n=e.split(`
`),a=(t+n.length-1).toString().length,l=n.map((u,r)=>`${(t+r).toString().padStart(a," ")}: ${u}`).join(`
`);return i.push(l),i.join(`
`)}function L(){}0&&(module.exports={activate,deactivate});
