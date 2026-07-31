import * as vscode from 'vscode';
import { JMeterRunner } from '../jmeter/runner';
import { RunController } from '../runController';
import { RunStore } from '../model/runStore';
import { getJmeterFailures } from './getJmeterFailures';
import { getJmeterSampleDetail } from './getJmeterSampleDetail';
import { listJmeterTests } from './listJmeterTests';
import { runJmeterTest } from './runJmeterTest';

export function registerTools(
  context: vscode.ExtensionContext,
  runner: JMeterRunner,
  runStore: RunStore,
  runController?: RunController
): void {
  const tools = [
    vscode.lm.registerTool('run_jmeter_test', {
      invoke: async (options: vscode.LanguageModelToolInvocationOptions<unknown>) => {
        const planPath = (options.input as { planPath?: string } | undefined)?.planPath;
        if (!planPath) {
          return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart('No plan path provided.')]);
        }
        const message = await runJmeterTest(runController ?? runner, planPath);
        return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(message)]);
      }
    }),
    vscode.lm.registerTool('get_jmeter_failures', {
      invoke: async (options: vscode.LanguageModelToolInvocationOptions<unknown>) => {
        const runId = (options.input as { runId?: string } | undefined)?.runId;
        const text = getJmeterFailures(runStore, runId);
        return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(text)]);
      }
    }),
    vscode.lm.registerTool('get_jmeter_sample_detail', {
      invoke: async (options: vscode.LanguageModelToolInvocationOptions<unknown>) => {
        const input = options.input as { label?: string; runId?: string } | undefined;
        const label = input?.label ?? '';
        const runId = input?.runId;
        const text = getJmeterSampleDetail(runStore, label, runId);
        return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(text)]);
      }
    }),
    vscode.lm.registerTool('list_jmeter_tests', {
      invoke: async () => {
        const tests = await listJmeterTests();
        const text = tests.join('\n');
        return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(text)]);
      }
    })
  ];

  context.subscriptions.push(...tools);
}

