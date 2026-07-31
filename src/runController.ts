import * as fs from 'fs';
import * as vscode from 'vscode';
import { JMeterRunner } from './jmeter/runner';
import { RunStore } from './model/runStore';
import { TestRun, SampleResult } from './model/types';

export type RunStatus = 'idle' | 'running' | 'done';

export interface RunState {
  status: RunStatus;
  currentPlan?: string;
  sampleCount?: number;
  summary?: { total: number; passed: number; failed: number };
}

export class RunController implements vscode.Disposable {
  private pollTimer?: NodeJS.Timeout;
  private state: RunState = { status: 'idle' };
  private readonly _onDidChangeState = new vscode.EventEmitter<RunState>();
  private readonly _onDidUpdateSamples = new vscode.EventEmitter<{ total: number; passed: number; failed: number; samples?: SampleResult[] }>();
  private readonly _onDidFinish = new vscode.EventEmitter<TestRun>();

  public readonly onDidChangeState = this._onDidChangeState.event;
  public readonly onDidUpdateSamples = this._onDidUpdateSamples.event;
  public readonly onDidFinish = this._onDidFinish.event;

  constructor(private readonly runner: JMeterRunner, private readonly runStore: RunStore) {}

  public get currentState(): RunState {
    return this.state;
  }

  public async start(jmxPath: string): Promise<TestRun> {
    this.stopPolling();
    this.state = { status: 'running', currentPlan: jmxPath, sampleCount: 0, summary: { total: 0, passed: 0, failed: 0 } };
    this._onDidChangeState.fire(this.state);

    const run = await this.runner.run(jmxPath, (jtlPath) => this.pollFile(jtlPath));
    this.runStore.add(run);
    this.state = { status: 'done', currentPlan: jmxPath, summary: run.summary, sampleCount: run.summary.total };
    this._onDidChangeState.fire(this.state);
    this._onDidFinish.fire(run);
    return run;
  }

  public stop(): void {
    this.runner.stop();
    this.stopPolling();
    if (this.state.status === 'running') {
      this.state = { status: 'idle', currentPlan: this.state.currentPlan };
      this._onDidChangeState.fire(this.state);
    }
  }

  public clear(): void {
    this.stopPolling();
    this.state = { status: 'idle' };
    this._onDidChangeState.fire(this.state);
  }

  public async pollFile(jtlPath: string): Promise<void> {
    this.stopPolling();
    this.pollTimer = setInterval(async () => {
      try {
        const summary = await this.computeSummary(jtlPath);
        this._onDidUpdateSamples.fire(summary);
      } catch {
        // ignore polling parse errors
      }
    }, 1000);
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = undefined;
    }
  }

  private async computeSummary(jtlPath: string): Promise<{ total: number; passed: number; failed: number; samples?: SampleResult[] }> {
    if (!fs.existsSync(jtlPath)) {
      return { total: 0, passed: 0, failed: 0 };
    }

    const stats = fs.statSync(jtlPath);
    if (stats.size > 15 * 1024 * 1024) {
      const content = fs.readFileSync(jtlPath, 'utf8');
      const total = (content.match(/<httpSample|<sample/g) || []).length;
      const passed = (content.match(/s="true"/g) || []).length;
      const failed = Math.max(0, total - passed);
      return { total, passed, failed };
    }

    const samples = await this.runner.parseSampleFile(jtlPath);
    const total = samples.length;
    const passed = samples.filter((sample) => sample.success !== false).length;
    const failed = total - passed;
    return { total, passed, failed, samples };
  }

  public dispose(): void {
    this.stopPolling();
    this._onDidChangeState.dispose();
    this._onDidUpdateSamples.dispose();
    this._onDidFinish.dispose();
  }
}
