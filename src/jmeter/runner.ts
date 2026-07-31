import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as vscode from 'vscode';
import { RunStore } from '../model/runStore';
import { RecentRunsStore } from '../model/recentRuns';
import { SampleResult, TestRun } from '../model/types';
import { JtlParser } from './jtlParser';
import { JMeterLocator } from './locator';
import { SpawnJmeter } from './spawnJmeter';

export class JMeterRunner {
  private currentProcess?: any;
  public run: (jmxPath: string) => Promise<TestRun>;

  constructor(
    private readonly outputChannel: vscode.OutputChannel,
    private readonly runStore: RunStore,
    private readonly recentRunsStore: RecentRunsStore
  ) {
    this.run = this.runInternal.bind(this);
  }

  public async runInternal(jmxPath: string): Promise<TestRun> {
    const resolvedPath = path.resolve(jmxPath);
    const resultsDir = this.getResultsDir();
    fs.mkdirSync(resultsDir, { recursive: true });
    const jtlPath = path.join(resultsDir, `${path.basename(resolvedPath, '.jmx')}.jtl`);
    const logPath = path.join(resultsDir, `${path.basename(resolvedPath, '.jmx')}.log`);
    const capturePropsPath = path.join(resultsDir, 'capture.properties');

    this.writeCaptureProperties(capturePropsPath);

    const executable = await JMeterLocator.resolve();
    const args = ['-n', '-t', resolvedPath, '-l', jtlPath, '-j', logPath, '-q', capturePropsPath];
    const command = process.platform === 'win32' ? executable : executable;

    const run: TestRun = {
      id: `${Date.now()}`,
      jmxPath: resolvedPath,
      startedAt: Date.now(),
      summary: { total: 0, passed: 0, failed: 0, filePath: resolvedPath },
      samples: [],
      jtlPath,
      logPath
    };
    this.runStore.add(run);
    this.outputChannel.appendLine(`Running ${resolvedPath}`);

    const child = await SpawnJmeter.run(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    this.currentProcess = child;

    if (child.stdout) {
      child.stdout.on('data', (data: Buffer) => {
        this.outputChannel.appendLine(data.toString());
      });
    }
    if (child.stderr) {
      child.stderr.on('data', (data: Buffer) => {
        this.outputChannel.appendLine(data.toString());
      });
    }

    await new Promise<number | null>((resolve) => {
      child.on('exit', (code: number | null) => resolve(code));
    });

    const samples = this.parseSamples(jtlPath);
    const summary = this.computeSummary(samples);
    run.summary = { ...summary, filePath: resolvedPath, startedAt: run.startedAt, completedAt: Date.now() };
    run.samples = samples;
    run.completedAt = Date.now();
    this.currentProcess = undefined;
    this.runStore.add(run);
    await this.recentRunsStore.add({
      jmxPath: resolvedPath,
      lastRunAt: Date.now(),
      passed: summary.passed,
      failed: summary.failed,
      total: summary.total
    });
    return run;
  }

  public stop(): void {
    if (this.currentProcess) {
      if (process.platform === 'win32') {
        const pid = this.currentProcess.pid;
        if (pid) {
          require('child_process').execFileSync('taskkill', ['/PID', String(pid), '/T', '/F']);
        }
      } else {
        this.currentProcess.kill('SIGTERM');
      }
    }
  }

  private parseSamples(jtlPath: string): SampleResult[] {
    if (!fs.existsSync(jtlPath)) {
      return [];
    }
    return JtlParser.parseFile(jtlPath);
  }

  private computeSummary(samples: SampleResult[]): { total: number; passed: number; failed: number } {
    const total = samples.length;
    const passed = samples.filter((sample) => sample.success !== false).length;
    const failed = total - passed;
    return { total, passed, failed };
  }

  private getResultsDir(): string {
    const config = vscode.workspace.getConfiguration('jmeter');
    const configured = config.get<string>('resultsDirectory', '').trim();
    if (configured) {
      return path.resolve(configured);
    }
    const workspace = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (workspace) {
      return path.join(workspace, '.jmeter-runs');
    }
    return path.join(os.tmpdir(), 'jmeter-runs');
  }

  private writeCaptureProperties(target: string): void {
    const captureResponseData = vscode.workspace.getConfiguration('jmeter').get<boolean>('captureResponseData', true);
    const maxResponseBytes = vscode.workspace.getConfiguration('jmeter').get<number>('maxResponseBytes', 100000);
    const lines = [
      'output_format=xml',
      'autoflush=true',
      captureResponseData ? 'jmeter.save.saveservice.response_data=true' : 'jmeter.save.saveservice.response_data=false',
      captureResponseData ? 'jmeter.save.saveservice.request_headers=true' : 'jmeter.save.saveservice.request_headers=false',
      captureResponseData ? 'jmeter.save.saveservice.response_headers=true' : 'jmeter.save.saveservice.response_headers=false',
      captureResponseData ? 'jmeter.save.saveservice.samplerData=true' : 'jmeter.save.saveservice.samplerData=false',
      captureResponseData ? 'jmeter.save.saveservice.assertions=true' : 'jmeter.save.saveservice.assertions=false',
      `jmeter.save.saveservice.response_data.max_size=${maxResponseBytes}`
    ];
    fs.writeFileSync(target, lines.join('\n'));
  }
}
