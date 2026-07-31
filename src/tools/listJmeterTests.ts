import * as vscode from 'vscode';

export async function listJmeterTests(): Promise<string[]> {
  const files = await vscode.workspace.findFiles('**/*.jmx', '{node_modules,.git,.jmeter-runs,dist,out}/**');
  return files.map((file) => file.fsPath).sort();
}
