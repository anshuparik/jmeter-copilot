import { JMeterRunner } from '../jmeter/runner';

export async function runJmeterTest(runner: JMeterRunner, planPath: string): Promise<string> {
  const run = await runner.run(planPath);
  return `Ran ${run.jmxPath} with ${run.summary.total} samples.`;
}
