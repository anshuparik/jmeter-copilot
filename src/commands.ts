import * as vscode from 'vscode';
import { JMeterRunner } from './jmeter/runner';
import { RunController } from './runController';
import { RecentRunsStore } from './model/recentRuns';
import { RunStore } from './model/runStore';
import { RecentRunsTreeDataProvider } from './view/recentRunsTree';
import { ResultsPanel } from './view/resultsPanel';
import { TestPlansTreeDataProvider } from './view/testPlansTree';
import { resolveJmxTarget } from './util/jmxResolver';

interface CommandDependencies {
  runner: JMeterRunner;
  runController: RunController;
  outputChannel: vscode.OutputChannel;
  currentPlanPath: { value?: string };
  testPlansProvider: TestPlansTreeDataProvider;
  recentRunsProvider: RecentRunsTreeDataProvider;
  resultsPanel: ResultsPanel;
  recentRunsStore: RecentRunsStore;
  runStore: RunStore;
}

export function registerCommands(context: vscode.ExtensionContext, deps: CommandDependencies): void {

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
    const resolved = await resolveJmxTarget(uri, deps.currentPlanPath.value);
    if (!resolved) {
      return;
    }
    setCurrentPlan(resolved);
    deps.resultsPanel.postMessage({ type: 'plan', path: resolved.fsPath });
    await vscode.window.showTextDocument(resolved, { preview: false });
  }));

  context.subscriptions.push(vscode.commands.registerCommand('jmeter.runTestPlan', async (uri?: vscode.Uri) => {
    await vscode.commands.executeCommand('jmeter.runTest', uri);
  }));

  context.subscriptions.push(vscode.commands.registerCommand('jmeter.runTest', async (uri?: vscode.Uri) => {
    try {
      const resolved = await resolveJmxTarget(uri, deps.currentPlanPath.value);
      if (!resolved) {
        throw new Error('No JMeter test plan selected.');
      }
      setCurrentPlan(resolved);
      await deps.runController.start(resolved.fsPath);
      deps.resultsPanel.createOrShow();
      deps.recentRunsProvider.refresh();
      deps.testPlansProvider.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      deps.outputChannel.appendLine(`Run failed: ${message}`);
      const choice = await vscode.window.showErrorMessage(message, 'Set JMeter Path');
      if (choice === 'Set JMeter Path') {
        void vscode.commands.executeCommand('workbench.action.openSettings', 'jmeter');
      }
    }
  }));

  context.subscriptions.push(vscode.commands.registerCommand('jmeter.stop', () => {
    deps.runController.stop();
    deps.outputChannel.appendLine('Stop requested.');
  }));

  context.subscriptions.push(vscode.commands.registerCommand('jmeter.clearResults', () => {
    deps.runController.clear();
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
