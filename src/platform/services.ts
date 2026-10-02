export interface Analytics { track(event: string, properties?: Record<string, string | number | boolean>): void }
export class LocalAnalytics implements Analytics {
  readonly events: { event: string; properties: Record<string, string | number | boolean> }[] = [];
  track(event: string, properties: Record<string, string | number | boolean> = {}): void {
    this.events.push({ event, properties });
    if (this.events.length > 200) this.events.shift();
  }
}
export const logger = {
  info: (message: string) => console.info('[Workshop]', message),
  error: (error: unknown) => console.error('[Workshop]', error),
};
export class Feedback {
  enabled = false;
  haptics = false;
  private context: AudioContext | undefined;
  play(kind: 'select' | 'create' | 'victory'): void {
    if (this.haptics) navigator.vibrate?.(20);
    if (!this.enabled) return;
    this.context ??= new AudioContext();
    void this.context.resume();
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.connect(gain); gain.connect(this.context.destination);
    const now = this.context.currentTime;
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime({ select: 440, create: 660, victory: 880 }[kind], now);
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    oscillator.start(); oscillator.stop(now + 0.25);
  }
}
