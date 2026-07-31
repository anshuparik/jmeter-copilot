import * as fs from 'fs';
import * as vscode from 'vscode';
import { JMeterRunner } from './jmeter/runner';
import { RunController } from './runController';
import { RecentRunsStore, RecentRunEntry } from './model/recentRuns';
import { RunStore } from './model/runStore';
import { TestRun } from './model/types';
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

  context.subscriptions.push(vscode.commands.registerCommand('jmeter.showRecentRun', async (arg?: RecentRunEntry | string | { id?: string; jmxPath?: string; lastRunAt?: number } | vscode.Uri) => {
    let runId: string | undefined;
    let target: string | undefined;
    let lastRunAt: number | undefined;
    if (typeof arg === 'string') {
      runId = arg;
    } else if (arg instanceof vscode.Uri) {
      target = arg.fsPath;
    } else if (arg && typeof arg === 'object') {
      runId = arg.id;
      target = arg.jmxPath;
      lastRunAt = arg.lastRunAt;
    }

    let run: TestRun | undefined;
    if (runId) {
      run = deps.runStore.getRun(runId);
    }

    if (!run && target) {
      const candidates = deps.runStore.list().filter((item) => item.jmxPath === target && item.summary.total > 0);
      if (candidates.length === 1) {
        run = candidates[0];
      } else if (lastRunAt !== undefined) {
        run = candidates.find((item) => {
          const started = item.startedAt;
          return started !== undefined && Math.abs(started - lastRunAt) < 60000;
        }) ?? candidates[0];
      } else {
        run = candidates[0];
      }
    }

    if (!run) {
      const recent = await deps.recentRunsStore.list();
      const entry = runId ? recent.find((item) => item.id === runId) : undefined;
      const targetEntry = entry ?? (target && lastRunAt !== undefined ? recent.find((item) => item.jmxPath === target && Math.abs(item.lastRunAt - lastRunAt) < 60000) : undefined);
      if (targetEntry?.jtlPath && fs.existsSync(targetEntry.jtlPath)) {
        const samples = await deps.runner.parseSampleFile(targetEntry.jtlPath);
        const summary = {
          total: samples.length,
          passed: samples.filter((s) => s.success !== false).length,
          failed: samples.filter((s) => s.success === false).length,
          filePath: targetEntry.jmxPath
        };
        run = {
          id: targetEntry.id,
          jmxPath: targetEntry.jmxPath,
          startedAt: targetEntry.lastRunAt,
          completedAt: targetEntry.lastRunAt,
          summary,
          samples,
          jtlPath: targetEntry.jtlPath
        };
      }
    }

    if (run) {
      deps.resultsPanel.createOrShow();
      deps.resultsPanel.postMessage({ type: 'results', run });
      return;
    }
    target = target ?? deps.currentPlanPath.value;
    if (target && fs.existsSync(target)) {
      await vscode.commands.executeCommand('jmeter.selectTestPlan', vscode.Uri.file(target));
    }
  }));

  context.subscriptions.push(vscode.commands.registerCommand('jmeter.runTestPlan', async (arg?: vscode.Uri | { jmxPath?: string } | string) => {
    let uri: vscode.Uri | undefined;
    if (typeof arg === 'string') {
      uri = vscode.Uri.file(arg);
    } else if (arg instanceof vscode.Uri) {
      uri = arg;
    } else if (arg && typeof arg.jmxPath === 'string') {
      uri = vscode.Uri.file(arg.jmxPath);
    }
    await vscode.commands.executeCommand('jmeter.runTest', uri);
  }));

  context.subscriptions.push(vscode.commands.registerCommand('jmeter.runTest', async (uri?: vscode.Uri) => {
    try {
      const resolved = await resolveJmxTarget(uri, deps.currentPlanPath.value);
      if (!resolved) {
        throw new Error('No JMeter test plan selected.');
      }
      setCurrentPlan(resolved);
      deps.resultsPanel.createOrShow();
      await deps.runController.start(resolved.fsPath);
      deps.recentRunsProvider.refresh();
      deps.testPlansProvider.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      deps.outputChannel.appendLine(`Run failed: ${message}`);
      deps.resultsPanel.postMessage({ type: 'error', message });
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

  context.subscriptions.push(vscode.commands.registerCommand('jmeter.removeRecent', async (arg?: vscode.Uri | { id?: string; jmxPath?: string; lastRunAt?: number } | string) => {
    let runId: string | undefined;
    let jmxPath: string | undefined;
    let lastRunAt: number | undefined;
    if (typeof arg === 'string') {
      runId = arg;
    } else if (arg instanceof vscode.Uri) {
      jmxPath = arg.fsPath;
    } else if (arg && typeof arg === 'object') {
      runId = arg.id;
      jmxPath = arg.jmxPath;
      lastRunAt = arg.lastRunAt;
    }

    const recent = await deps.recentRunsStore.list();
    let entry = runId ? recent.find((item) => item.id === runId) : undefined;
    if (!entry && jmxPath) {
      const candidates = recent.filter((item) => item.jmxPath === jmxPath);
      if (candidates.length === 1) {
        entry = candidates[0];
      } else if (lastRunAt !== undefined) {
        entry = candidates.find((item) => Math.abs(item.lastRunAt - lastRunAt) < 60000) ?? candidates[0];
      } else {
        entry = candidates[0];
      }
    }

    if (!entry) {
      return;
    }
    await deps.recentRunsStore.remove(entry.id);
    deps.recentRunsProvider.refresh();
  }));
}
