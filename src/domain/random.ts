// FNV-1a over UTF-16 code units; Math.imul pins arithmetic to 32 bits in all JS engines.
export function hash(text: string): number {
  let value = 2166136261;
  for (let i = 0; i < text.length; i++) value = Math.imul(value ^ text.charCodeAt(i), 16777619);
  return value >>> 0;
}
// Mulberry32: reproducible unsigned state. Not a cryptographic/authority primitive.
export class Random {
  constructor(public state: number) { this.state >>>= 0; }
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
  integer(min: number, max: number): number { return min + Math.floor(this.next() * (max - min + 1)); }
}
export function clamp(value: number, minimum: number, maximum: number): number { return Math.max(minimum, Math.min(maximum, value)); }
