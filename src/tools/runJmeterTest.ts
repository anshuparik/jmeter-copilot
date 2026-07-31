import { RunController } from '../runController';
import { JMeterRunner } from '../jmeter/runner';

export async function runJmeterTest(controllerOrRunner: RunController | JMeterRunner, planPath: string): Promise<string> {
  const run = 'start' in controllerOrRunner ? await controllerOrRunner.start(planPath) : await controllerOrRunner.run(planPath);
  return `Ran ${run.jmxPath} with ${run.summary.total} samples (${run.summary.passed} passed, ${run.summary.failed} failed). Run ID: ${run.id}`;
}

