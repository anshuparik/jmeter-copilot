import * as fs from 'fs';
import * as vscode from 'vscode';
import { RecentRunsStore } from '../model/recentRuns';

interface RecentRunNode {
  label: string;
  path: string;
  description: string;
}

export class RecentRunsTreeDataProvider implements vscode.TreeDataProvider<RecentRunNode> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<RecentRunNode | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private readonly recentRunsStore: RecentRunsStore) {}

  public refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  public async getChildren(): Promise<RecentRunNode[]> {
    const recent = await this.recentRunsStore.list();
    return recent.map((item) => {
      const exists = fs.existsSync(item.jmxPath);
      const relativeTime = this.getRelativeTime(item.lastRunAt);
      const status = exists ? '' : ' (missing)';
      return {
        label: `${item.passed}/${item.total} passed`,
        path: item.jmxPath,
        description: `${relativeTime}${status}`
      };
    });
  }

  public async getTreeItem(element: RecentRunNode): Promise<vscode.TreeItem> {
    const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.None);
    item.description = element.description;
    item.contextValue = 'recent';
    item.command = { command: 'jmeter.selectTestPlan', title: 'Open', arguments: [vscode.Uri.file(element.path)] };
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
