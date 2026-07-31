import * as vscode from 'vscode';
import { registerCommands } from './commands';
import { JMeterChatParticipant } from './chat/participant';
import { JMeterRunner } from './jmeter/runner';
import { RunController } from './runController';
import { RunStore } from './model/runStore';
import { RecentRunsStore } from './model/recentRuns';
import { registerTools } from './tools';
import { RecentRunsTreeDataProvider } from './view/recentRunsTree';
import { ResultsPanel } from './view/resultsPanel';
import { TestPlansTreeDataProvider } from './view/testPlansTree';
import { JMeterStatusBar } from './statusBar';

export function activate(context: vscode.ExtensionContext) {
  const outputChannel = vscode.window.createOutputChannel('JMeter Copilot');
  context.subscriptions.push(outputChannel);

  const runStore = new RunStore();
  const recentRunsStore = new RecentRunsStore(context);
  const runner = new JMeterRunner(outputChannel, runStore, recentRunsStore);
  const runController = new RunController(runner, runStore);
  const statusBar = new JMeterStatusBar();
  const resultsPanel = new ResultsPanel();

  const testPlansProvider = new TestPlansTreeDataProvider();
  const recentRunsProvider = new RecentRunsTreeDataProvider(recentRunsStore);

  const testPlansView = vscode.window.createTreeView('jmeterTestPlans', { treeDataProvider: testPlansProvider });
  const recentRunsView = vscode.window.createTreeView('jmeterRecentRuns', { treeDataProvider: recentRunsProvider });
  context.subscriptions.push(testPlansView, recentRunsView);

  const currentPlanPath = { value: undefined as string | undefined };

  registerCommands(context, {
    runner,
    runController,
    outputChannel,
    currentPlanPath,
    testPlansProvider,
    recentRunsProvider,
    resultsPanel,
    recentRunsStore,
    runStore
  });
  registerTools(context, runner, runStore);

  const updateStatus = (state: { status: string; summary?: { total: number; passed: number; failed: number }; sampleCount?: number }) => {
    if (state.status === 'running') {
      statusBar.updateRunning(state.sampleCount ?? 0);
      return;
    }

    if (state.status === 'done' && state.summary) {
      statusBar.updateDone(`${state.summary.passed}/${state.summary.total} passed`, state.summary.failed);
      return;
    }

    statusBar.updateIdle();
  };

  runController.onDidChangeState(updateStatus);
  runController.onDidUpdateSamples((summary) => {
    statusBar.updateRunning(summary.total);
    resultsPanel.postMessage({ type: 'live', summary });
  });
  runController.onDidFinish((run) => {
    resultsPanel.createOrShow();
    resultsPanel.postMessage({ type: 'results', run });
    recentRunsProvider.refresh();
    testPlansProvider.refresh();
  });

  resultsPanel.onDidReceiveMessage(async (message: { command?: string }) => {
    if (!message || typeof message.command !== 'string') {
      return;
    }

    if (message.command === 'start') {
      await vscode.commands.executeCommand('jmeter.runTest');
      return;
    }

    if (message.command === 'stop') {
      await vscode.commands.executeCommand('jmeter.stop');
      return;
    }

    if (message.command === 'clear') {
      await vscode.commands.executeCommand('jmeter.clearResults');
      return;
    }
  });

  const watcher = vscode.workspace.createFileSystemWatcher('**/*.jmx');
  watcher.onDidCreate(() => testPlansProvider.refresh());
  watcher.onDidDelete(() => testPlansProvider.refresh());
  watcher.onDidChange(() => testPlansProvider.refresh());
  context.subscriptions.push(watcher);

  vscode.window.onDidChangeActiveTextEditor((editor) => {
    const uri = editor?.document.uri;
    if (uri?.fsPath.toLowerCase().endsWith('.jmx')) {
      currentPlanPath.value = uri.fsPath;
      resultsPanel.postMessage({ type: 'plan', path: uri.fsPath });
    }
  });

  const chatParticipant = new JMeterChatParticipant();
  chatParticipant.register(context);

  context.subscriptions.push(statusBar);
  context.subscriptions.push(resultsPanel);
  context.subscriptions.push(runController);

  void vscode.commands.executeCommand('setContext', 'jmeter.isReady', true);
  void vscode.commands.executeCommand('workbench.view.extension.jmeterRunner');
  void vscode.commands.executeCommand('workbench.view.focus', 'jmeterTestPlans');
}

export function deactivate() {}
