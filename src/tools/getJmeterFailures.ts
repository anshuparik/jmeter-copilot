import { RunStore } from '../model/runStore';

export function getJmeterFailures(runStore: RunStore, runId?: string): string {
  const run = runStore.getRun(runId);
  if (!run) {
    return 'No JMeter run available.';
  }

  const findFailingSamples = (samples: any[]): any[] => {
    let result: any[] = [];
    for (const s of samples) {
      if (s.success === false) {
        result.push(s);
      }
      if (s.subResults && s.subResults.length > 0) {
        result.push(...findFailingSamples(s.subResults));
      }
    }
    return result;
  };

  const failed = findFailingSamples(run.samples);
  if (!failed.length) {
    return `No failing samples found in run ${run.id} (${run.jmxPath}).`;
  }

  return failed
    .map((s) => {
      const assertionsStr = s.assertions?.map((a: any) => `  - Assertion (${a.name || 'unnamed'}): ${a.failureMessage || 'failed'}`).join('\n') || '';
      return `Sample: ${s.label || 'unnamed'}
Status: ${s.responseCode || 'FAIL'} ${s.responseMessage || ''}
URL: ${s.url || 'N/A'}
Thread: ${s.thread || 'N/A'}
Elapsed: ${s.elapsed ?? 0}ms, Latency: ${s.latency ?? 0}ms
${assertionsStr ? 'Assertions:\n' + assertionsStr + '\n' : ''}Response Data:
${s.responseData || 'No response data'}
---`;
    })
    .join('\n');
}

