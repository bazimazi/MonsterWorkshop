import { ELEMENTS, GENES, QUALITY, SLOTS, STAT_KEYS, STATUS_IDS } from './model.js';
import type {
  Catalog,
  Component,
  Ability,
  Trait,
  Mutation,
  Resource,
  Region,
  ResearchNode,
} from './model.js';
import {
  DomainError,
  date,
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
          ['shock', 'weakness', 'slow', 'conductive', 'armor-break', 'haste'].includes(
            e.status as string,
          )
            ? 1
            : 1000,
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
    member(
      p.discovery,
      ['starter', 'battle', 'expedition', 'research', 'challenge', 'event'],
      'discovery',
    );
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
  const research = table(c.research, 'research'),
    researchIds = new Set(research.map((r) => r.id as string));
  for (const r of research) {
    for (const key of ['name', 'branch', 'description']) string(r[key], `research ${key}`);
    references(r.prerequisites, researchIds, 'research prerequisite');
    const objectives = record(r.objectives, 'research objectives');
    for (const key of ['experiments', 'scans', 'advancedScans', 'mutations'])
      number(objectives[key], key, 0, 100, true);
    number(objectives.experiments, 'required experiments', 0, w.maxCreatures as number, true);
    for (const key of ['scans', 'advancedScans'])
      number(objectives[key], key, 0, components.length, true);
    number(objectives.mutations, 'required mutations', 0, mutations.length, true);
    references(objectives.regions, regionIds, 'research region');
    validateCost(r.cost, resourceIds);
    const unlock = record(r.unlock, 'research unlock');
    member(
      unlock.type,
      ['scanner', 'component', 'mutation-analysis', 'mutation-control'],
      'research unlock',
    );
    if (unlock.type === 'scanner') number(unlock.level, 'scanner level', 1, 2, true);
    if (unlock.type === 'component') {
      references([unlock.id], componentIds, 'research component');
      if (components.find((p) => p.id === unlock.id)?.discovery !== 'research')
        throw new DomainError('Research unlock requires a research component');
      number(unlock.quantity, 'research samples', 1, 100, true);
      validateCost(unlock.synthesisCost, resourceIds);
    }
  }
  validateTree(research, 'research');
  const researchRules = record(rules.research, 'research rules');
  for (const key of ['basicScanCost', 'advancedScanCost', 'controlledMutationCost'])
    validateCost(researchRules[key], resourceIds);
  const breeding = record(rules.breeding, 'breeding rules');
  validateCost(breeding.cost, resourceIds);
  number(breeding.cooldownMs, 'breeding cooldown', 1000, 3600000, true);
  number(breeding.variation, 'inheritance variation', 0, 10, true);
  for (const key of ['blendChance', 'mutationInheritance']) number(breeding[key], key, 0, 1);
  const advanced = record(c.advanced, 'advanced combat');
  for (const r of table(advanced.reactions, 'reactions')) {
    string(r.name, 'reaction name');
    member(r.element, ELEMENTS, 'reaction element');
    member(r.requires, STATUS_IDS, 'reaction requirement');
    member(r.status, STATUS_IDS, 'reaction status');
    number(r.multiplier, 'reaction multiplier', 1, 3);
    number(r.duration, 'reaction duration', 1, 10, true);
    number(
      r.potency,
      'reaction potency',
      0,
      ['conductive', 'armor-break', 'haste', 'shock', 'slow', 'weakness'].includes(
        r.status as string,
      )
        ? 1
        : 1000,
    );
  }
  for (const s of table(advanced.synergies, 'synergies')) {
    string(s.name, 'synergy name');
    string(s.tag, 'synergy tag');
    number(s.minimum, 'synergy members', 2, 3, true);
    modifiers(s.stats, STAT_KEYS, 'synergy stats');
  }
  for (const b of table(advanced.bosses, 'bosses')) {
    string(b.name, 'boss name');
    references(b.components, componentIds, 'boss components');
    references([b.discovery], componentIds, 'boss discovery');
    if (components.find((p) => p.id === b.discovery)?.discovery !== 'challenge')
      throw new DomainError('Boss discovery must be challenge biology');
    number(b.seed, 'boss seed', 0, 0xffffffff, true);
    number(b.scale, 'boss scale', 0.5, 5);
    number(b.phaseAt, 'boss threshold', 0.1, 0.9);
    for (const key of ['shield', 'regeneration', 'biomass']) number(b[key], key, 1, 1000, true);
    if (b.requiresRegion !== undefined) references([b.requiresRegion], regionIds, 'boss region');
    if (b.resources !== undefined)
      for (const [id, n] of Object.entries(record(b.resources, 'boss resources'))) {
        references([id], resourceIds, 'boss resource');
        number(n, 'boss resource quantity', 1, 100, true);
      }
  }
  const economy = record(c.economy, 'economy');
  number(economy.saleRatio, 'sale ratio', 0.1, 0.8);
  number(economy.levelBonus, 'level bonus', 0, 10, true);
  number(economy.mutationBonus, 'mutation bonus', 0, 10, true);
  for (const offer of table(economy.offers, 'market offers')) {
    member(offer.type, ['component', 'resource'], 'offer type');
    references([offer.item], offer.type === 'component' ? componentIds : resourceIds, 'offer item');
    number(offer.quantity, 'offer quantity', 1, 100, true);
    number(offer.price, 'offer price', 1, 1000, true);
  }
  for (const recipe of table(economy.recipes, 'crafting recipes')) {
    references([recipe.component], componentIds, 'crafted component');
    number(recipe.quantity, 'crafted quantity', 1, 100, true);
    validateCost(recipe.cost, resourceIds);
  }
  const orders = table(economy.orders, 'NPC orders');
  if (!orders.length) throw new DomainError('At least one NPC request is required');
  for (const order of orders) {
    string(order.customer, 'customer');
    string(order.description, 'order description');
    strings(order.tags, 'order biology');
    references(
      order.tags,
      new Set(components.flatMap((p) => p.tags as string[])),
      'request biology',
    );
    modifiers(order.genes, GENES, 'order genes');
    for (const n of Object.values(order.genes as Record<string, number>))
      number(n, 'required gene', 0, 100, true);
    modifiers(order.minimumStats, STAT_KEYS, 'order stats');
    number(order.bonus, 'order bonus', 1, 1000, true);
    for (const [id, n] of Object.entries(record(order.resources, 'order resources'))) {
      references([id], resourceIds, 'order resource');
      number(n, 'order reward', 1, 100, true);
    }
  }
  const live = record(c.live, 'live content');
  date(live.epoch, 'calendar epoch');
  if (!(live.epoch as string).endsWith('Z')) throw new DomainError('Event calendar must use UTC');
  number(live.periodDays, 'rotation days', 1, 90, true);
  const events = table(live.events, 'events');
  if (!events.length) throw new DomainError('Event calendar requires experiments');
  const eventIds = new Set(events.map((e) => e.id as string));
  for (const event of events) {
    string(event.name, 'event name');
    string(event.description, 'event description');
    references([event.component], componentIds, 'seasonal component');
    if (components.find((p) => p.id === event.component)?.discovery !== 'event')
      throw new DomainError('Event rewards require seasonal biology');
    references([event.mutation], new Set(mutations.map((m) => m.id as string)), 'event mutation');
    if (mutations.find((m) => m.id === event.mutation)?.eventId !== event.id)
      throw new DomainError('Limited mutation must belong to its event');
    references(
      [event.boss],
      new Set((advanced.bosses as Record<string, unknown>[]).map((b) => b.id as string)),
      'event boss',
    );
    for (const key of ['quantity', 'biomass']) number(event[key], key, 1, 1000, true);
    for (const [id, n] of Object.entries(record(event.resources, 'event resources'))) {
      references([id], resourceIds, 'event resource');
      number(n, 'event reward quantity', 1, 100, true);
    }
    const objective = record(event.objective, 'event objective');
    member(objective.type, ['manufacture', 'explore'], 'event objective');
    number(objective.count, 'event objective count', 1, 20, true);
    if (objective.type === 'manufacture')
      references(
        objective.tags,
        new Set(components.flatMap((p) => p.tags as string[])),
        'event biology',
      );
    else references([objective.regionId], regionIds, 'event region');
  }
  unique(
    events.map((e) => e.component as string),
    'seasonal rewards',
  );
  for (const m of mutations)
    if (m.eventId !== undefined) references([m.eventId], eventIds, 'limited mutation event');
  for (const p of components.filter((p) => p.discovery === 'event'))
    if (!events.some((e) => e.component === p.id))
      throw new DomainError('Seasonal component has no event');
  return structuredClone(c) as unknown as Catalog;
}
function validateCost(raw: unknown, resourceIds: Set<string>): void {
  const cost = record(raw, 'cost'),
    resources = record(cost.resources, 'resource cost');
  number(cost.biomass, 'biomass cost', 0, 10000, true);
  for (const [id, quantity] of Object.entries(resources)) {
    if (!resourceIds.has(id)) throw new DomainError(`Unknown cost resource: ${id}`);
    number(quantity, 'resource cost', 1, 1000, true);
  }
  if (!cost.biomass && !Object.keys(resources).length)
    throw new DomainError('Research costs cannot be empty');
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
  readonly research: Map<string, ResearchNode>;
  constructor(readonly catalog: Catalog) {
    this.components = new Map(catalog.components.map((v) => [v.id, v]));
    this.abilities = new Map(catalog.abilities.map((v) => [v.id, v]));
    this.traits = new Map(catalog.traits.map((v) => [v.id, v]));
    this.mutations = new Map(catalog.mutations.map((v) => [v.id, v]));
    this.resources = new Map(catalog.resources.map((v) => [v.id, v]));
    this.regions = new Map(catalog.regions.map((v) => [v.id, v]));
    this.research = new Map(catalog.research.map((v) => [v.id, v]));
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
