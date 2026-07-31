import { RunStore } from '../model/runStore';

export function getJmeterSampleDetail(runStore: RunStore, label: string): string {
  const latest = runStore.latest();
  if (!latest) {
    return 'No JMeter run available.';
  }

  const match = latest.samples.find((sample) => sample.label === label);
  if (!match) {
    return `No sample found for label: ${label}`;
  }

  return JSON.stringify(match, null, 2);
}
