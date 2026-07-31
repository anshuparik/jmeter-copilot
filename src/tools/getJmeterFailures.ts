import { RunStore } from '../model/runStore';

export function getJmeterFailures(runStore: RunStore): string {
  const latest = runStore.latest();
  if (!latest) {
    return 'No JMeter run available.';
  }

  const failed = latest.samples.filter((sample) => sample.success === false);
  if (!failed.length) {
    return 'No failing samples.';
  }

  return failed.map((sample) => `${sample.label ?? 'unnamed'}: ${sample.responseMessage ?? 'no message'}`).join('\n');
}
