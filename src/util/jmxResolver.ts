import * as fs from 'fs';
import * as vscode from 'vscode';

export async function resolveJmxTarget(uri?: vscode.Uri, currentPlanPath?: string): Promise<vscode.Uri | undefined> {
  if (uri?.fsPath) {
    return uri;
  }

  const active = vscode.window.activeTextEditor?.document.uri;
  if (active?.fsPath.toLowerCase().endsWith('.jmx')) {
    return active;
  }

  if (currentPlanPath && fs.existsSync(currentPlanPath)) {
    return vscode.Uri.file(currentPlanPath);
  }

  const files = await vscode.workspace.findFiles('**/*.jmx', '{node_modules,.git,.jmeter-runs,dist,out}/**');
  if (files.length === 1) {
    return files[0];
  }

  if (files.length > 1) {
    const picked = await vscode.window.showQuickPick(files.map((file) => file.fsPath), { placeHolder: 'Select a JMeter test plan' });
    return picked ? vscode.Uri.file(picked) : undefined;
  }

  const dialog = await vscode.window.showOpenDialog({ canSelectMany: false, filters: { 'JMeter test plans': ['jmx'] } });
  return dialog?.[0];
}
