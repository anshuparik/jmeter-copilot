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
    const planName = this.getPlanName(element.jmxPath);
    const time = this.getTimeString(element.lastRunAt);
    const status = `${element.passed}/${element.total} passed`;
    const item = new vscode.TreeItem(planName, vscode.TreeItemCollapsibleState.None);
    item.description = `${time} · ${status}`;
    item.tooltip = `${element.jmxPath}\n${status}\n${new Date(element.lastRunAt).toLocaleString()}${exists ? '' : '\n(missing file)'}`;
    item.contextValue = exists ? 'jmeterRecentRun' : 'jmeterRecentRunMissing';
    item.command = exists ? { command: 'jmeter.showRecentRun', title: 'Show Results', arguments: [element] } : undefined;
    item.iconPath = exists ? new vscode.ThemeIcon('history') : new vscode.ThemeIcon('warning');
    return item;
  }

  private getPlanName(jmxPath: string): string {
    const base = jmxPath.split(/[\\/]/).pop() || jmxPath;
    return base.replace(/\.jmx$/i, '');
  }

  private getTimeString(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
}
