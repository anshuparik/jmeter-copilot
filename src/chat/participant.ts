import * as vscode from 'vscode';

export class JMeterChatParticipant {
  public register(context: vscode.ExtensionContext): void {
    const participant = vscode.chat.createChatParticipant('jmeter.participant', async (request, _context, stream) => {
      const text = request.prompt ?? '';
      if (text.includes('/run')) {
        const target = text.match(/([A-Za-z0-9_./\\-]+\.jmx)/)?.[1] ?? 'current workspace plan';
        stream.markdown(`I would run the JMeter plan for ${target}.`);
      } else if (text.includes('/failures')) {
        stream.markdown('I would inspect the latest JMeter run and list the failing samples with details.');
      } else if (text.includes('/fix')) {
        stream.markdown('I would summarize the failing samples and suggest likely fixes such as adjusting assertions, sample labels, or script logic.');
      } else {
        stream.markdown('Use /run, /failures, or /fix to interact with JMeter from chat.');
      }
    });
    context.subscriptions.push(participant);
  }
}
