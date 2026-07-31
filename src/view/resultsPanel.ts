import * as vscode from 'vscode';

export class ResultsPanel {
  private panel: vscode.WebviewPanel | undefined;

  constructor() {
    this.panel = undefined;
  }

  public createOrShow(): void {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.Beside);
      return;
    }

    const panel = vscode.window.createWebviewPanel('jmeterResults', 'JMeter Results', vscode.ViewColumn.Beside, { enableScripts: true });
    panel.webview.html = this.getHtml();
    this.panel = panel;
  }

  public clear(): void {
    if (this.panel) {
      this.panel.webview.html = this.getHtml();
    }
  }

  public dispose(): void {
    this.panel?.dispose();
  }

  private getHtml(): string {
    return `<!DOCTYPE html><html><body><h2>JMeter Results</h2><p>No results yet.</p></body></html>`;
  }
}
