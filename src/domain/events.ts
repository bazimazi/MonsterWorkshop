import type { ContentIndex } from './catalog.js';
import type { CreatureSource } from './model.js';
import type { ExpeditionReport } from './exploration.js';
import { DomainError, date, number, record } from './validation.js';
export interface EventWindow {
  key: string;
  period: number;
  templateId: string;
  startsAt: string;
  endsAt: string;
}
export interface EventRun {
  window: EventWindow;
  startedAt: string;
  baselineSerial: number;
  baselineExpeditionSerial: number;
}
export interface EventClaim {
  run: EventRun;
  completedAt: string;
  endSerial: number;
  endExpeditionSerial: number;
}
export interface EventEvidence {
  creatures: CreatureSource[];
  experiments: { serial: number; creatureId: string; createdAt: string }[];
  expeditionReports: ExpeditionReport[];
  seedBase: number;
}
export function eventWindow(period: number, c: ContentIndex): EventWindow {
  number(period, 'event period', 0, 100000, true);
  const live = c.catalog.live,
    template = live.events[period % live.events.length]!;
  const start = Date.parse(live.epoch) + period * live.periodDays * 86400000;
  return {
    key: `event-${period}-${template.id}`,
    period,
    templateId: template.id,
    startsAt: new Date(start).toISOString(),
    endsAt: new Date(start + live.periodDays * 86400000).toISOString(),
  };
}
export function currentEvent(at: string, c: ContentIndex): EventWindow | null {
  date(at, 'event date');
  const period = Math.floor(
    (Date.parse(at) - Date.parse(c.catalog.live.epoch)) / (c.catalog.live.periodDays * 86400000),
  );
  return period < 0 ? null : eventWindow(period, c);
}
export function decodeEventRun(
  raw: unknown,
  c: ContentIndex,
  nextSerial: number,
  nextExpeditionSerial: number,
): EventRun {
  const run = record(raw, 'event enrollment'),
    w = record(run.window, 'event window');
  const window = eventWindow(number(w.period, 'event period', 0, 100000, true), c);
  if (Object.entries(window).some(([key, value]) => w[key] !== value))
    throw new DomainError('Incorrect event window');
  const startedAt = date(run.startedAt, 'event enrollment time');
  if (
    Date.parse(startedAt) < Date.parse(window.startsAt) ||
    Date.parse(startedAt) >= Date.parse(window.endsAt)
  )
    throw new DomainError('Enrollment is outside the event window');
  return {
    window,
    startedAt,
    baselineSerial: number(run.baselineSerial, 'event baseline', 1, nextSerial, true),
    baselineExpeditionSerial: number(
      run.baselineExpeditionSerial,
      'event expedition baseline',
      1,
      nextExpeditionSerial,
      true,
    ),
  };
}
export function eventProgress(
  run: EventRun,
  s: EventEvidence,
  c: ContentIndex,
  endSerial = 1000000,
  endExpeditionSerial = 1000000,
  completedAt = run.window.endsAt,
): number {
  const objective = c.catalog.live.events.find((e) => e.id === run.window.templateId)!.objective;
  if (objective.type === 'explore')
    return s.expeditionReports.filter(
      (r) =>
        r.outcome === 'collected' &&
        r.regionId === objective.regionId &&
        Number(r.id.slice(`expedition-${s.seedBase}-`.length)) >= run.baselineExpeditionSerial &&
        Number(r.id.slice(`expedition-${s.seedBase}-`.length)) < endExpeditionSerial,
    ).length;
  return s.experiments.filter((e) => {
    if (
      e.serial < run.baselineSerial ||
      e.serial >= endSerial ||
      Date.parse(e.createdAt) < Date.parse(run.startedAt) ||
      Date.parse(e.createdAt) > Date.parse(completedAt) ||
      Date.parse(e.createdAt) >= Date.parse(run.window.endsAt)
    )
      return false;
    const source = s.creatures.find((x) => x.id === e.creatureId)!;
    if (source.lineage) return false;
    const tags = new Set(source.componentIds.flatMap((id) => c.component(id).tags));
    return objective.tags.every((tag) => tags.has(tag));
  }).length;
}
export function seasonalAvailable(componentId: string, at: string, c: ContentIndex): boolean {
  if (c.component(componentId).discovery !== 'event') return true;
  const window = currentEvent(at, c);
  return (
    !!window &&
    c.catalog.live.events.find((e) => e.id === window.templateId)?.component === componentId
  );
}
