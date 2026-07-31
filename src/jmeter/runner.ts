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

  constructor(
    private readonly outputChannel: vscode.OutputChannel,
    private readonly runStore: RunStore,
    private readonly recentRunsStore: RecentRunsStore
  ) {}

  public async run(jmxPath: string, pollCallback?: (jtlPath: string) => void): Promise<TestRun> {
    const startedAt = Date.now();
    const resolvedPath = path.resolve(jmxPath);
    const resultsDir = this.getResultsDir();
    fs.mkdirSync(resultsDir, { recursive: true });
    const jtlPath = path.join(resultsDir, `${path.basename(resolvedPath, '.jmx')}.jtl`);
    const logPath = path.join(resultsDir, `${path.basename(resolvedPath, '.jmx')}.log`);
    const capturePropsPath = path.join(resultsDir, 'capture.properties');

    fs.rmSync(jtlPath, { force: true });
    fs.rmSync(logPath, { force: true });

    this.writeCaptureProperties(capturePropsPath);

    const executable = await JMeterLocator.resolve();
    const args = ['-n', '-t', resolvedPath, '-l', jtlPath, '-j', logPath, '-q', capturePropsPath];
    const command = executable;

    const run: TestRun = {
      id: `${Date.now()}`,
      jmxPath: resolvedPath,
      startedAt,
      summary: { total: 0, passed: 0, failed: 0, filePath: resolvedPath },
      samples: [],
      jtlPath,
      logPath
    };
    this.runStore.add(run);
    this.outputChannel.appendLine(`Running ${resolvedPath}`);
    this.outputChannel.appendLine(`JMeter: ${executable}`);
    this.outputChannel.appendLine(`Results dir: ${resultsDir}`);

    let child;
    try {
      child = await SpawnJmeter.run(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (error) {
      throw new Error(`Failed to start JMeter: ${error instanceof Error ? error.message : String(error)}`);
    }
    this.currentProcess = child;
    this.outputChannel.appendLine(`Spawned JMeter (PID ${child.pid ?? 'unknown'}), waiting for it to finish...`);
    pollCallback?.(jtlPath);

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

    const exitCode = await new Promise<number | null>((resolve, reject) => {
      child.once('error', (error: Error) => reject(new Error(error.message)));
      child.once('close', (code: number | null) => resolve(code ?? null));
    });

    this.outputChannel.appendLine(`JMeter exited (code ${exitCode}) after ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);

    const samples = await this.parseSampleFile(jtlPath);
    const summary = this.computeSummary(samples);
    run.summary = { ...summary, filePath: resolvedPath, startedAt: run.startedAt, completedAt: Date.now() };
    run.samples = samples;
    run.completedAt = Date.now();
    this.currentProcess = undefined;
    this.runStore.add(run);
    this.outputChannel.appendLine(`Run complete: ${summary.total} samples (${summary.passed} passed, ${summary.failed} failed)`);
    await this.recentRunsStore.add({
      id: run.id,
      jmxPath: resolvedPath,
      lastRunAt: Date.now(),
      passed: summary.passed,
      failed: summary.failed,
      total: summary.total,
      jtlPath
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

  public async parseSampleFile(jtlPath: string): Promise<SampleResult[]> {
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
      'jmeter.save.saveservice.output_format=xml',
      'autoflush=true',
      captureResponseData ? 'jmeter.save.saveservice.response_data=true' : 'jmeter.save.saveservice.response_data=false',
      captureResponseData ? 'jmeter.save.saveservice.requestHeaders=true' : 'jmeter.save.saveservice.requestHeaders=false',
      captureResponseData ? 'jmeter.save.saveservice.responseHeaders=true' : 'jmeter.save.saveservice.responseHeaders=false',
      captureResponseData ? 'jmeter.save.saveservice.samplerData=true' : 'jmeter.save.saveservice.samplerData=false',
      captureResponseData ? 'jmeter.save.saveservice.assertions=true' : 'jmeter.save.saveservice.assertions=false',
      `jmeter.save.saveservice.response_data.max_size=${maxResponseBytes}`
    ];
    fs.writeFileSync(target, lines.join('\n'));
  }
}
