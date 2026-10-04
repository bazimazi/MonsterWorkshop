export class DomainError extends Error {}
export function exceedsUtf8Limit(value: string, maximumBytes: number): boolean {
  // UTF-8 uses at least one and at most three bytes per UTF-16 code unit.
  if (value.length > maximumBytes) return true;
  if (value.length * 3 <= maximumBytes) return false;
  return new TextEncoder().encode(value).byteLength > maximumBytes;
}
export function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new DomainError(`${label} must be an object`);
  return value as Record<string, unknown>;
}
export function number(
  value: unknown,
  label: string,
  minimum = 0,
  maximum = Number.MAX_SAFE_INTEGER,
  integer = false,
): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < minimum ||
    value > maximum ||
    (integer && !Number.isSafeInteger(value))
  )
    throw new DomainError(`${label} is out of range`);
  return value;
}
export function string(value: unknown, label: string, max = 200): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max)
    throw new DomainError(`${label} must be nonempty text`);
  return value;
}
export function list(value: unknown, label: string, max = 1000): unknown[] {
  if (!Array.isArray(value) || value.length > max)
    throw new DomainError(`${label} must be a bounded array`);
  return value;
}
export function strings(value: unknown, label: string, max = 1000): string[] {
  return list(value, label, max).map((v) => string(v, label));
}
export function member<T extends string>(value: unknown, allowed: readonly T[], label: string): T {
  if (!allowed.includes(value as T)) throw new DomainError(`Unknown ${label}: ${String(value)}`);
  return value as T;
}
export function unique(ids: string[], label: string): void {
  if (new Set(ids).size !== ids.length) throw new DomainError(`Duplicate ${label}`);
}
export function date(value: unknown, label: string): string {
  const text = string(value, label);
  if (!/^\d{4}-\d\d-\d\dT/.test(text) || !Number.isFinite(Date.parse(text)))
    throw new DomainError(`Invalid ${label}`);
  return text;
}
export function modifiers(value: unknown, keys: readonly string[], label: string): void {
  for (const [key, v] of Object.entries(record(value, label))) {
    member(key, keys, label);
    number(v, label, -1000, 1000);
  }
}
