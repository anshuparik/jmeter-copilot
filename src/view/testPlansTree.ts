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
    const item = new vscode.TreeItem(element, vscode.TreeItemCollapsibleState.None);
    item.contextValue = 'jmx';
    item.command = { command: 'jmeter.selectTestPlan', title: 'Open', arguments: [element] };
    item.description = element.path;
    return item;
  }

  private async listJmxFiles(): Promise<vscode.Uri[]> {
    const files = await vscode.workspace.findFiles('**/*.jmx', '{node_modules,.git,.jmeter-runs,dist,out}/**');
    return files;
  }
}
