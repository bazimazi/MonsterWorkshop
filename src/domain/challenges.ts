import type { ContentIndex } from './catalog.js';
import type { CreatureSource, Stats } from './model.js';
import { deriveCreature } from './generator.js';
import { STAT_KEYS } from './model.js';
import { clamp } from './random.js';
import { DomainError, member, number, record } from './validation.js';
export interface Challenge {
  kind: 'boss' | 'tower';
  bossId: string | null;
  floor: number;
  modifier: 'none' | 'armored' | 'volatile';
  bossPhase: boolean;
}
export function decodeChallenge(raw: unknown, content: ContentIndex): Challenge {
  const c = record(raw, 'challenge'),
    kind = member(c.kind, ['boss', 'tower'], 'challenge type');
  const modifier = member(c.modifier, ['none', 'armored', 'volatile'], 'challenge modifier');
  number(c.floor, 'tower floor', kind === 'tower' ? 1 : 0, kind === 'tower' ? 1000000 : 0, true);
  if (typeof c.bossPhase !== 'boolean' || (kind === 'tower' && c.bossPhase))
    throw new DomainError('Invalid boss phase');
  if (
    kind === 'boss'
      ? !content.catalog.advanced.bosses.some((b) => b.id === c.bossId)
      : c.bossId !== null
  )
    throw new DomainError('Unknown challenge boss');
  return {
    kind,
    bossId: c.bossId as string | null,
    floor: c.floor as number,
    modifier,
    bossPhase: c.bossPhase,
  };
}
export function teamSynergies(sources: CreatureSource[], content: ContentIndex) {
  return content.catalog.advanced.synergies.filter(
    (s) =>
      sources.filter((c) => c.componentIds.some((id) => content.component(id).tags.includes(s.tag)))
        .length >= s.minimum,
  );
}
export function challengeStats(
  source: CreatureSource,
  team: 'player' | 'enemy',
  sources: CreatureSource[],
  content: ContentIndex,
  challenge?: Challenge,
): Stats {
  const stats = { ...deriveCreature(source, content).stats };
  let scale = team === 'enemy' ? content.catalog.rules.combat.enemyScale : 1;
  if (challenge) {
    if (team === 'enemy' && challenge.kind === 'tower') scale *= 1 + (challenge.floor - 1) * 0.12;
    if (team === 'enemy' && challenge.kind === 'boss' && source.id === 'opponent-1')
      scale = content.catalog.advanced.bosses.find((b) => b.id === challenge.bossId)!.scale;
    for (const synergy of teamSynergies(sources, content))
      for (const key of STAT_KEYS) stats[key] += synergy.stats[key] ?? 0;
  }
  for (const key of STAT_KEYS) stats[key] = Math.round(clamp(stats[key] * scale, 1, 10000));
  if (challenge?.modifier === 'armored' && team === 'enemy')
    stats.defense = Math.min(10000, Math.round(stats.defense * 1.5));
  if (challenge?.modifier === 'volatile')
    stats.power = Math.min(10000, Math.round(stats.power * 1.3));
  if (challenge?.bossPhase && source.id === 'opponent-1')
    stats.power = Math.min(10000, Math.round(stats.power * 1.3));
  return stats;
}
