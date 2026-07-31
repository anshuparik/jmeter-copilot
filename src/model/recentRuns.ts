import * as vscode from 'vscode';

export interface RecentRunEntry {
  jmxPath: string;
  lastRunAt: number;
  passed: number;
  failed: number;
  total: number;
}

export class RecentRunsStore {
  private readonly key = 'jmeter.recentRuns';
  private readonly maxEntries = 15;

  constructor(private readonly context: vscode.ExtensionContext) {}

  public async list(): Promise<RecentRunEntry[]> {
    const value = this.context.globalState.get<RecentRunEntry[]>(this.key, []);
    return value.slice(0, this.maxEntries);
  }

  public async add(entry: RecentRunEntry): Promise<void> {
    const items = await this.list();
    const filtered = items.filter((item) => item.jmxPath !== entry.jmxPath);
    filtered.unshift(entry);
    await this.context.globalState.update(this.key, filtered.slice(0, this.maxEntries));
  }

  public async remove(jmxPath: string): Promise<void> {
    const items = await this.list();
    const filtered = items.filter((item) => item.jmxPath !== jmxPath);
    await this.context.globalState.update(this.key, filtered);
  }

  public async clear(): Promise<void> {
    await this.context.globalState.update(this.key, []);
  }
}
