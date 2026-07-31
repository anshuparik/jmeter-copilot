import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as cp from 'child_process';
import * as vscode from 'vscode';

export class JMeterLocator {
  public static async resolve(): Promise<string> {
    const config = vscode.workspace.getConfiguration('jmeter');
    const configuredPath = config.get<string>('executablePath', '').trim();
    if (configuredPath && fs.existsSync(configuredPath)) {
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
      if (first && fs.existsSync(first)) {
        return first;
      }
    } catch {
      // ignore
    }

    // Common installation fallback locations
    const candidateDirs: string[] = [];
    const homeDir = os.homedir();
    const isWin = process.platform === 'win32';
    const binName = isWin ? 'jmeter.bat' : 'jmeter';

    if (isWin) {
      candidateDirs.push('C:\\Software', 'C:\\jmeter', 'C:\\Program Files');
    }
    candidateDirs.push(path.join(homeDir, 'Downloads'), path.join(homeDir, 'software'), path.join(homeDir, 'Tools'));

    for (const baseDir of candidateDirs) {
      if (!fs.existsSync(baseDir)) continue;
      try {
        const entries = fs.readdirSync(baseDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory() && entry.name.toLowerCase().includes('jmeter')) {
            const level1 = path.join(baseDir, entry.name);
            const directBin = path.join(level1, 'bin', binName);
            if (fs.existsSync(directBin)) return directBin;

            // Check nested folder (e.g. apache-jmeter-5.6.3/apache-jmeter-5.6.3/bin/jmeter.bat)
            const subEntries = fs.readdirSync(level1, { withFileTypes: true });
            for (const sub of subEntries) {
              if (sub.isDirectory() && sub.name.toLowerCase().includes('jmeter')) {
                const nestedBin = path.join(level1, sub.name, 'bin', binName);
                if (fs.existsSync(nestedBin)) return nestedBin;
              }
            }
          }
        }
      } catch {
        // ignore permission errors
      }
    }

    throw new Error('Unable to locate JMeter executable. Please configure "jmeter.jmeterHome" or "jmeter.executablePath" in settings.');
  }

  public static async detectVersion(executablePath: string): Promise<string> {
    const result = cp.execFileSync(executablePath, ['-v'], { encoding: 'utf8' });
    return result.trim().split(/\r?\n/)[0] || 'unknown';
  }
}

