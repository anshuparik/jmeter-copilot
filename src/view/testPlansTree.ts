import * as vscode from 'vscode';

export class TestPlansTreeDataProvider implements vscode.TreeDataProvider<vscode.Uri> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<vscode.Uri | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  public refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  public async getChildren(element?: vscode.Uri): Promise<vscode.Uri[]> {
    if (element) {
      return [];
    }
    return await this.listJmxFiles();
  }

  public getTreeItem(element: vscode.Uri): vscode.TreeItem {
    const item = new vscode.TreeItem(vscode.Uri.file(element.fsPath), vscode.TreeItemCollapsibleState.None);
    item.contextValue = 'jmeterTestPlan';
    item.command = { command: 'jmeter.selectTestPlan', title: 'Open', arguments: [element] };
    item.description = element.fsPath;
    item.tooltip = element.fsPath;
    return item;
  }

  private async listJmxFiles(): Promise<vscode.Uri[]> {
    const files = await vscode.workspace.findFiles('**/*.jmx', '{node_modules,.git,.jmeter-runs,dist,out}/**');
    return files.sort((a, b) => a.fsPath.localeCompare(b.fsPath, undefined, { sensitivity: 'base' }));
  }
}
