import * as vscode from 'vscode';
import { TestRun } from '../model/types';

export type ResultsPanelMessage =
  | { type: 'running'; sampleCount: number }
  | { type: 'live'; summary: { total: number; passed: number; failed: number } }
  | { type: 'results'; run: TestRun }
  | { type: 'plan'; path: string }
  | { type: 'clear' };

export class ResultsPanel {
  private panel: vscode.WebviewPanel | undefined;
  private pendingMessage: ResultsPanelMessage | undefined;
  private readonly _onDidReceiveMessage = new vscode.EventEmitter<any>();
  public readonly onDidReceiveMessage = this._onDidReceiveMessage.event;

  constructor() {}

  public createOrShow(): void {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.Beside);
      return;
    }

    const panel = vscode.window.createWebviewPanel('jmeterResults', 'JMeter Results', vscode.ViewColumn.Beside, {
      enableScripts: true
    });
    panel.webview.onDidReceiveMessage((message) => this._onDidReceiveMessage.fire(message));
    panel.onDidDispose(() => {
      this.panel = undefined;
    });
    panel.webview.html = this.getHtml();
    this.panel = panel;

    if (this.pendingMessage) {
      this.postMessage(this.pendingMessage);
      this.pendingMessage = undefined;
    }
  }

  public clear(): void {
    if (this.panel) {
      this.panel.webview.html = this.getHtml();
    }
  }

  public dispose(): void {
    this.panel?.dispose();
  }

  public postMessage(message: ResultsPanelMessage): void {
    if (!this.panel) {
      this.pendingMessage = message;
      return;
    }
    this.panel.webview.postMessage(message);
  }

  private getHtml(): string {
    const script = [
      "const vscode = acquireVsCodeApi();",
      "let currentRun = null;",
      "function updateStatus(statusText) {",
      "  document.getElementById('status').textContent = statusText;",
      "}",
      "function updateRunInfo(info) {",
      "  document.getElementById('current-plan').textContent = info.path || 'No plan selected';",
      "}",
      "function updateSummary(summary) {",
      "  const summaryElement = document.getElementById('summary');",
      "  summaryElement.textContent = summary ? summary.passed + '/' + summary.total + ' passed (' + summary.failed + ' failed)' : 'No results yet';",
      "}",
      "function handleMessage(event) {",
      "  const message = event.data;",
      "  if (message.type === 'plan') {",
      "    updateRunInfo({ path: message.path });",
      "    updateStatus('Plan loaded');",
      "  }",
      "  if (message.type === 'live') {",
      "    updateSummary(message.summary);",
      "    updateStatus('Running');",
      "  }",
      "  if (message.type === 'results') {",
      "    updateSummary(message.run.summary);",
      "    updateStatus('Completed');",
      "    if (message.run.jmxPath) {",
      "      updateRunInfo({ path: message.run.jmxPath });",
      "    }",
      "    currentRun = message.run;",
      "  }",
      "  if (message.type === 'clear') {",
      "    updateSummary(null);",
      "    updateStatus('Idle');",
      "    updateRunInfo({ path: '' });",
      "    currentRun = null;",
      "  }",
      "}",
      "window.addEventListener('message', handleMessage);",
      "function sendCommand(command) {",
      "  vscode.postMessage({ command });",
      "}"
    ].join('\n');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>JMeter Results</title>
  <style>
    body { font-family: sans-serif; margin: 0; padding: 0; }
    .toolbar { display: flex; gap: 8px; padding: 10px; background: #1e1e1e; color: white; }
    .toolbar button { padding: 8px 12px; border: none; border-radius: 4px; cursor: pointer; }
    .toolbar button:hover { opacity: 0.9; }
    .toolbar button.start { background: #0e639c; color: white; }
    .toolbar button.stop { background: #c50f1f; color: white; }
    .toolbar button.clear { background: #3c3c3c; color: white; }
    .content { display: grid; grid-template-columns: 300px 1fr; height: calc(100vh - 50px); }
    .panel { padding: 10px; border-right: 1px solid #333; overflow: auto; }
    .details { padding: 10px; overflow: auto; }
    .detail-group { margin-bottom: 12px; }
    .detail-group h3 { margin: 0 0 4px 0; font-size: 14px; }
    .detail-group p { margin: 0; }
    .status-bar { margin-top: 8px; font-size: 13px; color: #ccc; }
  </style>
</head>
<body>
  <div class="toolbar">
    <button class="start" onclick="sendCommand('start')">Start</button>
    <button class="stop" onclick="sendCommand('stop')">Stop</button>
    <button class="clear" onclick="sendCommand('clear')">Clear</button>
    <span id="current-plan" style="margin-left: auto; align-self: center;">No plan selected</span>
  </div>
  <div class="content">
    <div class="panel">
      <div class="detail-group"><h3>Status</h3><p id="status">Idle</p></div>
      <div class="detail-group"><h3>Summary</h3><p id="summary">No results yet</p></div>
      <div class="detail-group"><h3>Run Details</h3><pre id="details" style="white-space: pre-wrap; word-break: break-word;">No run selected.</pre></div>
    </div>
    <div class="details">
      <div class="detail-group"><h3>Instructions</h3><p>Use the toolbar to start, stop, and clear JMeter results.</p></div>
      <div class="detail-group"><h3>Current Plan</h3><p id="plan-path">No plan selected</p></div>
    </div>
  </div>
  <script>${script}</script>
</body>
</html>`;
  }
}
