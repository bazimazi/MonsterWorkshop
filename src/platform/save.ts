import { exceedsUtf8Limit } from '../domain/validation.js';

export interface StoragePort {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
export interface Codec<T> {
  decode(value: unknown): T;
}
export class SaveError extends Error {}
export class SaveConflictError extends SaveError {
  constructor() {
    super('Your saved workshop changed. Reload the latest workshop before continuing.');
  }
}
export const SAVE_KEY = 'monster-workshop.save';
export const MAX_SAVE_BYTES = 64 * 1024 * 1024;
export const SAVE_SIZE_ERROR = 'Save file is too large (maximum 64 MiB).';
export class SaveRepository<T> {
  private validatedRaw: string | undefined;
  private observedRaw: string | null = null;
  constructor(
    private storage: StoragePort,
    private codec: Codec<T>,
    private key = SAVE_KEY,
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
      if (exceedsUtf8Limit(raw, MAX_SAVE_BYTES)) throw new SaveError(SAVE_SIZE_ERROR);
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
    // Even missing or damaged records establish a baseline for creation/recovery.
    this.observedRaw = raw;
    if (raw === null) return null;
    const data = this.decode(raw);
    this.validatedRaw = raw;
    return data;
  }
  write(data: T): void {
    // Decode before writing: every mutation crosses the same validation boundary as imports.
    const validated = this.codec.decode(data);
    const raw = JSON.stringify({
      schemaVersion: 1,
      savedAt: new Date().toISOString(),
      data: validated,
    });
    if (exceedsUtf8Limit(raw, MAX_SAVE_BYTES)) throw new SaveError(SAVE_SIZE_ERROR);
    const old = this.read(this.key);
    if (old !== this.observedRaw) throw new SaveConflictError();
    try {
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
      this.storage.setItem(this.key, raw);
      this.validatedRaw = raw;
      this.observedRaw = raw;
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
