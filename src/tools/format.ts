export function formatSummary(total: number, passed: number, failed: number): string {
  return `Passed ${passed}/${total}; Failed ${failed}/${total}`;
}
