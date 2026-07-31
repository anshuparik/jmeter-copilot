import * as fs from 'fs';
import * as path from 'path';
import * as cp from 'child_process';
import * as vscode from 'vscode';

export class JMeterLocator {
  public static async resolve(): Promise<string> {
    const config = vscode.workspace.getConfiguration('jmeter');
    const configuredPath = config.get<string>('executablePath', '').trim();
    if (configuredPath) {
      return configuredPath;
    }

    const jmeterHome = config.get<string>('jmeterHome', '').trim();
    if (jmeterHome) {
      const bat = path.join(jmeterHome, 'bin', process.platform === 'win32' ? 'jmeter.bat' : 'jmeter');
      if (fs.existsSync(bat)) {
        return bat;
      }
    }

    const envHome = process.env.JMETER_HOME;
    if (envHome) {
      const envPath = path.join(envHome, 'bin', process.platform === 'win32' ? 'jmeter.bat' : 'jmeter');
      if (fs.existsSync(envPath)) {
        return envPath;
      }
    }

    const search = process.platform === 'win32' ? 'where' : 'which';
    try {
      const output = cp.execFileSync(search, ['jmeter'], { encoding: 'utf8' });
      const first = output.split(/\r?\n/).map((value) => value.trim()).find(Boolean);
      if (first) {
        return first;
      }
    } catch {
      // ignore and throw below
    }

    throw new Error('Unable to locate JMeter executable. Set jmeter.executablePath or jmeter.jmeterHome.');
  }

  public static async detectVersion(executablePath: string): Promise<string> {
    const result = cp.execFileSync(executablePath, ['-v'], { encoding: 'utf8' });
    return result.trim().split(/\r?\n/)[0] || 'unknown';
  }
}
