export interface StoragePort {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
export interface Codec<T> { decode(value: unknown): T }
export class SaveError extends Error {}
export class SaveRepository<T> {
  constructor(private storage: StoragePort, private codec: Codec<T>, private key = 'monster-workshop.save') {}
  load(): T | null {
    const raw = this.storage.getItem(this.key);
    if (!raw) return null;
    try {
      const envelope: unknown = JSON.parse(raw);
      if (!isRecord(envelope) || envelope.schemaVersion !== 1) throw new SaveError('Unsupported save version. Export your save before resetting.');
      return this.codec.decode(envelope.data);
    } catch (error) { throw new SaveError(error instanceof Error ? error.message : 'Unreadable save'); }
  }
  write(data: T): void {
    // Decode before writing: every mutation crosses the same validation boundary as imports.
    const validated = this.codec.decode(data);
    try {
      const old = this.storage.getItem(this.key);
      if (old) this.storage.setItem(this.key + '.backup', old);
      this.storage.setItem(this.key, JSON.stringify({ schemaVersion: 1, savedAt: new Date().toISOString(), data: validated }));
    } catch { throw new SaveError('Your browser could not save. Free some storage and try again.'); }
  }
  export(): string { return this.storage.getItem(this.key) ?? ''; }
  import(raw: string): T {
    const envelope: unknown = JSON.parse(raw);
    if (!isRecord(envelope) || envelope.schemaVersion !== 1) throw new SaveError('Unsupported save version');
    const data = this.codec.decode(envelope.data);
    this.write(data);
    return data;
  }
  restoreBackup(): T {
    const backup = this.storage.getItem(this.key + '.backup');
    if (!backup) throw new SaveError('No backup is available');
    return this.import(backup);
  }
}
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
