import type { ContentIndex } from '../domain/catalog.js';
import type { Cost, Creature } from '../domain/model.js';
import { deriveCreature, generateCreature, validateAnatomy } from '../domain/generator.js';
import { decodeCreature } from '../domain/serialization.js';
import { DomainError, date, number, string } from '../domain/validation.js';
import { hash } from '../domain/random.js';
import type { SaveRepository } from '../platform/save.js';
import type { Analytics } from '../platform/services.js';
import { decodeOptions, initialState } from './state.js';
import type { Options, PlayerState } from './state.js';
import {
  createBattle,
  currentActor,
  resolveAction,
  retreat,
  runEnemyTurns,
} from '../domain/combat.js';
import type { Action, Battle } from '../domain/combat.js';
import {
  advanceExpedition,
  expeditionRequirements,
  expeditionReward,
} from '../domain/exploration.js';
import type { Expedition, ExpeditionReward } from '../domain/exploration.js';
import {
  costRequirements,
  hasResearch,
  researchNode,
  researchRequirements,
  scannerLevel,
} from '../domain/research.js';
import type { ResearchProgress, Scan } from '../domain/research.js';
import { breedCreature } from '../domain/breeding.js';
import type { Challenge } from '../domain/challenges.js';
import { orderAt, orderRequirements, salePrice } from '../domain/economy.js';
import type { Sale } from '../domain/economy.js';
import {
  blueprintId,
  decodeProfile,
  decodeShare,
  encodeShare,
  galleryId,
} from '../domain/sharing.js';
import type { Blueprint, Profile } from '../domain/sharing.js';
import { currentEvent, eventProgress, seasonalAvailable } from '../domain/events.js';
export interface BattleReward {
  victory: boolean;
  biomass: number;
  quantities: Record<string, number>;
  newComponent: string | null;
  resources: Record<string, number>;
}
export class Workshop {
  private value: PlayerState;
  private revision = 0;
  constructor(
    readonly content: ContentIndex,
    private saves: SaveRepository<PlayerState>,
    private analytics: Analytics,
    seed: number,
  ) {
    const loaded = saves.load();
    this.value = loaded ?? initialState(content, seed);
    if (!loaded) saves.write(this.value);
  }
  get state(): PlayerState {
    return structuredClone(this.value);
  }
  // Session-local commits let delayed UI work detect intervening successful saves.
  get saveRevision(): number {
    return this.revision;
  }
  get creatures(): Creature[] {
    const sold = new Set(this.value.sales.map((sale) => sale.creatureId));
    return this.value.creatures
      .filter((c) => !sold.has(c.id))
      .map((c) => deriveCreature(c, this.content));
  }
  get orderSerial(): number {
    return this.value.sales.filter((sale) => sale.orderSerial !== null).length + 1;
  }
  get profile(): Profile {
    return { name: this.value.playerName, bio: this.value.biography };
  }
  updateProfile(name: string, bio: string): void {
    const profile = decodeProfile({ name, bio });
    this.transact((next) => {
      next.playerName = profile.name;
      next.biography = profile.bio;
    });
  }
  toggleShowcase(id: string): void {
    if (!this.creatures.some((c) => c.id === id)) throw new DomainError('Choose an owned specimen');
    this.transact((next) => {
      if (next.showcase.includes(id)) next.showcase = next.showcase.filter((x) => x !== id);
      else {
        if (next.showcase.length >= 3) throw new DomainError('Showcase up to three specimens');
        next.showcase.push(id);
      }
    });
  }
  saveBlueprint(id: string): Blueprint {
    const c = this.creatures.find((c) => c.id === id);
    if (!c) throw new DomainError('Choose an owned specimen');
    const source = {
      name: c.name,
      author: c.creator,
      componentIds: c.componentIds,
      controlledMutation: this.value.experiments.find((e) => e.creatureId === id)!
        .controlledMutation,
    };
    const blueprint = { id: blueprintId(source), ...source };
    this.transact((next) => {
      if (next.blueprints.some((b) => b.id === blueprint.id))
        throw new DomainError('Blueprint already saved');
      next.blueprints.push(blueprint);
    });
    return structuredClone(blueprint);
  }
  manufactureBlueprint(id: string, at: string): Creature {
    const b = this.value.blueprints.find((b) => b.id === id);
    if (!b) throw new DomainError('Unknown saved blueprint');
    return this.manufacture(b.componentIds, at, b.controlledMutation ?? undefined);
  }
  saveVisitorBlueprint(id: string): void {
    const g = this.value.gallery.find((g) => g.id === id);
    if (!g) throw new DomainError('Unknown visiting specimen');
    const recipe = {
      name: g.source.name,
      author: g.source.creator,
      componentIds: g.source.componentIds,
      controlledMutation: null,
    };
    const b = { id: blueprintId(recipe), ...recipe };
    this.transact((next) => {
      if (next.blueprints.some((x) => x.id === b.id))
        throw new DomainError('Blueprint already saved');
      next.blueprints.push(b);
    });
  }
  exportCreature(id: string): string {
    const c = this.creatures.find((c) => c.id === id);
    if (!c) throw new DomainError('Choose an owned specimen');
    return encodeShare(
      { kind: 'creature', profile: this.profile, creatures: [decodeCreature(c, this.content)] },
      this.content,
    );
  }
  exportBlueprint(id: string): string {
    const b = this.value.blueprints.find((b) => b.id === id);
    if (!b) throw new DomainError('Unknown saved blueprint');
    return encodeShare({ kind: 'blueprint', blueprint: b }, this.content);
  }
  exportShowcase(): string {
    if (!this.value.showcase.length) throw new DomainError('Add a creature to your showcase first');
    return encodeShare(
      {
        kind: 'showcase',
        profile: this.profile,
        creatures: this.value.showcase.map((id) =>
          decodeCreature(this.creatures.find((c) => c.id === id)!, this.content),
        ),
      },
      this.content,
    );
  }
  importShare(raw: string): void {
    const share = decodeShare(raw, this.content);
    this.transact((next) => {
      if (share.kind === 'blueprint') {
        if (next.blueprints.some((b) => b.id === share.blueprint.id))
          throw new DomainError('Blueprint already in your library');
        next.blueprints.push(share.blueprint);
      } else {
        let added = 0;
        for (const source of share.creatures) {
          const id = galleryId(source);
          if (!next.gallery.some((g) => g.id === id)) {
            next.gallery.push({ id, source, profile: share.profile });
            added++;
          }
        }
        if (!added) throw new DomainError('These specimens are already in your gallery');
      }
    });
  }
  removeBlueprint(id: string): void {
    this.transact((next) => {
      next.blueprints = next.blueprints.filter((b) => b.id !== id);
    });
  }
  removeGallery(id: string): void {
    this.transact((next) => {
      next.gallery = next.gallery.filter((g) => g.id !== id);
    });
  }
  buy(id: string, at?: string): void {
    const offer = this.content.catalog.economy.offers.find((o) => o.id === id);
    if (!offer) throw new DomainError('Unknown market offer');
    if (
      offer.type === 'component' &&
      this.content.component(offer.item).discovery === 'event' &&
      (!at || !seasonalAvailable(offer.item, at, this.content))
    )
      throw new DomainError('Seasonal supplies require their active event');
    if (offer.type === 'component' && !this.value.discoveredComponents.includes(offer.item))
      throw new DomainError('Discover this biology before buying samples');
    this.transact((next) => {
      this.spend(next, { biomass: offer.price, resources: {} });
      const stock = offer.type === 'component' ? next.inventory : next.resources;
      stock[offer.item] = (stock[offer.item] ?? 0) + offer.quantity;
    });
  }
  craft(id: string, at?: string): void {
    const recipe = this.content.catalog.economy.recipes.find((r) => r.id === id);
    if (!recipe) throw new DomainError('Unknown crafting recipe');
    if (
      this.content.component(recipe.component).discovery === 'event' &&
      (!at || !seasonalAvailable(recipe.component, at, this.content))
    )
      throw new DomainError('Seasonal crafting requires its active event');
    if (!this.value.discoveredComponents.includes(recipe.component))
      throw new DomainError('Discover this biology before crafting');
    this.transact((next) => {
      this.spend(next, recipe.cost);
      next.inventory[recipe.component] = (next.inventory[recipe.component] ?? 0) + recipe.quantity;
    });
  }
  sell(id: string, deliver = false): Sale {
    const c = this.creatures.find((c) => c.id === id);
    if (!c) throw new DomainError('Choose an owned creature');
    if (this.creatures.length < 2)
      throw new DomainError('Keep at least one creature for exploration');
    if (this.isAssigned(id) || (this.value.breedingCooldowns[id] ?? 0) > 0)
      throw new DomainError('Assigned or resting creatures cannot leave the habitat');
    const orderSerial = deliver ? this.orderSerial : null;
    const order = orderSerial ? orderAt(orderSerial, this.content) : null;
    const reasons = order ? orderRequirements(order, c, this.content) : [];
    if (reasons.length) throw new DomainError(reasons.join(' '));
    const sale: Sale = {
      creatureId: id,
      orderSerial,
      biomass: salePrice(c, this.content) + (order?.bonus ?? 0),
      resources: structuredClone(order?.resources ?? {}),
    };
    this.transact((next) => {
      next.biomass += sale.biomass;
      for (const [id, n] of Object.entries(sale.resources))
        next.resources[id] = (next.resources[id] ?? 0) + n;
      next.sales.push(sale);
      next.showcase = next.showcase.filter((x) => x !== id);
    });
    this.analytics.track(deliver ? 'order_delivered' : 'creature_sold', { biomass: sale.biomass });
    return sale;
  }
  isAssigned(id: string): boolean {
    return (
      this.value.expeditions.some((e) => e.source.id === id) ||
      !!this.value.activeBattle?.units.some((u) => u.team === 'player' && u.source.id === id)
    );
  }
  get completedRegions(): string[] {
    return [
      ...new Set(
        this.value.expeditionReports
          .filter((r) => r.outcome === 'collected')
          .map((r) => r.regionId),
      ),
    ];
  }
  joinEvent(at: string): void {
    const window = currentEvent(at, this.content);
    if (!window) throw new DomainError('The event calendar has not started');
    if (this.value.eventClaims.some((claim) => claim.run.window.key === window.key))
      throw new DomainError('This event reward was already claimed');
    if (this.value.eventRun?.window.key === window.key)
      throw new DomainError('Already enrolled in this experiment');
    this.transact((next) => {
      next.eventRun = {
        window,
        startedAt: at,
        baselineSerial: next.nextSerial,
        baselineExpeditionSerial: next.nextExpeditionSerial,
      };
    });
  }
  claimEvent(at: string): void {
    const run = this.value.eventRun,
      window = currentEvent(at, this.content);
    if (
      !run ||
      !window ||
      window.key !== run.window.key ||
      Date.parse(at) < Date.parse(run.startedAt)
    )
      throw new DomainError('No current event reward');
    const event = this.content.catalog.live.events.find((e) => e.id === window.templateId)!;
    if (
      eventProgress(
        run,
        this.value,
        this.content,
        this.value.nextSerial,
        this.value.nextExpeditionSerial,
        at,
      ) < event.objective.count
    )
      throw new DomainError('Complete this experiment first');
    this.transact((next) => {
      next.biomass += event.biomass;
      for (const [id, n] of Object.entries(event.resources))
        next.resources[id] = (next.resources[id] ?? 0) + n;
      next.inventory[event.component] = (next.inventory[event.component] ?? 0) + event.quantity;
      if (!next.discoveredComponents.includes(event.component))
        next.discoveredComponents.push(event.component);
      next.eventClaims.push({
        run,
        completedAt: at,
        endSerial: next.nextSerial,
        endExpeditionSerial: next.nextExpeditionSerial,
      });
      next.eventRun = null;
    });
    this.analytics.track('seasonal_experiment_completed', { event: event.id });
  }
  get researchProgress(): ResearchProgress {
    const state = this.state;
    return {
      completedResearch: state.completedResearch,
      scans: state.scans,
      experimentCount: state.experiments.length,
      discoveredMutations: state.discoveredMutations,
      completedRegions: this.completedRegions,
      biomass: state.biomass,
      resources: state.resources,
    };
  }
  private spend(state: PlayerState, cost: Cost): void {
    const reasons = costRequirements(cost, state.biomass, state.resources, this.content);
    if (reasons.length) throw new DomainError(reasons.join(' '));
    state.biomass -= cost.biomass;
    for (const [id, quantity] of Object.entries(cost.resources))
      state.resources[id] = state.resources[id]! - quantity;
  }
  completeResearch(id: string): void {
    const node = researchNode(id, this.content);
    const reasons = researchRequirements(node, this.researchProgress, this.content);
    if (reasons.length) throw new DomainError(reasons.join(' '));
    this.transact((next) => {
      this.spend(next, node.cost);
      next.completedResearch.push(id);
      if (node.unlock.type === 'component') {
        if (!next.discoveredComponents.includes(node.unlock.id))
          next.discoveredComponents.push(node.unlock.id);
        next.inventory[node.unlock.id] =
          (next.inventory[node.unlock.id] ?? 0) + node.unlock.quantity;
      }
    });
    this.analytics.track('research_completed', { id });
  }
  scanComponent(id: string, at: string): Scan {
    date(at, 'scan time');
    this.content.component(id);
    const level = scannerLevel(this.value.completedResearch, this.content);
    if (!level) throw new DomainError('Research a biological scanner first');
    if (!this.value.discoveredComponents.includes(id))
      throw new DomainError('Discover this component before scanning');
    const previous = this.value.scans.find((s) => s.componentId === id);
    if (previous && previous.level >= level)
      throw new DomainError('This component is already analyzed at the current scanner level');
    const cost =
      level === 1
        ? this.content.catalog.rules.research.basicScanCost
        : this.content.catalog.rules.research.advancedScanCost;
    const scan: Scan = { componentId: id, level: level as 1 | 2, scannedAt: at };
    this.transact((next) => {
      this.spend(next, cost);
      next.scans = [...next.scans.filter((s) => s.componentId !== id), scan];
    });
    this.analytics.track('component_scanned', { id, level });
    return scan;
  }
  cultivateComponent(id: string): void {
    const node = this.content.catalog.research.find(
      (n) => n.unlock.type === 'component' && n.unlock.id === id,
    );
    if (
      !node ||
      node.unlock.type !== 'component' ||
      !this.value.completedResearch.includes(node.id)
    )
      throw new DomainError('Research this biological blueprint first');
    const cost = node.unlock.synthesisCost;
    this.transact((next) => {
      this.spend(next, cost);
      next.inventory[id] = (next.inventory[id] ?? 0) + 1;
    });
  }
  startExpedition(regionId: string, creatureId: string, at: string): Expedition {
    date(at, 'departure time');
    const region = this.content.region(regionId),
      creature = this.creatures.find((c) => c.id === creatureId);
    const reasons = expeditionRequirements(region, creature, this.completedRegions, this.content);
    if (reasons.length) throw new DomainError(reasons.join(' '));
    if (this.isAssigned(creatureId)) throw new DomainError('This creature is already assigned');
    if (this.value.expeditions.length >= this.content.catalog.rules.exploration.maxAssignments)
      throw new DomainError('All expedition slots are occupied');
    const serial = this.value.nextExpeditionSerial,
      id = `expedition-${this.value.seedBase}-${serial}`;
    const job: Expedition = {
      id,
      serial,
      regionId,
      source: decodeCreature(creature!, this.content),
      seed: hash(id),
      elapsedMs: 0,
      startedAt: at,
    };
    this.transact((next) => {
      next.expeditions.push(job);
      next.nextExpeditionSerial++;
    });
    this.analytics.track('expedition_started', { region: regionId });
    return structuredClone(job);
  }
  advanceExpeditions(elapsedMs: number): void {
    number(elapsedMs, 'active play interval', 0, 1000, true);
    if (
      !elapsedMs ||
      (!this.value.expeditions.some(
        (e) => e.elapsedMs < this.content.region(e.regionId).durationMs,
      ) &&
        !Object.values(this.value.breedingCooldowns).some((ms) => ms > 0))
    )
      return;
    this.transact((next) => {
      next.expeditions = next.expeditions.map((job) =>
        advanceExpedition(job, elapsedMs, this.content),
      );
      for (const id of Object.keys(next.breedingCooldowns))
        next.breedingCooldowns[id] = Math.max(0, next.breedingCooldowns[id]! - elapsedMs);
    });
  }
  claimExpedition(id: string): ExpeditionReward {
    const job = this.value.expeditions.find((e) => e.id === id);
    if (!job) throw new DomainError('No unclaimed expedition');
    const reward = expeditionReward(job, this.content, this.value.discoveredComponents);
    const fresh = reward.discovery && !this.value.discoveredComponents.includes(reward.discovery);
    this.transact((next) => {
      next.biomass += reward.biomass;
      for (const [resource, quantity] of Object.entries(reward.resources))
        next.resources[resource] = (next.resources[resource] ?? 0) + quantity;
      for (const [component, quantity] of Object.entries(reward.components))
        next.inventory[component] = (next.inventory[component] ?? 0) + quantity;
      if (fresh) next.discoveredComponents.push(reward.discovery!);
      const creature = next.creatures.find((c) => c.id === job.source.id)!;
      creature.experience += reward.experience;
      creature.level = Math.min(
        100,
        1 + Math.floor(creature.experience / this.content.catalog.rules.combat.experiencePerLevel),
      );
      if (fresh) creature.history.discoveries++;
      next.expeditionReports.push({
        id,
        regionId: job.regionId,
        creatureId: job.source.id,
        outcome: 'collected',
        reward,
      });
      next.expeditions = next.expeditions.filter((e) => e.id !== id);
    });
    this.analytics.track('expedition_completed', { region: job.regionId, discovery: !!fresh });
    return structuredClone(reward);
  }
  cancelExpedition(id: string): void {
    const job = this.value.expeditions.find((e) => e.id === id);
    if (!job) throw new DomainError('Expedition not found');
    this.transact((next) => {
      next.expeditions = next.expeditions.filter((e) => e.id !== id);
      next.expeditionReports.push({
        id,
        regionId: job.regionId,
        creatureId: job.source.id,
        outcome: 'cancelled',
        reward: null,
      });
    });
  }
  cost(ids: string[]): number {
    return (
      this.content.catalog.rules.workshop.baseCost +
      validateAnatomy(ids, this.content).reduce((sum, p) => sum + p.energyCost, 0)
    );
  }
  breed(parentA: string, parentB: string, at: string): Creature {
    date(at, 'birth time');
    if (parentA === parentB) throw new DomainError('Choose two different parents');
    const parents = [parentA, parentB].map((id) => {
      const parent = this.creatures.find((c) => c.id === id);
      if (!parent) throw new DomainError('Choose owned parents');
      if (this.isAssigned(id) || (this.value.breedingCooldowns[id] ?? 0) > 0)
        throw new DomainError('This parent is assigned or resting');
      return decodeCreature(parent, this.content);
    });
    if (this.creatures.length >= this.content.catalog.rules.workshop.maxCreatures)
      throw new DomainError('Your habitat is full');
    const serial = this.value.nextSerial,
      seed = hash(`${this.value.seedBase}:birth:${serial}`);
    const child = breedCreature(parents[0]!, parents[1]!, this.content, {
      seed,
      id: `creature-${serial}`,
      createdAt: at,
      creator: this.value.playerName,
    });
    this.transact((next) => {
      this.spend(next, this.content.catalog.rules.breeding.cost);
      next.nextSerial++;
      const fresh = child.mutationIds.filter((id) => !next.discoveredMutations.includes(id));
      child.history.discoveries = fresh.length;
      next.discoveredMutations = [...new Set([...next.discoveredMutations, ...child.mutationIds])];
      next.creatures.push(decodeCreature(child, this.content));
      next.experiments.push({
        serial,
        creatureId: child.id,
        seed,
        componentIds: child.componentIds,
        compatibility: child.compatibility.score,
        mutationIds: child.mutationIds,
        createdAt: at,
        controlledMutation: null,
      });
      next.births.push({
        childId: child.id,
        parents: [structuredClone(parents[0]!), structuredClone(parents[1]!)],
      });
      for (const parent of parents)
        next.breedingCooldowns[parent.id] = this.content.catalog.rules.breeding.cooldownMs;
    });
    this.analytics.track('offspring_born', { generation: child.lineage!.generation });
    return child;
  }
  protected transact(change: (state: PlayerState) => void): void {
    const next = structuredClone(this.value);
    change(next);
    this.saves.write(next);
    this.value = next;
    this.revision++;
  }
  manufacture(ids: string[], at: string, controlledMutation?: string): Creature {
    date(at, 'creation time');
    const controlCost = controlledMutation
      ? this.content.catalog.rules.research.controlledMutationCost
      : { biomass: 0, resources: {} };
    if (
      controlledMutation &&
      (!hasResearch(this.value.completedResearch, 'mutation-control', this.content) ||
        !this.value.discoveredMutations.includes(controlledMutation))
    )
      throw new DomainError('Research mutation control and discover this mutation first');
    const cost = this.cost(ids) + controlCost.biomass,
      state = this.value;
    if (this.creatures.length >= this.content.catalog.rules.workshop.maxCreatures)
      throw new DomainError('Your habitat is full');
    if (cost > state.biomass)
      throw new DomainError('Not enough biomass. Complete a simulator battle to replenish it.');
    for (const id of ids)
      if (!state.discoveredComponents.includes(id) || (state.inventory[id] ?? 0) < 1)
        throw new DomainError(`No ${this.content.component(id).name} in storage`);
    const serial = state.nextSerial,
      seed = hash(`${state.seedBase}:${serial}`);
    const creature = generateCreature(ids, this.content, {
      seed,
      createdAt: at,
      creator: state.playerName,
      id: `creature-${serial}`,
      ...(controlledMutation ? { forceMutation: controlledMutation } : {}),
    });
    this.transact((next) => {
      this.spend(next, { biomass: cost, resources: controlCost.resources });
      next.nextSerial++;
      for (const id of ids) next.inventory[id] = next.inventory[id]! - 1;
      const fresh = creature.mutationIds.filter((id) => !next.discoveredMutations.includes(id));
      creature.history.discoveries = fresh.length;
      next.discoveredMutations = [
        ...new Set([...next.discoveredMutations, ...creature.mutationIds]),
      ];
      next.creatures.push(decodeCreature(creature, this.content));
      next.experiments.push({
        serial,
        creatureId: creature.id,
        componentIds: creature.componentIds,
        seed,
        compatibility: creature.compatibility.score,
        mutationIds: creature.mutationIds,
        createdAt: at,
        controlledMutation: controlledMutation ?? null,
      });
    });
    this.analytics.track('creature_created', {
      serial,
      compatibility: creature.compatibility.score,
      mutation: creature.mutationIds.length > 0,
      cost,
    });
    if (serial === 1) this.analytics.track('first_creature_created');
    if (creature.history.discoveries) this.analytics.track('mutation_discovered');
    return creature;
  }
  rename(id: string, name: string): void {
    const trimmed = string(name.trim(), 'name', 40);
    if (!this.creatures.some((c) => c.id === id)) throw new DomainError('Choose an owned creature');
    this.transact((next) => {
      const c = next.creatures.find((c) => c.id === id);
      if (!c) throw new DomainError('Creature not found');
      c.name = trimmed;
    });
  }
  updateOptions(options: Options): void {
    const valid = decodeOptions(options);
    this.transact((next) => {
      next.options = valid;
    });
  }
  exportSave(): string {
    return this.saves.export();
  }
  retrySave(): void {
    this.saves.write(this.value);
    this.revision++;
  }
  importSave(raw: string): void {
    this.value = this.saves.import(raw);
    this.revision++;
  }
  restoreBackup(): void {
    this.value = this.saves.restoreBackup();
    this.revision++;
  }
  startBattle(
    ids: string[],
    at: string,
    options?: { kind: 'boss' | 'tower'; bossId?: string; modifier?: Challenge['modifier'] },
  ): Battle {
    if (this.value.activeBattle) throw new DomainError('Finish the current field test first');
    const players = ids.map((id) => {
      const c = this.creatures.find((c) => c.id === id);
      if (!c) throw new DomainError('Choose owned creatures');
      if (this.isAssigned(id))
        throw new DomainError('An expedition creature cannot enter a field test');
      return c;
    });
    const challenge: Challenge | undefined = options
      ? {
          kind: options.kind,
          bossId:
            options.kind === 'boss'
              ? (options.bossId ?? this.content.catalog.advanced.bosses[0]!.id)
              : null,
          floor: options.kind === 'tower' ? this.value.towerFloor : 0,
          modifier: options.modifier ?? 'none',
          bossPhase: false,
        }
      : undefined;
    const boss =
      challenge?.kind === 'boss'
        ? this.content.catalog.advanced.bosses.find((b) => b.id === challenge.bossId)
        : undefined;
    if (challenge?.kind === 'boss' && !boss) throw new DomainError('Unknown boss');
    if (boss?.requiresRegion && !this.completedRegions.includes(boss.requiresRegion))
      throw new DomainError(
        `Explore ${this.content.region(boss.requiresRegion).name} before challenging this boss`,
      );
    const enemies = this.content.catalog.rules.combat.opponents.map((o, index) => {
      const c = generateCreature(
        index === 0 && boss ? boss.components : o.components,
        this.content,
        {
          seed: index === 0 && boss ? boss.seed : o.seed,
          createdAt: at,
          creator: 'Simulator',
          id: `opponent-${index + 1}`,
          skipMutations: true,
        },
      );
      c.name = index === 0 && boss ? boss.name : o.name;
      return c;
    });
    const serial = this.value.nextBattleSerial,
      id = `battle-${this.value.seedBase}-${serial}`,
      seed = hash(id);
    const battle = runEnemyTurns(
      createBattle(players, enemies, this.content, id, seed, at, challenge),
      this.content,
    );
    this.transact((next) => {
      next.activeBattle = battle;
      next.nextBattleSerial++;
    });
    this.analytics.track('battle_started', { serial });
    return battle;
  }
  battleAction(action: Action): Battle {
    if (!this.value.activeBattle) throw new DomainError('No active field test');
    if (currentActor(this.value.activeBattle)?.team !== 'player')
      throw new DomainError('There is no player turn to resolve');
    const battle = runEnemyTurns(
      resolveAction(this.value.activeBattle, action, this.content),
      this.content,
    );
    this.transact((next) => {
      next.activeBattle = battle;
    });
    return battle;
  }
  retreatBattle(): void {
    if (!this.value.activeBattle) throw new DomainError('No active field test');
    const battle = retreat(this.value.activeBattle);
    this.transact((next) => {
      next.activeBattle = battle;
    });
  }
  claimBattle(): BattleReward {
    const battle = this.value.activeBattle,
      rules = this.content.catalog.rules.combat;
    if (!battle || battle.status === 'active' || this.value.claimedBattles.includes(battle.id))
      throw new DomainError('No unclaimed result');
    const boss =
      battle.challenge?.kind === 'boss'
        ? this.content.catalog.advanced.bosses.find((b) => b.id === battle.challenge!.bossId)
        : undefined;
    const rewardComponent = boss?.discovery ?? (!battle.challenge ? rules.rewardComponent : null);
    const victory = battle.status === 'victory',
      newComponent =
        victory && rewardComponent && !this.value.discoveredComponents.includes(rewardComponent)
          ? rewardComponent
          : null;
    const quantities: Record<string, number> = {};
    if (victory && !battle.challenge)
      for (const p of this.content.components.values())
        if (
          p.discovery === 'starter' ||
          (p.discovery === 'battle' && this.value.discoveredComponents.includes(p.id)) ||
          p.id === rules.rewardComponent
        )
          quantities[p.id] = rules.rewardQuantity;
    if (victory && boss) quantities[boss.discovery] = newComponent ? 2 : 1;
    const reward: BattleReward = {
      victory,
      biomass: victory
        ? battle.challenge
          ? (boss?.biomass ?? 30 + Math.min(100, battle.challenge.floor)) +
            (battle.challenge.modifier === 'none' ? 0 : 10)
          : rules.victoryBiomass
        : rules.defeatBiomass,
      quantities,
      newComponent,
      resources:
        victory && battle.challenge
          ? boss
            ? structuredClone(boss.resources ?? { 'storm-essence': 3 })
            : { crystal: 1 }
          : {},
    };
    this.transact((next) => {
      next.biomass += reward.biomass;
      for (const [id, n] of Object.entries(reward.resources))
        next.resources[id] = (next.resources[id] ?? 0) + n;
      if (victory && battle.challenge?.kind === 'tower') next.towerFloor++;
      if (victory && boss && !next.bossVictories.includes(boss.id))
        next.bossVictories.push(boss.id);
      for (const [id, quantity] of Object.entries(quantities))
        next.inventory[id] = (next.inventory[id] ?? 0) + quantity;
      if (newComponent) next.discoveredComponents.push(newComponent);
      for (const unit of battle.units.filter((u) => u.team === 'player')) {
        const c = next.creatures.find((c) => c.id === unit.source.id)!;
        c.history.battles++;
        c.history.victories += victory ? 1 : 0;
        c.history.firstBattleAt ??= battle.startedAt;
        c.experience += victory ? rules.experience : 0;
        c.level = Math.min(100, 1 + Math.floor(c.experience / rules.experiencePerLevel));
      }
      next.claimedBattles.push(battle.id);
      next.activeBattle = null;
    });
    this.analytics.track('battle_completed', { victory, rounds: battle.round });
    if (newComponent) this.analytics.track('component_discovered', { id: newComponent });
    return reward;
  }
}
