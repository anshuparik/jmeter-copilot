import { RunStore } from '../model/runStore';
import { SampleResult } from '../model/types';

function flattenSamples(samples: SampleResult[]): SampleResult[] {
  const result: SampleResult[] = [];
  for (const s of samples) {
    result.push(s);
    if (s.subResults && s.subResults.length > 0) {
      result.push(...flattenSamples(s.subResults));
    }
  }
  return result;
}

export function getJmeterSampleDetail(runStore: RunStore, label: string, runId?: string): string {
  const run = runStore.getRun(runId);
  if (!run) {
    return 'No JMeter run available.';
  }

  const allSamples = flattenSamples(run.samples);
  const match = allSamples.find((sample) => sample.label === label);
  if (!match) {
    const available = allSamples
      .map((s) => s.label)
      .filter(Boolean)
      .join(', ');
    return `No sample found for label: "${label}". Available labels: ${available || 'none'}`;
  }

  return JSON.stringify(match, null, 2);
}

