import type { ContentIndex } from '../domain/catalog.js';
import type { Creature } from '../domain/model.js';
import { deriveCreature, generateCreature, validateAnatomy } from '../domain/generator.js';
import { decodeCreature } from '../domain/serialization.js';
import { DomainError, date, string } from '../domain/validation.js';
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
export interface BattleReward {
  victory: boolean;
  biomass: number;
  quantities: Record<string, number>;
  newComponent: string | null;
}
export class Workshop {
  private value: PlayerState;
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
  get creatures(): Creature[] {
    return this.value.creatures.map((c) => deriveCreature(c, this.content));
  }
  cost(ids: string[]): number {
    return (
      this.content.catalog.rules.workshop.baseCost +
      validateAnatomy(ids, this.content).reduce((sum, p) => sum + p.energyCost, 0)
    );
  }
  protected transact(change: (state: PlayerState) => void): void {
    const next = structuredClone(this.value);
    change(next);
    this.saves.write(next);
    this.value = next;
  }
  manufacture(ids: string[], at: string): Creature {
    date(at, 'creation time');
    const cost = this.cost(ids),
      state = this.value;
    if (state.creatures.length >= this.content.catalog.rules.workshop.maxCreatures)
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
    });
    this.transact((next) => {
      next.biomass -= cost;
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
  importSave(raw: string): void {
    this.value = this.saves.import(raw);
  }
  restoreBackup(): void {
    this.value = this.saves.restoreBackup();
  }
  startBattle(ids: string[], at: string): Battle {
    if (this.value.activeBattle) throw new DomainError('Finish the current field test first');
    const players = ids.map((id) => {
      const c = this.creatures.find((c) => c.id === id);
      if (!c) throw new DomainError('Choose owned creatures');
      return c;
    });
    const enemies = this.content.catalog.rules.combat.opponents.map((o, index) => {
      const c = generateCreature(o.components, this.content, {
        seed: o.seed,
        createdAt: at,
        creator: 'Simulator',
        id: `opponent-${index + 1}`,
        skipMutations: true,
      });
      c.name = o.name;
      return c;
    });
    const serial = this.value.nextBattleSerial,
      id = `battle-${this.value.seedBase}-${serial}`,
      seed = hash(id);
    const battle = runEnemyTurns(
      createBattle(players, enemies, this.content, id, seed, at),
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
    const victory = battle.status === 'victory',
      newComponent =
        victory && !this.value.discoveredComponents.includes(rules.rewardComponent)
          ? rules.rewardComponent
          : null;
    const quantities: Record<string, number> = {};
    if (victory)
      for (const p of this.content.components.values())
        if (
          p.discovery === 'starter' ||
          this.value.discoveredComponents.includes(p.id) ||
          p.id === rules.rewardComponent
        )
          quantities[p.id] = rules.rewardQuantity;
    const reward: BattleReward = {
      victory,
      biomass: victory ? rules.victoryBiomass : rules.defeatBiomass,
      quantities,
      newComponent,
    };
    this.transact((next) => {
      next.biomass += reward.biomass;
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
