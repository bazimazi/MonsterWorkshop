import { ELEMENTS, GENES, QUALITY, SLOTS, STAT_KEYS, STATUS_IDS } from './model.js';
import type { Catalog, Component, Ability, Trait, Mutation, Resource, Region } from './model.js';
import {
  DomainError,
  list,
  member,
  modifiers,
  number,
  record,
  string,
  strings,
  unique,
} from './validation.js';
function references(ids: unknown, valid: Set<string>, label: string): void {
  const values = strings(ids, label);
  unique(values, label);
  for (const id of values) if (!valid.has(id)) throw new DomainError(`Missing ${label}: ${id}`);
}
function table(raw: unknown, label: string): Record<string, unknown>[] {
  const entries = list(raw, label).map((v) => record(v, label));
  unique(
    entries.map((v) => string(v.id, 'id')),
    label,
  );
  return entries;
}
export function decodeCatalog(raw: unknown): Catalog {
  const c = record(raw, 'catalog');
  number(c.version, 'content version', 1, 1, true);
  const components = table(c.components, 'components'),
    abilities = table(c.abilities, 'abilities');
  const traits = table(c.traits, 'traits'),
    mutations = table(c.mutations, 'mutations');
  const abilityIds = new Set(abilities.map((v) => v.id as string)),
    traitIds = new Set(traits.map((v) => v.id as string));
  if (!abilityIds.has('strike')) throw new DomainError('Catalog requires a basic strike');
  for (const a of abilities) {
    string(a.name, 'ability name');
    string(a.description, 'ability description');
    strings(a.tags, 'ability tags');
    number(a.cost, 'ability cost', 0, 1000, true);
    number(a.cooldown, 'cooldown', 0, 100, true);
    member(a.target, ['enemy', 'ally', 'self'], 'target');
    const effects = list(a.effects, 'effects');
    if (!effects.length) throw new DomainError('Ability must have effects');
    for (const rawEffect of effects) {
      const e = record(rawEffect, 'effect');
      member(e.type, ['damage', 'heal', 'shield', 'status'], 'effect type');
      if (e.type === 'status') {
        member(e.status, STATUS_IDS, 'status');
        number(e.chance, 'status chance', 0, 1);
        number(e.duration, 'duration', 1, 100, true);
        number(
          e.potency,
          'potency',
          0,
          ['shock', 'weakness', 'slow'].includes(e.status as string) ? 1 : 1000,
        );
      } else {
        number(e.power, 'effect power');
        if (e.type === 'damage') {
          member(e.scaling, ['attack', 'power'], 'scaling');
          member(e.element, ELEMENTS, 'effect element');
        }
      }
    }
  }
  const strike = abilities.find((a) => a.id === 'strike');
  if (strike?.cost !== 0 || strike.cooldown !== 0 || strike.target !== 'enemy')
    throw new DomainError('Basic strike must always be usable');
  for (const t of traits) {
    string(t.name, 'trait name');
    string(t.description, 'trait description');
    modifiers(t.stats, STAT_KEYS, 'trait stats');
    strings(t.tags, 'trait tags');
  }
  for (const p of components) {
    string(p.name, 'component name');
    string(p.category, 'category');
    string(p.lore, 'lore');
    member(p.slot, SLOTS, 'slot');
    member(p.rarity, ['common', 'uncommon', 'rare', 'epic', 'legendary'], 'rarity');
    member(p.element, ELEMENTS, 'element');
    member(p.discovery, ['starter', 'battle', 'expedition', 'research'], 'discovery');
    modifiers(p.stats, STAT_KEYS, 'component stats');
    modifiers(p.genes, GENES, 'component genes');
    references(p.abilities, abilityIds, 'ability');
    references(p.traits, traitIds, 'trait');
    for (const k of ['tags', 'compatibleTags', 'conflictTags']) strings(p[k], k);
    number(p.energyCost, 'energy cost', 0, 1000, true);
    number(p.weight, 'weight', 0, 1000);
    number(p.size, 'size', 0.1, 3);
    number(p.mutationChance, 'mutation chance', 0, 1);
    const v = record(p.visual, 'visual');
    string(v.mesh, 'mesh');
    member(v.anchor, SLOTS, 'anchor');
    if (v.anchor !== p.slot) throw new DomainError('Visual anchor must match the component slot');
    for (const k of ['allowedScale', 'allowedRotation']) {
      const range = list(v[k], k, 2);
      if (range.length !== 2) throw new DomainError('Visual ranges require two bounds');
      number(range[0], k, k === 'allowedScale' ? 0.1 : -180, k === 'allowedScale' ? 3 : 180);
      number(range[1], k, k === 'allowedScale' ? 0.1 : -180, k === 'allowedScale' ? 3 : 180);
      if ((range[0] as number) > (range[1] as number))
        throw new DomainError('Visual range is reversed');
      number(
        v[k === 'allowedScale' ? 'scale' : 'rotation'],
        k,
        range[0] as number,
        range[1] as number,
      );
    }
    number(v.layer, 'layer', 0, 20, true);
    number(v.inheritColor, 'inherit color', 0, 1);
    if (!/^#[\da-f]{6}$/i.test(string(v.color, 'color')))
      throw new DomainError('Colors must be six-digit hex');
  }
  for (const m of mutations) {
    string(m.name, 'mutation name');
    string(m.description, 'mutation description');
    string(m.feature, 'feature');
    strings(m.requiredTags, 'required tags');
    strings(m.excludedTags, 'excluded tags');
    number(m.chance, 'mutation chance', 0, 1);
    modifiers(m.stats, STAT_KEYS, 'mutation stats');
    modifiers(m.genes, GENES, 'mutation genes');
    references(m.abilities, abilityIds, 'ability');
    references(m.traits, traitIds, 'trait');
  }
  const rules = record(c.rules, 'rules'),
    g = record(rules.generation, 'generation rules');
  number(g.version, 'generation version', 1, 1, true);
  for (const slot of strings(g.requiredSlots, 'required slots'))
    member(slot, SLOTS, 'required slot');
  if (
    !(g.requiredSlots as string[]).includes('head') ||
    !(g.requiredSlots as string[]).includes('body')
  )
    throw new DomainError('Head and body must be required');
  for (const k of [
    'baseCompatibility',
    'sharedTagBonus',
    'affinityBonus',
    'elementBonus',
    'conflictPenalty',
    'energyCapacity',
    'overloadPenalty',
    'geneBase',
    'geneVariance',
    'geneStatFactor',
  ])
    number(g[k], k, 0, 100);
  for (const k of ['baseMutationChance', 'instabilityMutationBonus']) number(g[k], k, 0, 1);
  for (const k of ['qualityCompatibilityWeight', 'perLevelGrowth']) number(g[k], k, 0, 1);
  const priority = strings(g.abilityPriority, 'ability priority');
  unique(priority, 'ability priority');
  for (const slot of priority) member(slot, SLOTS, 'ability priority');
  if (priority.length !== SLOTS.length)
    throw new DomainError('Ability priority must contain every slot');
  const baseStats = record(g.baseStats, 'base stats');
  for (const k of STAT_KEYS) number(baseStats[k], k, 1, 1000);
  const bands = list(g.qualityBands, 'quality bands').map((v) => record(v, 'quality band'));
  if (!bands.length || bands[0]?.minimum !== 0)
    throw new DomainError('Quality bands must start at zero');
  let previous = -1;
  for (const b of bands) {
    member(b.quality, QUALITY, 'quality');
    number(b.minimum, 'quality minimum', 0, 100);
    if ((b.minimum as number) <= previous) throw new DomainError('Quality bands must be ordered');
    previous = b.minimum as number;
    number(b.abilitySlots, 'ability slots', 1, abilities.length, true);
    number(b.traitSlots, 'trait slots', 1, traits.length, true);
    number(b.growth, 'growth', 0.1, 3);
  }
  const colors = record(g.elementColors, 'element colors'),
    prefixes = record(g.namePrefixes, 'name prefixes');
  for (const element of ELEMENTS) {
    if (!/^#[\da-f]{6}$/i.test(string(colors[element], 'element color')))
      throw new DomainError('Invalid element color');
    string(prefixes[element], 'prefix');
  }
  for (const suffix of Object.values(record(g.nameSuffixTags, 'suffixes')))
    string(suffix, 'suffix');
  const w = record(rules.workshop, 'workshop');
  for (const k of ['startingBiomass', 'starterQuantity', 'baseCost', 'maxCreatures'])
    number(w[k], k, 1, 10000, true);
  const b = record(rules.combat, 'combat');
  for (const k of ['armorFactor', 'criticalChance', 'enemyScale']) number(b[k], k, 0, 1);
  number(b.criticalMultiplier, 'critical multiplier', 1, 5);
  for (const k of [
    'energyPerTurn',
    'maxRounds',
    'victoryBiomass',
    'rewardQuantity',
    'experience',
    'experiencePerLevel',
  ])
    number(b[k], k, 1, 10000, true);
  number(b.defeatBiomass, 'defeat biomass', 0, 10000, true);
  const componentIds = new Set(components.map((v) => v.id as string));
  references([b.rewardComponent], componentIds, 'reward component');
  for (const rawResistance of list(b.resistances, 'resistances')) {
    const r = record(rawResistance, 'resistance');
    member(r.attack, ELEMENTS, 'attack element');
    member(r.defense, ELEMENTS, 'defense element');
    number(r.multiplier, 'resistance multiplier', 0.1, 3);
  }
  const opponents = list(b.opponents, 'opponents', 3);
  if (opponents.length !== 3) throw new DomainError('Combat requires three opponents');
  for (const rawOpponent of opponents) {
    const o = record(rawOpponent, 'opponent');
    string(o.name, 'opponent name');
    references(o.components, componentIds, 'opponent component');
    number(o.seed, 'opponent seed', 0, 0xffffffff, true);
  }
  const resources = table(c.resources, 'resources'),
    regions = table(c.regions, 'regions');
  const resourceIds = new Set(resources.map((r) => r.id as string));
  const regionIds = new Set(regions.map((r) => r.id as string));
  for (const r of resources) {
    string(r.name, 'resource name');
    string(r.description, 'resource description');
  }
  for (const r of regions) {
    for (const key of ['name', 'description', 'activity']) string(r[key], key);
    number(r.durationMs, 'expedition duration', 1000, 3600000, true);
    references(r.prerequisites, regionIds, 'region prerequisite');
    strings(r.requiredTags, 'required tags');
    strings(r.affinityTags, 'affinity tags');
    modifiers(r.minimumStats, STAT_KEYS, 'minimum stats');
    for (const value of Object.values(r.minimumStats as Record<string, number>))
      number(value, 'minimum stat', 0, 1000);
    number(r.biomass, 'gathered biomass', 1, 1000, true);
    number(r.quantity, 'resource quantity', 1, 100, true);
    number(r.discoveryChance, 'discovery chance', 0, 1);
    references([r.resource], resourceIds, 'resource');
    references(r.restock, componentIds, 'restock component');
    references([r.discovery], componentIds, 'expedition discovery');
    if (components.find((p) => p.id === r.discovery)?.discovery !== 'expedition')
      throw new DomainError('Region discoveries require expedition components');
  }
  validateTree(regions, 'region');
  const x = record(rules.exploration, 'exploration rules');
  number(x.maxAssignments, 'expedition capacity', 1, 6, true);
  for (const key of [
    'affinityWeight',
    'adaptationWeight',
    'speedWeight',
    'yieldBonus',
    'discoveryBonus',
  ])
    number(x[key], key, 0, 1);
  if (
    Math.abs(
      (x.affinityWeight as number) + (x.adaptationWeight as number) + (x.speedWeight as number) - 1,
    ) > 0.00001
  )
    throw new DomainError('Expedition fitness weights must sum to one');
  number(x.restockQuantity, 'restock quantity', 1, 100, true);
  number(x.experience, 'expedition experience', 1, 1000, true);
  return structuredClone(c) as unknown as Catalog;
}
export function validateTree(entries: Record<string, unknown>[], label: string): void {
  const visiting = new Set<string>(),
    visited = new Set<string>();
  const visit = (id: string): void => {
    if (visiting.has(id)) throw new DomainError(`Cyclic ${label} prerequisites`);
    if (visited.has(id)) return;
    visiting.add(id);
    const entry = entries.find((e) => e.id === id);
    if (!entry) throw new DomainError(`Missing ${label} prerequisite: ${id}`);
    for (const parent of entry.prerequisites as string[]) visit(parent);
    visiting.delete(id);
    visited.add(id);
  };
  for (const entry of entries) visit(entry.id as string);
}
export class ContentIndex {
  readonly components: Map<string, Component>;
  readonly abilities: Map<string, Ability>;
  readonly traits: Map<string, Trait>;
  readonly mutations: Map<string, Mutation>;
  readonly resources: Map<string, Resource>;
  readonly regions: Map<string, Region>;
  constructor(readonly catalog: Catalog) {
    this.components = new Map(catalog.components.map((v) => [v.id, v]));
    this.abilities = new Map(catalog.abilities.map((v) => [v.id, v]));
    this.traits = new Map(catalog.traits.map((v) => [v.id, v]));
    this.mutations = new Map(catalog.mutations.map((v) => [v.id, v]));
    this.resources = new Map(catalog.resources.map((v) => [v.id, v]));
    this.regions = new Map(catalog.regions.map((v) => [v.id, v]));
  }
  component(id: string): Component {
    const value = this.components.get(id);
    if (!value) throw new DomainError(`Unknown component: ${id}`);
    return value;
  }
  ability(id: string): Ability {
    const value = this.abilities.get(id);
    if (!value) throw new DomainError(`Unknown ability: ${id}`);
    return value;
  }
  region(id: string): Region {
    const value = this.regions.get(id);
    if (!value) throw new DomainError(`Unknown region: ${id}`);
    return value;
  }
}
