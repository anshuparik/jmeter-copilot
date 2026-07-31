import { EventEmitter } from 'vscode';
import { TestRun } from './types';

export class RunStore {
  private runs: TestRun[] = [];
  private readonly maxRuns = 20;
  public readonly onDidChange = new EventEmitter<void>();

  public add(run: TestRun): void {
    this.runs = [run, ...this.runs.filter((item) => item.id !== run.id)].slice(0, this.maxRuns);
    this.onDidChange.fire();
  }

  public getRun(runId?: string): TestRun | undefined {
    if (!runId) {
      return this.latest();
    }
    return this.runs.find((run) => run.id === runId);
  }

  public latest(): TestRun | undefined {
    return this.runs[0];
  }

  public list(): TestRun[] {
    return [...this.runs];
  }

  public clear(): void {
    this.runs = [];
    this.onDidChange.fire();
  }
}
