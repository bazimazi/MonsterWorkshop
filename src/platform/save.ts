export interface StoragePort {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
export interface Codec<T> {
  decode(value: unknown): T;
}
export class SaveError extends Error {}
export class SaveRepository<T> {
  private validatedRaw: string | undefined;
  constructor(
    private storage: StoragePort,
    private codec: Codec<T>,
    private key = 'monster-workshop.save',
  ) {}
  private read(key: string): string | null {
    try {
      return this.storage.getItem(key);
    } catch {
      throw new SaveError(
        'Your browser could not read saved data. Check its storage settings and try again.',
      );
    }
  }
  private decode(raw: string): T {
    try {
      const envelope: unknown = JSON.parse(raw);
      if (!isRecord(envelope) || envelope.schemaVersion !== 1)
        throw new SaveError('Unsupported save version. Export your save before resetting.');
      return this.codec.decode(envelope.data);
    } catch (error) {
      throw new SaveError(error instanceof Error ? error.message : 'Unreadable save');
    }
  }
  load(): T | null {
    const raw = this.read(this.key);
    if (raw === null) return null;
    const data = this.decode(raw);
    this.validatedRaw = raw;
    return data;
  }
  write(data: T): void {
    // Decode before writing: every mutation crosses the same validation boundary as imports.
    const validated = this.codec.decode(data);
    try {
      const old = this.read(this.key);
      let validPrevious = old !== null && old === this.validatedRaw;
      if (old !== null && !validPrevious) {
        try {
          this.decode(old);
          validPrevious = true;
        } catch {
          // Recovery must not replace a usable backup with a damaged primary save.
        }
      }
      if (validPrevious) this.storage.setItem(this.key + '.backup', old!);
      const raw = JSON.stringify({
        schemaVersion: 1,
        savedAt: new Date().toISOString(),
        data: validated,
      });
      this.storage.setItem(this.key, raw);
      this.validatedRaw = raw;
    } catch {
      throw new SaveError('Your browser could not save. Free some storage and try again.');
    }
  }
  export(): string {
    return this.read(this.key) ?? '';
  }
  import(raw: string): T {
    const data = this.decode(raw);
    this.write(data);
    return data;
  }
  restoreBackup(): T {
    const backup = this.read(this.key + '.backup');
    if (backup === null) throw new SaveError('No backup is available');
    return this.import(backup);
  }
}
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
