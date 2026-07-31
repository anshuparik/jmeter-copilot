import * as vscode from 'vscode';
import { TestRun, SampleResult } from '../model/types';

export type ResultsPanelMessage =
  | { type: 'running'; sampleCount: number }
  | { type: 'live'; summary: { total: number; passed: number; failed: number }; samples?: SampleResult[] }
  | { type: 'results'; run: TestRun }
  | { type: 'plan'; path: string }
  | { type: 'error'; message: string }
  | { type: 'clear' };

export class ResultsPanel implements vscode.Disposable {
  private panel: vscode.WebviewPanel | undefined;
  private pendingMessage: ResultsPanelMessage | undefined;
  private currentPlan: string | undefined;
  private readonly _onDidReceiveMessage = new vscode.EventEmitter<any>();
  public readonly onDidReceiveMessage = this._onDidReceiveMessage.event;

  constructor() {}

  public createOrShow(): void {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.Beside);
      return;
    }

    const panel = vscode.window.createWebviewPanel('jmeterResults', 'JMeter Results', vscode.ViewColumn.Beside, {
      enableScripts: true,
      retainContextWhenHidden: true
    });
    panel.webview.onDidReceiveMessage((message) => this._onDidReceiveMessage.fire(message));
    panel.onDidDispose(() => {
      this.panel = undefined;
    });
    panel.webview.html = this.getHtml();
    this.panel = panel;

    if (this.currentPlan) {
      this.postMessage({ type: 'plan', path: this.currentPlan });
    }

    if (this.pendingMessage) {
      this.postMessage(this.pendingMessage);
      this.pendingMessage = undefined;
    }
  }

  public clear(): void {
    this.postMessage({ type: 'clear' });
  }

  public dispose(): void {
    this.panel?.dispose();
  }

  public postMessage(message: ResultsPanelMessage): void {
    if (message.type === 'plan') {
      this.currentPlan = message.path;
    }
    if (!this.panel) {
      this.pendingMessage = message;
      return;
    }
    this.panel.webview.postMessage(message);
  }

  private getHtml(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>JMeter Results</title>
  <style>
    :root {
      --bg-color: var(--vscode-editor-background, #1e1e1e);
      --fg-color: var(--vscode-editor-foreground, #d4d4d4);
      --panel-bg: var(--vscode-sideBar-background, #252526);
      --border-color: var(--vscode-panel-border, #3c3c3c);
      --hover-bg: var(--vscode-list-hoverBackground, #2a2d2e);
      --select-bg: var(--vscode-list-activeSelectionBackground, #04395e);
      --select-fg: var(--vscode-list-activeSelectionForeground, #ffffff);
      --pass-color: #4caf50;
      --fail-color: #f44336;
      --badge-running-bg: #d97706;
    }

    * { box-sizing: border-box; }
    body {
      font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif);
      font-size: var(--vscode-font-size, 13px);
      margin: 0;
      padding: 0;
      background: var(--bg-color);
      color: var(--fg-color);
      height: 100vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .toolbar {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 6px 12px;
      background: var(--panel-bg);
      border-bottom: 1px solid var(--border-color);
    }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 12px;
      border: none;
      border-radius: 3px;
      font-weight: 600;
      font-size: 12px;
      cursor: pointer;
      color: #ffffff;
      transition: opacity 0.2s;
    }
    .btn:hover { opacity: 0.88; }
    .btn-start { background: #2e7d32; }
    .btn-stop { background: #c62828; }
    .btn-clear { background: #424242; }

    .plan-title {
      font-weight: 600;
      margin-left: 8px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 300px;
    }

    .status-badge {
      margin-left: auto;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
      background: #333;
      color: #fff;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .status-badge.running { background: var(--badge-running-bg); }
    .status-badge.done-pass { background: #1b5e20; }
    .status-badge.done-fail { background: #b71c1c; }

    .main-container {
      display: flex;
      flex: 1;
      overflow: hidden;
    }

    .tree-pane {
      width: 420px;
      min-width: 250px;
      background: var(--panel-bg);
      border-right: 1px solid var(--border-color);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .tree-header {
      padding: 8px 12px;
      font-weight: bold;
      border-bottom: 1px solid var(--border-color);
      background: rgba(255,255,255,0.03);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .tree-list {
      flex: 1;
      overflow-y: auto;
      padding: 4px 0;
    }

    .tree-node {
      display: flex;
      align-items: center;
      padding: 4px 8px;
      cursor: pointer;
      user-select: none;
      font-size: 12px;
      line-height: 18px;
      border-radius: 2px;
      margin: 1px 4px;
    }
    .tree-node:hover { background: var(--hover-bg); }
    .tree-node.selected { background: var(--select-bg); color: var(--select-fg); }

    .toggle-icon {
      width: 16px;
      text-align: center;
      font-size: 10px;
      cursor: pointer;
      opacity: 0.7;
    }

    .node-icon {
      margin-right: 6px;
      font-weight: bold;
      font-size: 13px;
    }
    .icon-pass { color: var(--pass-color); }
    .icon-fail { color: var(--fail-color); }

    .node-label {
      flex: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .node-code {
      font-size: 11px;
      opacity: 0.85;
      padding: 1px 5px;
      border-radius: 3px;
      background: rgba(255,255,255,0.07);
      margin-left: 6px;
    }

    .detail-pane {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      background: var(--bg-color);
    }

    .tab-bar {
      display: flex;
      background: var(--panel-bg);
      border-bottom: 1px solid var(--border-color);
    }

    .tab {
      padding: 8px 16px;
      cursor: pointer;
      border-bottom: 2px solid transparent;
      font-weight: 500;
      color: #aaa;
      user-select: none;
    }
    .tab:hover { color: #fff; }
    .tab.active {
      color: #fff;
      border-bottom-color: var(--vscode-activityBar-activeBorder, #007acc);
      background: rgba(255,255,255,0.03);
    }

    .tab-content {
      flex: 1;
      padding: 16px;
      overflow-y: auto;
      display: none;
    }
    .tab-content.active { display: block; }

    .kv-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
    }
    .kv-table td {
      padding: 6px 10px;
      vertical-align: top;
      border-bottom: 1px solid rgba(255,255,255,0.05);
    }
    .kv-key {
      font-weight: 600;
      width: 150px;
      color: #aaa;
    }

    .pass-text { color: var(--pass-color); font-weight: bold; }
    .fail-text { color: var(--fail-color); font-weight: bold; }

    pre.code-block {
      background: #141414;
      border: 1px solid var(--border-color);
      padding: 10px;
      border-radius: 4px;
      white-space: pre-wrap;
      word-break: break-all;
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 12px;
      margin-top: 4px;
      max-height: 400px;
      overflow-y: auto;
    }

    .banner-warning {
      background: #854d0e;
      color: #fef08a;
      padding: 8px 12px;
      border-radius: 4px;
      margin-bottom: 12px;
      font-size: 12px;
    }

    .empty-state {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: #888;
      font-style: italic;
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <button class="btn btn-start" id="btn-start" onclick="sendCommand('start')">▶ Start</button>
    <button class="btn btn-stop" id="btn-stop" onclick="sendCommand('stop')" disabled>■ Stop</button>
    <button class="btn btn-clear" id="btn-clear" onclick="onclickClear()" disabled>Clear</button>
    <span class="plan-title" id="plan-name">No plan selected</span>
    <span class="status-badge" id="status-badge">Idle</span>
  </div>

  <div class="main-container">
    <div class="tree-pane">
      <div class="tree-header">Sampler Results</div>
      <div class="tree-list" id="tree-list">
        <div class="empty-state">No results available</div>
      </div>
    </div>

    <div class="detail-pane">
      <div class="tab-bar">
        <div class="tab active" data-tab="tab-sampler" onclick="switchTab('tab-sampler')">Sampler result</div>
        <div class="tab" data-tab="tab-request" onclick="switchTab('tab-request')">Request</div>
        <div class="tab" data-tab="tab-response" onclick="switchTab('tab-response')">Response data</div>
      </div>

      <div class="tab-content active" id="tab-sampler">
        <div class="empty-state" id="sampler-empty">Select a sampler result on the left to view details</div>
        <div id="sampler-details" style="display: none;">
          <table class="kv-table">
            <tr><td class="kv-key">Sampler</td><td id="detail-label"></td></tr>
            <tr><td class="kv-key">Result</td><td id="detail-result"></td></tr>
            <tr><td class="kv-key">Response code</td><td id="detail-rc"></td></tr>
            <tr><td class="kv-key">Thread</td><td id="detail-thread"></td></tr>
            <tr><td class="kv-key">Load time</td><td id="detail-loadtime"></td></tr>
            <tr><td class="kv-key">Latency</td><td id="detail-latency"></td></tr>
            <tr><td class="kv-key">Timestamp</td><td id="detail-timestamp"></td></tr>
          </table>
          <div id="assertion-container"></div>
        </div>
      </div>

      <div class="tab-content" id="tab-request">
        <div class="empty-state" id="request-empty">Select a sampler result to view request details</div>
        <div id="request-details" style="display: none;">
          <table class="kv-table">
            <tr><td class="kv-key">URL</td><td id="req-url"></td></tr>
            <tr><td class="kv-key">Method</td><td id="req-method"></td></tr>
            <tr><td class="kv-key">Cookies</td><td id="req-cookies"></td></tr>
          </table>
          <h4>Request Headers</h4>
          <pre class="code-block" id="req-headers"></pre>
          <h4>Request Body / Data</h4>
          <pre class="code-block" id="req-body"></pre>
        </div>
      </div>

      <div class="tab-content" id="tab-response">
        <div class="empty-state" id="response-empty">Select a sampler result to view response data</div>
        <div id="response-details" style="display: none;">
          <div id="truncation-warning" class="banner-warning" style="display: none;">
            ⚠️ Response body was truncated to max byte limit.
          </div>
          <h4>Response Headers</h4>
          <pre class="code-block" id="res-headers"></pre>
          <h4>Response Body</h4>
          <pre class="code-block" id="res-body"></pre>
        </div>
      </div>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    let currentSamples = [];
    let selectedSample = null;
    let expandedMap = {};

    function sendCommand(command) {
      vscode.postMessage({ command });
    }

    function setButtons(state) {
      const start = document.getElementById('btn-start');
      const stop = document.getElementById('btn-stop');
      const clear = document.getElementById('btn-clear');
      start.disabled = state === 'running';
      stop.disabled = state !== 'running';
      clear.disabled = state !== 'done';
      start.style.opacity = start.disabled ? '0.5' : '';
      stop.style.opacity = stop.disabled ? '0.5' : '';
      clear.style.opacity = clear.disabled ? '0.5' : '';
    }

    function onclickClear() {
      sendCommand('clear');
    }

    function switchTab(tabId) {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      const activeTab = document.querySelector(\`[data-tab="\${tabId}"]\`);
      if (activeTab) activeTab.classList.add('active');
      const content = document.getElementById(tabId);
      if (content) content.classList.add('active');
    }

    function formatFilename(fullPath) {
      if (!fullPath) return 'No plan selected';
      const parts = fullPath.replace(/\\\\/g, '/').split('/');
      return parts[parts.length - 1];
    }

    function updatePlanName(path) {
      document.getElementById('plan-name').textContent = formatFilename(path);
      document.getElementById('plan-name').title = path || '';
    }

    function updateBadge(type, text) {
      const badge = document.getElementById('status-badge');
      badge.className = 'status-badge ' + (type || '');
      badge.textContent = text;
    }

    window.addEventListener('message', event => {
      const msg = event.data;
      if (!msg) return;

      if (msg.type === 'plan') {
        updatePlanName(msg.path);
      }

      if (msg.type === 'running') {
        setButtons('running');
        updateBadge('running', '⚡ Starting JMeter...');
      }

      if (msg.type === 'live') {
        setButtons('running');
        const s = msg.summary || { total: 0, passed: 0, failed: 0 };
        updateBadge('running', s.total === 0 ? '⚡ Starting JMeter... (no samples yet)' : \`⚡ Running... \${s.total} samples (\${s.failed} failed)\`);
        if (msg.samples) {
          renderSampleTree(msg.samples);
        }
      }

      if (msg.type === 'results') {
        setButtons('done');
        const run = msg.run;
        if (run) {
          if (run.jmxPath) updatePlanName(run.jmxPath);
          const sum = run.summary || { total: 0, passed: 0, failed: 0 };
          const badgeType = sum.failed > 0 ? 'done-fail' : 'done-pass';
          updateBadge(badgeType, \`✓ Completed: \${sum.passed}/\${sum.total} passed\`);
          renderSampleTree(run.samples || []);
        }
      }

      if (msg.type === 'error') {
        setButtons('idle');
        updateBadge('', 'Error');
      }

      if (msg.type === 'clear') {
        currentSamples = [];
        selectedSample = null;
        setButtons('idle');
        updateBadge('', 'Idle');
        document.getElementById('tree-list').innerHTML = '<div class="empty-state">No results available</div>';
        resetDetails();
      }
    });

    function renderSampleTree(samples) {
      currentSamples = samples || [];
      const treeContainer = document.getElementById('tree-list');
      if (!currentSamples.length) {
        treeContainer.innerHTML = '<div class="empty-state">No samples recorded</div>';
        resetDetails();
        return;
      }

      treeContainer.innerHTML = '';
      currentSamples.forEach((sample, index) => {
        const nodeEl = createTreeNode(sample, [index], 0);
        treeContainer.appendChild(nodeEl);
      });

      if (!selectedSample && currentSamples.length > 0) {
        const firstFail = findFirstFailing(currentSamples, []);
        const targetPath = firstFail ? firstFail : [0];
        selectSampleByPath(targetPath);
      }
    }

    function findFirstFailing(samples, currentPath) {
      for (let i = 0; i < samples.length; i++) {
        const path = [...currentPath, i];
        if (samples[i].success === false) return path;
        if (samples[i].subResults && samples[i].subResults.length > 0) {
          const res = findFirstFailing(samples[i].subResults, path);
          if (res) return res;
        }
      }
      return null;
    }

    function createTreeNode(sample, pathArray, level) {
      const key = pathArray.join('-');
      const hasChildren = sample.subResults && sample.subResults.length > 0;
      const isExpanded = expandedMap[key] !== false;

      const container = document.createElement('div');
      const row = document.createElement('div');
      row.className = 'tree-node';
      row.style.paddingLeft = \`\${(level * 16) + 8}px\`;
      row.dataset.key = key;

      const toggle = document.createElement('span');
      toggle.className = 'toggle-icon';
      if (hasChildren) {
        toggle.textContent = isExpanded ? '▼' : '▶';
        toggle.onclick = (e) => {
          e.stopPropagation();
          expandedMap[key] = !isExpanded;
          renderSampleTree(currentSamples);
        };
      } else {
        toggle.textContent = '';
      }
      row.appendChild(toggle);

      const icon = document.createElement('span');
      icon.className = 'node-icon ' + (sample.success !== false ? 'icon-pass' : 'icon-fail');
      icon.textContent = sample.success !== false ? '✓' : 'X';
      row.appendChild(icon);

      const label = document.createElement('span');
      label.className = 'node-label';
      label.textContent = sample.label || 'Unnamed Sampler';
      row.appendChild(label);

      if (sample.responseCode) {
        const code = document.createElement('span');
        code.className = 'node-code';
        code.textContent = sample.responseCode;
        row.appendChild(code);
      }

      row.onclick = () => {
        document.querySelectorAll('.tree-node').forEach(n => n.classList.remove('selected'));
        row.classList.add('selected');
        showSampleDetails(sample);
      };

      container.appendChild(row);

      if (hasChildren && isExpanded) {
        const childrenDiv = document.createElement('div');
        sample.subResults.forEach((sub, subIndex) => {
          const childNode = createTreeNode(sub, [...pathArray, subIndex], level + 1);
          childrenDiv.appendChild(childNode);
        });
        container.appendChild(childrenDiv);
      }

      return container;
    }

    function selectSampleByPath(pathArray) {
      let current = currentSamples;
      let sample = null;
      for (let i = 0; i < pathArray.length; i++) {
        if (!current || !current[pathArray[i]]) return;
        sample = current[pathArray[i]];
        if (i < pathArray.length - 1) {
          current = sample.subResults;
        }
      }
      if (sample) {
        const key = pathArray.join('-');
        const row = document.querySelector(\`[data-key="\${key}"]\`);
        if (row) {
          document.querySelectorAll('.tree-node').forEach(n => n.classList.remove('selected'));
          row.classList.add('selected');
        }
        showSampleDetails(sample);
      }
    }

    function resetDetails() {
      document.getElementById('sampler-empty').style.display = 'flex';
      document.getElementById('sampler-details').style.display = 'none';
      document.getElementById('request-empty').style.display = 'flex';
      document.getElementById('request-details').style.display = 'none';
      document.getElementById('response-empty').style.display = 'flex';
      document.getElementById('response-details').style.display = 'none';
    }

    function showSampleDetails(sample) {
      selectedSample = sample;

      // Sampler Tab
      document.getElementById('sampler-empty').style.display = 'none';
      document.getElementById('sampler-details').style.display = 'block';

      document.getElementById('detail-label').textContent = sample.label || 'N/A';
      const isPass = sample.success !== false;
      document.getElementById('detail-result').innerHTML = isPass
        ? '<span class="pass-text">PASS</span>'
        : '<span class="fail-text">FAIL</span>';

      document.getElementById('detail-rc').textContent = \`\${sample.responseCode || 'N/A'} \${sample.responseMessage || ''}\`;
      document.getElementById('detail-thread').textContent = sample.thread || 'N/A';
      document.getElementById('detail-loadtime').textContent = sample.elapsed !== undefined ? \`\${sample.elapsed} ms\` : 'N/A';
      document.getElementById('detail-latency').textContent = sample.latency !== undefined ? \`\${sample.latency} ms\` : 'N/A';
      document.getElementById('detail-timestamp').textContent = sample.timestamp ? new Date(sample.timestamp).toLocaleString() : 'N/A';

      const assertionContainer = document.getElementById('assertion-container');
      assertionContainer.innerHTML = '';
      if (sample.assertions && sample.assertions.length > 0) {
        const header = document.createElement('h4');
        header.textContent = 'Assertion Results';
        assertionContainer.appendChild(header);
        const ul = document.createElement('ul');
        sample.assertions.forEach(a => {
          const li = document.createElement('li');
          li.innerHTML = \`<strong>\${a.name || 'Assertion'}</strong>: \${a.failure ? '<span class="fail-text">FAILED</span>' : '<span class="pass-text">PASSED</span>'} \${a.failureMessage ? \` - \${a.failureMessage}\` : ''}\`;
          ul.appendChild(li);
        });
        assertionContainer.appendChild(ul);
      }

      // Request Tab
      document.getElementById('request-empty').style.display = 'none';
      document.getElementById('request-details').style.display = 'block';

      document.getElementById('req-url').textContent = sample.url || 'N/A';
      document.getElementById('req-method').textContent = sample.method || 'N/A';
      document.getElementById('req-cookies').textContent = sample.cookies || 'None';
      document.getElementById('req-headers').textContent = sample.requestHeader || 'None';
      document.getElementById('req-body').textContent = sample.requestData || sample.samplerData || sample.queryString || 'None';

      // Response Tab
      document.getElementById('response-empty').style.display = 'none';
      document.getElementById('response-details').style.display = 'block';

      document.getElementById('truncation-warning').style.display = sample.bodyTruncated ? 'block' : 'none';
      document.getElementById('res-headers').textContent = sample.responseHeader || 'None';
      document.getElementById('res-body').textContent = sample.responseData || 'None';
    }

    setButtons('idle');
  </script>
</body>
</html>`;
  }
}

