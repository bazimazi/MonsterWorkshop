import type { ContentIndex } from './catalog.js';
import type {
  Compatibility,
  Component,
  Creature,
  CreatureSource,
  Element,
  Genome,
  QualityBand,
  Stats,
  StatModifiers,
} from './model.js';
import { GENES, SLOTS, STAT_KEYS } from './model.js';
import { DomainError, number, unique } from './validation.js';
import { decodeCreature } from './serialization.js';
import { clamp, hash, Random } from './random.js';
export function validateAnatomy(ids: string[], content: ContentIndex): Component[] {
  if (!ids.length || ids.length > SLOTS.length)
    throw new DomainError('Select a head and body to begin');
  unique(ids, 'components');
  const parts = ids.map((id) => content.component(id));
  unique(
    parts.map((p) => p.slot),
    'slots',
  );
  for (const slot of content.catalog.rules.generation.requiredSlots)
    if (!parts.some((p) => p.slot === slot)) throw new DomainError(`A ${slot} is required`);
  return parts.sort((a, b) => SLOTS.indexOf(a.slot) - SLOTS.indexOf(b.slot));
}
export function analyzeDesign(ids: string[], content: ContentIndex): Compatibility {
  const parts = validateAnatomy(ids, content),
    rules = content.catalog.rules.generation;
  let score = rules.baseCompatibility;
  const reasons: string[] = [];
  for (let i = 0; i < parts.length; i++)
    for (let j = i + 1; j < parts.length; j++) {
      const a = parts[i]!,
        b = parts[j]!;
      const shared = a.tags.filter((tag) => b.tags.includes(tag)).length;
      const affinities =
        a.compatibleTags.filter((tag) => b.tags.includes(tag)).length +
        b.compatibleTags.filter((tag) => a.tags.includes(tag)).length;
      const conflict =
        a.conflictTags.some((tag) => b.tags.includes(tag)) ||
        b.conflictTags.some((tag) => a.tags.includes(tag));
      score += shared * rules.sharedTagBonus + affinities * rules.affinityBonus;
      if (a.element !== 'neutral' && a.element === b.element) score += rules.elementBonus;
      if (affinities > 0) reasons.push(`${a.name} + ${b.name}: genetic synergy`);
      if (conflict) {
        score -= rules.conflictPenalty;
        reasons.push(`${a.name} + ${b.name}: genetic conflict`);
      }
    }
  const demand = parts.reduce((sum, p) => sum + p.energyCost, 0);
  if (demand > rules.energyCapacity) {
    score -= (demand - rules.energyCapacity) * rules.overloadPenalty;
    reasons.push(`Energy demand ${demand} exceeds chamber capacity ${rules.energyCapacity}`);
  }
  score = Math.round(clamp(score, 0, 100));
  const tier =
    score < 30
      ? 'Unstable'
      : score < 50
        ? 'Poor'
        : score < 70
          ? 'Stable'
          : score < 90
            ? 'Compatible'
            : 'Perfect';
  const tags = parts.flatMap((p) => p.tags);
  const eligible = content.catalog.mutations.filter(
    (m) =>
      m.requiredTags.every((t) => tags.includes(t)) &&
      !m.excludedTags.some((t) => tags.includes(t)),
  );
  const bonus =
    rules.baseMutationChance +
    parts.reduce((sum, p) => sum + p.mutationChance, 0) +
    (1 - score / 100) * rules.instabilityMutationBonus;
  // At least one independent eligible mutation. This is a forecast, never the seeded result.
  const mutationChance =
    1 - eligible.reduce((none, m) => none * (1 - clamp(m.chance + bonus, 0, 1)), 1);
  return { score, tier, reasons, mutationChance };
}
function mutationProbability(
  id: string,
  parts: Component[],
  score: number,
  content: ContentIndex,
): number {
  const rules = content.catalog.rules.generation;
  const mutation = content.mutations.get(id)!;
  return clamp(
    mutation.chance +
      rules.baseMutationChance +
      parts.reduce((s, p) => s + p.mutationChance, 0) +
      (1 - score / 100) * rules.instabilityMutationBonus,
    0,
    1,
  );
}
function selectQuality(
  genome: Genome,
  compatibility: Compatibility,
  content: ContentIndex,
): QualityBand {
  const weight = content.catalog.rules.generation.qualityCompatibilityWeight;
  const score = compatibility.score * weight + genome.stability.value * (1 - weight);
  return [...content.catalog.rules.generation.qualityBands]
    .reverse()
    .find((b) => score >= b.minimum)!;
}
function addStats(stats: Stats, modifiers: StatModifiers): void {
  for (const key of STAT_KEYS) stats[key] += modifiers[key] ?? 0;
}
export function deriveCreature(source: CreatureSource, content: ContentIndex): Creature {
  const valid = decodeCreature(source, content),
    parts = validateAnatomy(valid.componentIds, content);
  const compatibility = analyzeDesign(valid.componentIds, content),
    rules = content.catalog.rules.generation;
  const mutations = valid.mutationIds.map((id) => content.mutations.get(id)!);
  const band = selectQuality(valid.genome, compatibility, content);
  const traitIds = [
    ...new Set([...mutations.flatMap((m) => m.traits), ...parts.flatMap((p) => p.traits)]),
  ].slice(0, band.traitSlots);
  // Component granted abilities compete for finite quality slots. Elemental and defensive modules take priority.
  const abilityPriority = rules.abilityPriority;
  const abilityParts = [...parts].sort(
    (a, b) => abilityPriority.indexOf(a.slot) - abilityPriority.indexOf(b.slot),
  );
  const abilityIds = [
    ...new Set([
      'strike',
      ...mutations.flatMap((m) => m.abilities),
      ...abilityParts.flatMap((p) => p.abilities),
    ]),
  ].slice(0, band.abilitySlots);
  const stats = { ...rules.baseStats };
  for (const part of parts) addStats(stats, part.stats);
  for (const trait of traitIds) addStats(stats, content.traits.get(trait)!.stats);
  for (const mutation of mutations) addStats(stats, mutation.stats);
  const geneForStat = {
    hp: 'vitality',
    attack: 'strength',
    defense: 'stability',
    speed: 'speed',
    power: 'element',
    energy: 'intelligence',
  } as const;
  for (const key of STAT_KEYS)
    stats[key] = Math.round(
      stats[key] + valid.genome[geneForStat[key]].value * rules.geneStatFactor,
    );
  addStats(stats, valid.training);
  for (const key of STAT_KEYS)
    stats[key] = Math.round(
      clamp(stats[key] * (1 + (valid.level - 1) * rules.perLevelGrowth * band.growth), 1, 10000),
    );
  const elementWeights = new Map<Element, number>();
  for (const p of parts)
    if (p.element !== 'neutral')
      elementWeights.set(
        p.element,
        (elementWeights.get(p.element) ?? 0) + (p.genes.element ?? 0) + (p.stats.power ?? 0) + 1,
      );
  const element =
    [...elementWeights].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'en'))[0]?.[0] ??
    'neutral';
  const roles = [...new Set(traitIds.flatMap((id) => content.traits.get(id)!.tags))];
  const body = parts.find((p) => p.slot === 'body')!;
  return {
    ...valid,
    componentIds: parts.map((p) => p.id),
    anatomy: Object.fromEntries(parts.map((p) => [p.slot, p.id])),
    stats,
    element,
    quality: band.quality,
    traitIds,
    abilityIds,
    roles: roles.length ? roles : ['hybrid'],
    compatibility,
    phenotype: {
      bodyScale: clamp(0.88 + valid.genome.vitality.value / 400, 0.85, 1.15),
      headScale: clamp(0.9 + valid.genome.intelligence.value / 400, 0.85, 1.15),
      primaryColor: body.visual.color,
      glowColor: rules.elementColors[element],
      features: mutations.map((m) => m.feature),
    },
  };
}
export interface GenerationOptions {
  seed: number;
  createdAt: string;
  creator: string;
  id?: string;
  forceMutation?: string;
  skipMutations?: boolean;
}
export function generateCreature(
  ids: string[],
  content: ContentIndex,
  options: GenerationOptions,
): Creature {
  number(options.seed, 'seed', 0, 0xffffffff, true);
  const parts = validateAnatomy(ids, content),
    compatibility = analyzeDesign(ids, content),
    rules = content.catalog.rules.generation;
  const fingerprint = `${rules.version}:${options.seed}:${parts.map((p) => p.id).join('|')}`;
  const signature = hash(fingerprint).toString(16).padStart(8, '0'),
    random = new Random(hash(fingerprint));
  const genome = Object.fromEntries(
    GENES.map((id) => {
      let base = rules.geneBase + parts.reduce((sum, p) => sum + (p.genes[id] ?? 0), 0);
      if (id === 'stability') base = (base + compatibility.score) / 2;
      return [
        id,
        {
          value: Math.round(
            clamp(base + random.integer(-rules.geneVariance, rules.geneVariance), 0, 100),
          ),
          dominance: base >= 65 ? 'dominant' : 'hybrid',
        },
      ];
    }),
  ) as Genome;
  const tags = new Set(parts.flatMap((p) => p.tags));
  const eligible = content.catalog.mutations
    .filter(
      (m) => m.requiredTags.every((t) => tags.has(t)) && !m.excludedTags.some((t) => tags.has(t)),
    )
    .sort((a, b) => a.id.localeCompare(b.id, 'en'));
  if (options.forceMutation && !eligible.some((m) => m.id === options.forceMutation))
    throw new DomainError('Forced mutation is not eligible');
  const mutations = eligible.filter(
    (m) =>
      options.forceMutation === m.id ||
      (!options.skipMutations &&
        random.next() < mutationProbability(m.id, parts, compatibility.score, content)),
  );
  for (const mutation of mutations)
    for (const id of GENES)
      genome[id].value = Math.round(clamp(genome[id].value + (mutation.genes[id] ?? 0), 0, 100));
  const source: CreatureSource = {
    id: options.id ?? `specimen-${signature}`,
    signature,
    generationVersion: rules.version,
    seed: options.seed,
    componentIds: parts.map((p) => p.id),
    genome,
    mutationIds: mutations.map((m) => m.id),
    name: 'Unnamed specimen',
    experience: 0,
    level: 1,
    training: {},
    equipment: [],
    createdAt: options.createdAt,
    creator: options.creator,
    history: { battles: 0, victories: 0, discoveries: 0, firstBattleAt: null },
  };
  const creature = deriveCreature(source, content);
  const suffix =
    Object.entries(rules.nameSuffixTags).find(([tag]) => tags.has(tag))?.[1] ?? 'beast';
  creature.name = `${rules.namePrefixes[creature.element]}${suffix}`;
  if (compatibility.score < 30)
    creature.name = `Experiment #${signature.slice(0, 4).toUpperCase()}`;
  return creature;
}
