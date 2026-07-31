import * as fs from 'fs';
import * as vscode from 'vscode';
import { JMeterRunner } from './jmeter/runner';
import { RecentRunsStore } from './model/recentRuns';
import { RunStore } from './model/runStore';
import { RecentRunsTreeDataProvider } from './view/recentRunsTree';
import { ResultsPanel } from './view/resultsPanel';
import { TestPlansTreeDataProvider } from './view/testPlansTree';

interface CommandDependencies {
  runner: JMeterRunner;
  outputChannel: vscode.OutputChannel;
  currentPlanPath: { value?: string };
  testPlansProvider: TestPlansTreeDataProvider;
  recentRunsProvider: RecentRunsTreeDataProvider;
  resultsPanel: ResultsPanel;
  recentRunsStore: RecentRunsStore;
  runStore: RunStore;
}

export function registerCommands(context: vscode.ExtensionContext, deps: CommandDependencies): void {
  const resolveUri = async (uri?: vscode.Uri): Promise<vscode.Uri | undefined> => {
    if (uri) {
      return uri;
    }

    const active = vscode.window.activeTextEditor?.document.uri;
    if (active?.fsPath.toLowerCase().endsWith('.jmx')) {
      return active;
    }

    if (deps.currentPlanPath.value && fs.existsSync(deps.currentPlanPath.value)) {
      return vscode.Uri.file(deps.currentPlanPath.value);
    }

    const files = await vscode.workspace.findFiles('**/*.jmx', '{node_modules,.git,.jmeter-runs,dist,out}/**');
    if (files.length === 1) {
      return files[0];
    }

    if (files.length > 1) {
      const picked = await vscode.window.showQuickPick(files.map((file) => ({ label: file.fsPath, description: file.fsPath })), { placeHolder: 'Select a JMeter test plan' });
      return picked ? picked.label ? vscode.Uri.file(picked.label) : undefined : undefined;
    }

    const dialog = await vscode.window.showOpenDialog({ canSelectMany: false, filters: { 'JMeter test plans': ['jmx'] } });
    return dialog?.[0];
  };

  const setCurrentPlan = (uri?: vscode.Uri): void => {
    if (uri) {
      deps.currentPlanPath.value = uri.fsPath;
    }
  };

  context.subscriptions.push(vscode.commands.registerCommand('jmeter.refreshTestPlans', () => {
    deps.testPlansProvider.refresh();
    deps.recentRunsProvider.refresh();
  }));

  context.subscriptions.push(vscode.commands.registerCommand('jmeter.selectTestPlan', async (uri?: vscode.Uri) => {
    const resolved = await resolveUri(uri);
    if (!resolved) {
      return;
    }
    setCurrentPlan(resolved);
    await vscode.window.showTextDocument(resolved, { preview: false });
  }));

  context.subscriptions.push(vscode.commands.registerCommand('jmeter.runTestPlan', async (uri?: vscode.Uri) => {
    await vscode.commands.executeCommand('jmeter.runTest', uri);
  }));

  context.subscriptions.push(vscode.commands.registerCommand('jmeter.runTest', async (uri?: vscode.Uri) => {
    try {
      const resolved = await resolveUri(uri);
      if (!resolved) {
        throw new Error('No JMeter test plan selected.');
      }
      setCurrentPlan(resolved);
      await deps.runner.run(resolved.fsPath);
      deps.resultsPanel.createOrShow();
      deps.recentRunsProvider.refresh();
      deps.testPlansProvider.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      deps.outputChannel.appendLine(`Run failed: ${message}`);
      void vscode.window.showErrorMessage(message);
    }
  }));

  context.subscriptions.push(vscode.commands.registerCommand('jmeter.stop', () => {
    deps.runner.stop();
    deps.outputChannel.appendLine('Stop requested.');
  }));

  context.subscriptions.push(vscode.commands.registerCommand('jmeter.clearResults', () => {
    deps.runStore.clear();
    deps.resultsPanel.clear();
    deps.outputChannel.appendLine('Results cleared.');
  }));

  context.subscriptions.push(vscode.commands.registerCommand('jmeter.showResults', () => {
    deps.resultsPanel.createOrShow();
  }));

  context.subscriptions.push(vscode.commands.registerCommand('jmeter.clearRecent', async () => {
    await deps.recentRunsStore.clear();
    deps.recentRunsProvider.refresh();
  }));

  context.subscriptions.push(vscode.commands.registerCommand('jmeter.removeRecent', async (uri?: vscode.Uri) => {
    const target = uri?.fsPath ?? deps.currentPlanPath.value;
    if (!target) {
      return;
    }
    await deps.recentRunsStore.remove(target);
    deps.recentRunsProvider.refresh();
  }));
}
