import * as vscode from 'vscode';
import { registerCommands } from './commands';
import { JMeterChatParticipant } from './chat/participant';
import { JMeterRunner } from './jmeter/runner';
import { RunStore } from './model/runStore';
import { RecentRunsStore } from './model/recentRuns';
import { registerTools } from './tools';
import { RecentRunsTreeDataProvider } from './view/recentRunsTree';
import { ResultsPanel } from './view/resultsPanel';
import { TestPlansTreeDataProvider } from './view/testPlansTree';
import { JMeterStatusBar } from './statusBar';

export function activate(context: vscode.ExtensionContext) {
  const outputChannel = vscode.window.createOutputChannel('JMeter Copilot');
  outputChannel.appendLine('JMeter Copilot activated');
  context.subscriptions.push(outputChannel);

  const runStore = new RunStore();
  const recentRunsStore = new RecentRunsStore(context);
  const runner = new JMeterRunner(outputChannel, runStore, recentRunsStore);
  const statusBar = new JMeterStatusBar();
  const updateStatusBar = (run?: { summary: { total: number; passed: number; failed: number } }) => {
    if (!run) {
      statusBar.updateIdle();
      return;
    }
    statusBar.updateDone(`${run.summary.passed}/${run.summary.total} passed`, run.summary.failed);
  };
  const resultsPanel = new ResultsPanel();

  const testPlansProvider = new TestPlansTreeDataProvider();
  const recentRunsProvider = new RecentRunsTreeDataProvider(recentRunsStore);

  const testPlansView = vscode.window.createTreeView('jmeterTestPlans', { treeDataProvider: testPlansProvider });
  const recentRunsView = vscode.window.createTreeView('jmeterRecentRuns', { treeDataProvider: recentRunsProvider });
  context.subscriptions.push(testPlansView, recentRunsView);

  const currentPlanPath = { value: undefined as string | undefined };
  registerCommands(context, {
    runner,
    outputChannel,
    currentPlanPath,
    testPlansProvider,
    recentRunsProvider,
    resultsPanel,
    recentRunsStore,
    runStore
  });
  registerTools(context, runner, runStore);

  const chatParticipant = new JMeterChatParticipant();
  chatParticipant.register(context);

  context.subscriptions.push(statusBar);
  context.subscriptions.push(resultsPanel);

  const originalRun = runner.run.bind(runner);
  runner.run = async (jmxPath: string) => {
    statusBar.updateRunning(0);
    const run = await originalRun(jmxPath);
    updateStatusBar(run);
    return run;
  };

  const watcher = vscode.workspace.createFileSystemWatcher('**/*.jmx');
  watcher.onDidCreate(() => testPlansProvider.refresh());
  watcher.onDidDelete(() => testPlansProvider.refresh());
  context.subscriptions.push(watcher);

  vscode.window.onDidChangeActiveTextEditor((editor) => {
    const uri = editor?.document.uri;
    if (uri?.fsPath.toLowerCase().endsWith('.jmx')) {
      currentPlanPath.value = uri.fsPath;
    }
  });

  context.subscriptions.push(vscode.commands.registerCommand('jmeter.runTest', async (uri?: vscode.Uri) => {
    const target = uri ?? vscode.window.activeTextEditor?.document.uri;
    if (target) {
      currentPlanPath.value = target.fsPath;
      await runner.run(target.fsPath);
    }
  }));

  void vscode.commands.executeCommand('setContext', 'jmeter.isReady', true);
}

export function deactivate() {}
