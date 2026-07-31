import * as vscode from 'vscode';

export class JMeterStatusBar {
  private readonly item: vscode.StatusBarItem;

  constructor() {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.item.command = 'jmeter.runTest';
    this.item.show();
    this.updateIdle();
  }

  public updateIdle(): void {
    this.item.text = '$(beaker) JMeter';
    this.item.tooltip = 'Run a JMeter test plan';
    this.item.command = 'jmeter.runTest';
  }

  public updateRunning(count: number): void {
    this.item.text = `$(sync~spin) JMeter ${count}`;
    this.item.tooltip = 'JMeter run in progress';
    this.item.command = 'jmeter.stop';
  }

  public updateDone(summary: string, failed: number): void {
    this.item.text = failed > 0 ? `$(error) ${summary}` : `$(check) ${summary}`;
    this.item.tooltip = 'Show JMeter results';
    this.item.command = 'jmeter.showResults';
  }

  public dispose(): void {
    this.item.dispose();
  }
}
