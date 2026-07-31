import * as vscode from 'vscode';
import { JMeterRunner } from '../jmeter/runner';
import { RunStore } from '../model/runStore';
import { getJmeterFailures } from './getJmeterFailures';
import { getJmeterSampleDetail } from './getJmeterSampleDetail';
import { listJmeterTests } from './listJmeterTests';
import { runJmeterTest } from './runJmeterTest';

export function registerTools(context: vscode.ExtensionContext, runner: JMeterRunner, runStore: RunStore): void {
  const tools = [
    vscode.lm.registerTool('run_jmeter_test', {
      invoke: async (options: vscode.LanguageModelToolInvocationOptions<unknown>) => {
        const planPath = (options.input as { planPath?: string } | undefined)?.planPath;
        if (!planPath) {
          return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart('No plan path provided.')]);
        }
        const message = await runJmeterTest(runner, planPath);
        return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(message)]);
      }
    }),
    vscode.lm.registerTool('get_jmeter_failures', {
      invoke: async () => {
        const text = getJmeterFailures(runStore);
        return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(text)]);
      }
    }),
    vscode.lm.registerTool('get_jmeter_sample_detail', {
      invoke: async (options: vscode.LanguageModelToolInvocationOptions<unknown>) => {
        const label = (options.input as { label?: string } | undefined)?.label ?? '';
        const text = getJmeterSampleDetail(runStore, label);
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
