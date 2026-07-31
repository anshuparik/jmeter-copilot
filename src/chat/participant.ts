import * as vscode from 'vscode';
import { RunController } from '../runController';
import { RunStore } from '../model/runStore';
import { getJmeterFailures } from '../tools/getJmeterFailures';
import { resolveJmxTarget } from '../util/jmxResolver';

export class JMeterChatParticipant {
  constructor(private readonly runController?: RunController, private readonly runStore?: RunStore) {}

  public register(context: vscode.ExtensionContext): void {
    const participant = vscode.chat.createChatParticipant('jmeter.participant', async (request, _context, stream) => {
      const text = request.prompt ?? '';
      const command = request.command;

      if (command === 'run' || text.includes('/run')) {
        const jmxMatch = text.match(/([A-Za-z0-9_./\\-]+\.jmx)/i)?.[1];
        let targetUri: vscode.Uri | undefined;

        if (jmxMatch) {
          const files = await vscode.workspace.findFiles(`**/${jmxMatch}`);
          targetUri = files[0];
        }

        if (!targetUri) {
          targetUri = await resolveJmxTarget();
        }

        if (!targetUri) {
          stream.markdown('❌ No JMeter test plan found to run.');
          return;
        }

        stream.markdown(`🚀 Starting execution of **${targetUri.fsPath}**...\n\n`);
        if (this.runController) {
          try {
            const run = await this.runController.start(targetUri.fsPath);
            const statusIcon = run.summary.failed > 0 ? '❌' : '✅';
            stream.markdown(
              `${statusIcon} **Run Completed!**\n\n- **Total Samples**: ${run.summary.total}\n- **Passed**: ${run.summary.passed}\n- **Failed**: ${run.summary.failed}\n\nUse \`/failures\` to inspect errors.`
            );
          } catch (err) {
            stream.markdown(`❌ Run failed: ${err instanceof Error ? err.message : String(err)}`);
          }
        } else {
          stream.markdown(`Configured plan: \`${targetUri.fsPath}\`.`);
        }
        return;
      }

      if (command === 'failures' || text.includes('/failures')) {
        if (!this.runStore) {
          stream.markdown('No run store configured.');
          return;
        }
        const failuresReport = getJmeterFailures(this.runStore);
        stream.markdown(`### 🔍 JMeter Failure Details\n\n\`\`\`text\n${failuresReport}\n\`\`\``);
        return;
      }

      if (command === 'fix' || text.includes('/fix')) {
        if (!this.runStore) {
          stream.markdown('No run store configured.');
          return;
        }
        const latest = this.runStore.latest();
        if (!latest) {
          stream.markdown('No recent run available to analyze for fixes.');
          return;
        }
        const failuresReport = getJmeterFailures(this.runStore);
        if (latest.summary.failed === 0) {
          stream.markdown(`✅ The latest run of \`${latest.jmxPath}\` passed completely (${latest.summary.passed}/${latest.summary.total}). No fixes needed!`);
          return;
        }

        stream.markdown(`### 🛠️ Suggested Fixes for \`${latest.jmxPath}\`\n\n`);
        stream.markdown(`The run failed with **${latest.summary.failed}** error(s):\n\n\`\`\`text\n${failuresReport}\n\`\`\`\n\n**Recommended Action Plan:**\n1. **401 Unauthorized / Authentication**: Verify your test plan headers contain valid auth tokens or credentials.\n2. **Assertion Failures**: Review expectation assertions in the JMX test script for mismatched status codes or response strings.\n3. **Network / Host Timeout**: Ensure the target backend endpoint is reachable from your network.`);
        return;
      }

      stream.markdown('### JMeter Copilot Assistance\n\nAvailable commands:\n- `/run [plan.jmx]` - Run a JMeter test plan\n- `/failures` - Show detailed list of failing samples\n- `/fix` - Analyze failures and suggest fixes');
    });

    context.subscriptions.push(participant);
  }
}

