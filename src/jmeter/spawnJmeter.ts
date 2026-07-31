import * as cp from 'child_process';

function quoteArg(value: string): string {
  if (!value) return '""';
  return /[\s"'&|<>^()]/.test(value) ? `"${value.replace(/"/g, '\\"')}"` : value;
}

export class SpawnJmeter {
  public static async run(command: string, args: string[], options: cp.SpawnOptions = {}): Promise<cp.ChildProcess> {
    if (process.platform === 'win32') {
      const fullCmd = this.buildCommand(command, args);
      return cp.spawn(fullCmd, [], { ...options, shell: true, windowsHide: true });
    }
    return cp.spawn(command, args, { ...options, windowsHide: true });
  }

  public static async runSync(
    command: string,
    args: string[],
    options: cp.SpawnOptions = {}
  ): Promise<{ stdout: string; stderr: string; status: number | null }> {
    if (process.platform === 'win32') {
      const fullCmd = this.buildCommand(command, args);
      const result = cp.spawnSync(fullCmd, [], { ...options, shell: true, encoding: 'utf8' });
      return {
        stdout: result.stdout || '',
        stderr: result.stderr || '',
        status: result.status
      };
    }
    const result = cp.spawnSync(command, args, { ...options, encoding: 'utf8' });
    return {
      stdout: result.stdout || '',
      stderr: result.stderr || '',
      status: result.status
    };
  }

  public static buildCommand(command: string, args: string[]): string {
    return [quoteArg(command), ...args.map(quoteArg)].join(' ');
  }
}

