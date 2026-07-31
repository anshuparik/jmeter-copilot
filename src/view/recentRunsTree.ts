import * as fs from 'fs';
import * as vscode from 'vscode';
import { RecentRunsStore, RecentRunEntry } from '../model/recentRuns';

export class RecentRunsTreeDataProvider implements vscode.TreeDataProvider<RecentRunEntry> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<RecentRunEntry | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private readonly recentRunsStore: RecentRunsStore) {}

  public refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  public async getChildren(): Promise<RecentRunEntry[]> {
    const recent = await this.recentRunsStore.list();
    return recent.sort((a, b) => b.lastRunAt - a.lastRunAt);
  }

  public async getTreeItem(element: RecentRunEntry): Promise<vscode.TreeItem> {
    const exists = fs.existsSync(element.jmxPath);
    const relativeTime = this.getRelativeTime(element.lastRunAt);
    const display = `${element.passed}/${element.total} passed`;
    const item = new vscode.TreeItem(display, vscode.TreeItemCollapsibleState.None);
    item.description = `${relativeTime}${exists ? '' : ' (missing)'}`;
    item.tooltip = `${element.jmxPath}${exists ? '' : ' (missing file)'}`;
    item.contextValue = exists ? 'jmeterRecentRun' : 'jmeterRecentRunMissing';
    item.command = exists ? { command: 'jmeter.selectTestPlan', title: 'Open', arguments: [vscode.Uri.file(element.jmxPath)] } : undefined;
    item.iconPath = exists ? undefined : new vscode.ThemeIcon('warning');
    return item;
  }

  private getRelativeTime(timestamp: number): string {
    const diffMs = Date.now() - timestamp;
    const diffMinutes = Math.floor(diffMs / 60000);
    if (diffMinutes < 1) {
      return 'just now';
    }
    if (diffMinutes < 60) {
      return `${diffMinutes}m ago`;
    }
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) {
      return `${diffHours}h ago`;
    }
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  }
}
