import type { ContentIndex } from './catalog.js';
import type { Creature, CreatureSource, Region } from './model.js';
import { deriveCreature } from './generator.js';
import { decodeCreature } from './serialization.js';
import { clamp, Random } from './random.js';
import { DomainError, date, member, number, record, string } from './validation.js';

export interface Expedition {
  id: string;
  serial: number;
  regionId: string;
  source: CreatureSource;
  seed: number;
  elapsedMs: number;
  startedAt: string;
}
export interface ExpeditionReward {
  biomass: number;
  resources: Record<string, number>;
  components: Record<string, number>;
  discovery: string | null;
  experience: number;
}
export interface ExpeditionReport {
  id: string;
  regionId: string;
  creatureId: string;
  outcome: 'collected' | 'cancelled';
  reward: ExpeditionReward | null;
}
export function creatureTags(creature: Creature, content: ContentIndex): Set<string> {
  return new Set([
    ...creature.componentIds.flatMap((id) => content.component(id).tags),
    ...creature.traitIds.flatMap((id) => content.traits.get(id)!.tags),
  ]);
}
export function expeditionRequirements(
  region: Region,
  creature: Creature | undefined,
  completedRegions: string[],
  content: ContentIndex,
): string[] {
  const reasons = region.prerequisites
    .filter((id) => !completedRegions.includes(id))
    .map((id) => `Complete ${content.region(id).name} first.`);
  if (!creature) return [...reasons, 'Choose a creature from your habitat.'];
  const tags = creatureTags(creature, content);
  if (region.requiredTags.length && !region.requiredTags.some((tag) => tags.has(tag)))
    reasons.push(`Needs ${region.requiredTags.join(' or ')} biology.`);
  for (const [key, minimum] of Object.entries(region.minimumStats))
    if (creature.stats[key as keyof typeof creature.stats] < minimum)
      reasons.push(`Needs at least ${minimum} ${key}.`);
  return reasons;
}
export function expeditionFitness(
  creature: Creature,
  region: Region,
  content: ContentIndex,
): number {
  const tags = creatureTags(creature, content),
    rules = content.catalog.rules.exploration;
  const affinity =
    region.affinityTags.filter((tag) => tags.has(tag)).length /
    Math.max(1, region.affinityTags.length);
  return clamp(
    affinity * rules.affinityWeight +
      (creature.genome.adaptation.value / 100) * rules.adaptationWeight +
      Math.min(1, creature.stats.speed / 60) * rules.speedWeight,
    0,
    1,
  );
}
// Elapsed time is supplied by the foreground monotonic clock, never by saved wall timestamps.
export function advanceExpedition(
  job: Expedition,
  elapsedMs: number,
  content: ContentIndex,
): Expedition {
  number(elapsedMs, 'active play interval', 0, 1000, true);
  return {
    ...job,
    elapsedMs: Math.min(content.region(job.regionId).durationMs, job.elapsedMs + elapsedMs),
  };
}
export function expeditionReward(
  job: Expedition,
  content: ContentIndex,
  discoveries: string[],
): ExpeditionReward {
  const region = content.region(job.regionId),
    rules = content.catalog.rules.exploration;
  if (job.elapsedMs < region.durationMs)
    throw new DomainError('This expedition is still in progress');
  const fitness = expeditionFitness(deriveCreature(job.source, content), region, content);
  const random = new Random(job.seed);
  const discovery =
    !discoveries.includes(region.discovery) ||
    random.next() < region.discoveryChance + fitness * rules.discoveryBonus
      ? region.discovery
      : null;
  return {
    biomass: Math.floor(region.biomass * (1 + fitness * rules.yieldBonus)),
    resources: {
      [region.resource]: Math.floor(region.quantity * (1 + fitness * rules.yieldBonus)),
    },
    components: Object.fromEntries([
      ...region.restock
        .filter((id) => discoveries.includes(id))
        .map((id) => [id, rules.restockQuantity]),
      ...(discovery ? [[discovery, 1]] : []),
    ]),
    discovery,
    experience: rules.experience,
  };
}
export function decodeExpedition(value: unknown, content: ContentIndex): Expedition {
  const job = record(value, 'expedition');
  string(job.id, 'expedition id');
  number(job.serial, 'expedition serial', 1, 1000000, true);
  const region = content.region(string(job.regionId, 'region'));
  number(job.seed, 'expedition seed', 0, 0xffffffff, true);
  number(job.elapsedMs, 'expedition progress', 0, region.durationMs, true);
  date(job.startedAt, 'departure time');
  return {
    id: job.id as string,
    serial: job.serial as number,
    regionId: region.id,
    source: decodeCreature(job.source, content),
    seed: job.seed as number,
    elapsedMs: job.elapsedMs as number,
    startedAt: job.startedAt as string,
  };
}
export function decodeExpeditionReport(value: unknown, content: ContentIndex): ExpeditionReport {
  const report = record(value, 'expedition report');
  const id = string(report.id, 'report id'),
    creatureId = string(report.creatureId, 'report creature');
  const region = content.region(string(report.regionId, 'report region'));
  const outcome = member(report.outcome, ['collected', 'cancelled'], 'expedition outcome');
  if (outcome === 'cancelled') {
    if (report.reward !== null) throw new DomainError('Cancelled expeditions cannot grant rewards');
    return { id, regionId: region.id, creatureId, outcome, reward: null };
  }
  const reward = record(report.reward, 'expedition reward');
  const resources = record(reward.resources, 'gathered resources');
  const components = record(reward.components, 'gathered components');
  number(reward.biomass, 'reward biomass', region.biomass, region.biomass * 2, true);
  number(
    reward.experience,
    'reward experience',
    content.catalog.rules.exploration.experience,
    content.catalog.rules.exploration.experience,
    true,
  );
  if (Object.keys(resources).length !== 1 || resources[region.resource] === undefined)
    throw new DomainError('Expedition report has invalid resources');
  number(
    resources[region.resource],
    'gathered quantity',
    region.quantity,
    region.quantity * 2,
    true,
  );
  if (reward.discovery !== null && reward.discovery !== region.discovery)
    throw new DomainError('Expedition report has invalid discovery');
  for (const [component, quantity] of Object.entries(components)) {
    content.component(component);
    if (!region.restock.includes(component) && component !== reward.discovery)
      throw new DomainError('Expedition report has invalid components');
    const expected =
      component === region.discovery ? 1 : content.catalog.rules.exploration.restockQuantity;
    number(quantity, 'gathered component quantity', expected, expected, true);
  }
  if (reward.discovery && components[reward.discovery as string] !== 1)
    throw new DomainError('Discovery is missing from rewards');
  return structuredClone({
    id,
    regionId: region.id,
    creatureId,
    outcome,
    reward: {
      biomass: reward.biomass as number,
      experience: reward.experience as number,
      resources: resources as Record<string, number>,
      components: components as Record<string, number>,
      discovery: reward.discovery as string | null,
    },
  });
}
