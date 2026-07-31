import * as cp from 'child_process';

function quoteArg(value: string): string {
  return /[\s"'&|<>^()]/.test(value) ? `"${value.replace(/"/g, '\\"')}"` : value;
}

export class SpawnJmeter {
  public static async run(command: string, args: string[], options: cp.SpawnOptions = {}): Promise<cp.ChildProcess> {
    const shell = process.platform === 'win32' ? true : !!options.shell;
    return cp.spawn(command, args, { ...options, shell, windowsHide: true });
  }

  public static async runSync(command: string, args: string[], options: cp.SpawnOptions = {}): Promise<{ stdout: string; stderr: string; status: number | null }> {
    const shell = process.platform === 'win32' ? true : !!options.shell;
    const result = cp.spawnSync(command, args, { ...options, shell, encoding: 'utf8' });
    return {
      stdout: result.stdout || '',
      stderr: result.stderr || '',
      status: result.status
    };
  }

  public static buildCommand(command: string, args: string[]): string {
    return [command, ...args.map(quoteArg)].join(' ');
  }
}
