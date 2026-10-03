import type { ContentIndex } from './catalog.js';
import type { Ability, Creature, CreatureSource, Stats, StatusId } from './model.js';
import { STATUS_IDS } from './model.js';
import { deriveCreature } from './generator.js';
import { decodeCreature } from './serialization.js';
import { challengeStats, decodeChallenge } from './challenges.js';
import type { Challenge } from './challenges.js';
import { clamp, Random } from './random.js';
import {
  DomainError,
  date,
  list,
  member,
  number,
  record,
  string,
  strings,
  unique,
} from './validation.js';
export interface Status {
  id: StatusId;
  duration: number;
  potency: number;
}
export interface Combatant {
  id: string;
  team: 'player' | 'enemy';
  source: CreatureSource;
  stats: Stats;
  hp: number;
  energy: number;
  shield: number;
  statuses: Status[];
  cooldowns: Record<string, number>;
}
export interface Battle {
  id: string;
  startedAt: string;
  round: number;
  turnIndex: number;
  order: string[];
  units: Combatant[];
  rngState: number;
  status: 'active' | 'victory' | 'defeat';
  reason: 'eliminated' | 'limit' | 'retreat' | null;
  log: string[];
  challenge?: Challenge;
}
export interface Action {
  actorId: string;
  abilityId: string;
  targetId: string;
}
function log(battle: Battle, message: string): void {
  battle.log.push(message);
  if (battle.log.length > 80) battle.log.shift();
}
function unit(
  creature: Creature,
  team: 'player' | 'enemy',
  content: ContentIndex,
  sources: Creature[],
  challenge?: Challenge,
): Combatant {
  const stats = challengeStats(creature, team, sources, content, challenge);
  return {
    id: `${team}:${creature.id}`,
    team,
    source: decodeCreature(creature, content),
    stats,
    hp: stats.hp,
    energy: stats.energy,
    shield: 0,
    statuses: [],
    cooldowns: {},
  };
}
export function currentActor(battle: Battle): Combatant | undefined {
  return battle.status === 'active'
    ? battle.units.find((u) => u.id === battle.order[battle.turnIndex])
    : undefined;
}
function speed(u: Combatant): number {
  return (
    u.stats.speed *
    (1 - (u.statuses.find((s) => s.id === 'slow')?.potency ?? 0)) *
    (1 + (u.statuses.find((s) => s.id === 'haste')?.potency ?? 0))
  );
}
function turnOrder(battle: Battle): string[] {
  return battle.units
    .filter((u) => u.hp > 0)
    .sort((a, b) => speed(b) - speed(a) || a.id.localeCompare(b.id, 'en'))
    .map((u) => u.id);
}
function finishIfEliminated(battle: Battle): boolean {
  if (!battle.units.some((u) => u.team === 'enemy' && u.hp > 0)) {
    battle.status = 'victory';
    battle.reason = 'eliminated';
    log(battle, 'Victory. Your inventions passed the field test.');
    return true;
  }
  if (!battle.units.some((u) => u.team === 'player' && u.hp > 0)) {
    battle.status = 'defeat';
    battle.reason = 'eliminated';
    log(battle, 'Test complete. All creatures will recover safely.');
    return true;
  }
  return false;
}
function healthDamage(target: Combatant, amount: number): void {
  const absorbed = Math.min(target.shield, amount);
  target.shield -= absorbed;
  target.hp = Math.max(0, target.hp - (amount - absorbed));
}
function beginTurn(battle: Battle, content: ContentIndex): void {
  const actor = currentActor(battle);
  if (!actor || actor.hp === 0) return;
  actor.energy = Math.min(
    actor.stats.energy,
    actor.energy + content.catalog.rules.combat.energyPerTurn,
  );
  for (const status of actor.statuses) {
    if (status.id === 'burn' || status.id === 'poison') {
      const damage = Math.round(status.potency);
      healthDamage(actor, damage);
      log(battle, `${actor.source.name} takes ${damage} ${status.id} damage.`);
    }
    if (status.id === 'regeneration' && actor.hp > 0) {
      const healed = Math.min(actor.stats.hp - actor.hp, Math.round(status.potency));
      actor.hp += healed;
      log(battle, `${actor.source.name} regenerates ${healed} health.`);
    }
  }
}
function prepareTurn(battle: Battle, content: ContentIndex): void {
  // At most six units per round. Status damage can defeat the next actor before its action.
  while (battle.status === 'active') {
    if (finishIfEliminated(battle)) return;
    if (battle.turnIndex >= battle.order.length) {
      if (battle.round >= content.catalog.rules.combat.maxRounds) {
        battle.status = 'defeat';
        battle.reason = 'limit';
        log(battle, 'Simulator time limit reached. Your creatures recover.');
        return;
      }
      battle.round++;
      battle.turnIndex = 0;
      battle.order = turnOrder(battle);
      log(battle, `Round ${battle.round}.`);
    }
    const actor = currentActor(battle)!;
    if (actor.hp === 0) {
      battle.turnIndex++;
      continue;
    }
    beginTurn(battle, content);
    if (actor.hp === 0) {
      battle.turnIndex++;
      continue;
    }
    if (actor.statuses.some((s) => s.id === 'frozen')) {
      log(battle, `${actor.source.name} is frozen and misses a turn.`);
      actor.statuses = actor.statuses
        .map((s) => ({ ...s, duration: s.duration - 1 }))
        .filter((s) => s.duration > 0);
      for (const id of Object.keys(actor.cooldowns))
        actor.cooldowns[id] = Math.max(0, actor.cooldowns[id]! - 1);
      battle.turnIndex++;
      continue;
    }
    break;
  }
}
export function createBattle(
  players: Creature[],
  enemies: Creature[],
  content: ContentIndex,
  id: string,
  seed: number,
  startedAt: string,
  challenge?: Challenge,
): Battle {
  if (players.length !== 3 || enemies.length !== 3)
    throw new DomainError('Choose exactly three creatures');
  unique(
    players.map((c) => c.id),
    'squad members',
  );
  unique(
    enemies.map((c) => c.id),
    'opponents',
  );
  number(seed, 'battle seed', 0, 0xffffffff, true);
  string(id, 'battle id');
  date(startedAt, 'battle time');
  const battle: Battle = {
    id,
    startedAt,
    round: 1,
    turnIndex: 0,
    order: [],
    units: [
      ...players.map((c) => unit(c, 'player', content, players, challenge)),
      ...enemies.map((c) => unit(c, 'enemy', content, enemies, challenge)),
    ],
    rngState: seed,
    status: 'active',
    reason: null,
    log: ['The simulator awakens. Three inventions. One field test.'],
    ...(challenge ? { challenge: decodeChallenge(challenge, content) } : {}),
  };
  battle.order = turnOrder(battle);
  prepareTurn(battle, content);
  return battle;
}
export function availableAbilities(unit: Combatant, content: ContentIndex): Ability[] {
  return deriveCreature(unit.source, content).abilityIds.map((id) => content.ability(id));
}
export function canUse(unit: Combatant, ability: Ability): boolean {
  return unit.hp > 0 && unit.energy >= ability.cost && (unit.cooldowns[ability.id] ?? 0) === 0;
}
export function damageAmount(
  raw: number,
  defense: number,
  armorFactor: number,
  resistance: number,
  critical: boolean,
  criticalMultiplier: number,
): number {
  return Math.max(
    1,
    Math.round(
      (raw / (1 + defense * armorFactor)) * resistance * (critical ? criticalMultiplier : 1),
    ),
  );
}
export function resolveAction(previous: Battle, action: Action, content: ContentIndex): Battle {
  const current = currentActor(previous);
  if (!current || current.id !== action.actorId)
    throw new DomainError('It is not that creature’s turn');
  const ability = availableAbilities(current, content).find((a) => a.id === action.abilityId);
  if (!ability || !canUse(current, ability))
    throw new DomainError('Ability is unavailable, cooling down or needs more energy');
  const chosen = previous.units.find((u) => u.id === action.targetId);
  if (
    !chosen ||
    chosen.hp === 0 ||
    (ability.target === 'enemy' && chosen.team === current.team) ||
    (ability.target === 'ally' && chosen.team !== current.team) ||
    (ability.target === 'self' && chosen.id !== current.id)
  )
    throw new DomainError('Choose a valid living target');
  const battle = structuredClone(previous),
    actor = currentActor(battle)!,
    target = battle.units.find((u) => u.id === action.targetId)!;
  const oldStatuses = new Set(actor.statuses.map((s) => s.id)),
    random = new Random(battle.rngState),
    rules = content.catalog.rules.combat;
  actor.energy -= ability.cost;
  log(battle, `${actor.source.name} uses ${ability.name} on ${target.source.name}.`);
  for (const effect of ability.effects) {
    if (effect.type === 'damage') {
      const reaction = battle.challenge
        ? content.catalog.advanced.reactions.find(
            (r) => r.element === effect.element && target.statuses.some((s) => s.id === r.requires),
          )
        : undefined;
      if (reaction) {
        target.statuses = target.statuses.filter(
          (s) => s.id !== reaction.requires && s.id !== reaction.status,
        );
        target.statuses.push({
          id: reaction.status,
          duration: reaction.duration,
          potency: reaction.potency,
        });
        log(battle, `${reaction.name}! ${target.source.name} gains ${reaction.status}.`);
      }
      const critical = random.next() < rules.criticalChance;
      const element = deriveCreature(target.source, content).element;
      const resistance =
        rules.resistances.find((r) => r.attack === effect.element && r.defense === element)
          ?.multiplier ?? 1;
      const debuff = actor.statuses
        .filter((s) => s.id === 'shock' || s.id === 'weakness')
        .reduce((factor, s) => factor * (1 - clamp(s.potency, 0, 1)), 1);
      const damage = damageAmount(
        actor.stats[effect.scaling] * effect.power * debuff * (reaction?.multiplier ?? 1),
        target.stats.defense *
          (1 -
            (target.statuses.find((s) => s.id === 'armor-break' || s.id === 'conductive')
              ?.potency ?? 0)),
        rules.armorFactor,
        resistance,
        critical,
        rules.criticalMultiplier,
      );
      healthDamage(target, damage);
      log(
        battle,
        `${target.source.name}: ${damage} ${effect.element} damage${critical ? ' — critical!' : ''}.`,
      );
    }
    if (effect.type === 'heal') {
      const healed = Math.min(target.stats.hp - target.hp, Math.round(effect.power));
      target.hp += healed;
      log(battle, `${target.source.name} recovers ${healed} health.`);
    }
    if (effect.type === 'shield') {
      target.shield = Math.min(target.stats.hp, target.shield + Math.round(effect.power));
      log(battle, `${target.source.name} gains a ${effect.power} shield.`);
    }
    if (effect.type === 'status' && target.hp > 0 && random.next() < effect.chance) {
      const existing = target.statuses.find((s) => s.id === effect.status);
      if (existing) {
        existing.duration = Math.max(existing.duration, effect.duration);
        existing.potency = Math.max(existing.potency, effect.potency);
      } else
        target.statuses.push({
          id: effect.status,
          duration: effect.duration,
          potency: effect.potency,
        });
      log(battle, `${target.source.name} gains ${effect.status} for ${effect.duration} turns.`);
    }
  }
  const bossUnit = battle.units.find((u) => u.team === 'enemy' && u.source.id === 'opponent-1');
  if (
    battle.challenge?.kind === 'boss' &&
    !battle.challenge.bossPhase &&
    bossUnit &&
    bossUnit.hp > 0
  ) {
    const boss = content.catalog.advanced.bosses.find((b) => b.id === battle.challenge!.bossId)!;
    if (bossUnit.hp <= bossUnit.stats.hp * boss.phaseAt) {
      battle.challenge.bossPhase = true;
      bossUnit.stats = challengeStats(
        bossUnit.source,
        'enemy',
        battle.units.filter((u) => u.team === 'enemy').map((u) => u.source),
        content,
        battle.challenge,
      );
      bossUnit.shield = Math.min(bossUnit.stats.hp, bossUnit.shield + boss.shield);
      bossUnit.statuses = [
        ...bossUnit.statuses.filter((s) => s.id !== 'regeneration'),
        { id: 'regeneration', duration: 3, potency: boss.regeneration },
      ];
      log(
        battle,
        `${boss.name} enters its charged phase: shield, regeneration and amplified power!`,
      );
    }
  }
  // Tick existing cooldowns only after an action. A cooldown of N blocks the next N own turns.
  for (const id of Object.keys(actor.cooldowns))
    actor.cooldowns[id] = Math.max(0, actor.cooldowns[id]! - 1);
  actor.cooldowns[ability.id] = ability.cooldown;
  actor.statuses = actor.statuses
    .map((s) => ({ ...s, duration: s.duration - (oldStatuses.has(s.id) ? 1 : 0) }))
    .filter((s) => s.duration > 0);
  battle.rngState = random.state;
  battle.turnIndex++;
  if (!finishIfEliminated(battle)) prepareTurn(battle, content);
  return battle;
}
export function chooseAction(battle: Battle, content: ContentIndex, basicOnly = false): Action {
  const actor = currentActor(battle);
  if (!actor) throw new DomainError('Battle has ended');
  const allies = battle.units.filter((u) => u.team === actor.team && u.hp > 0),
    enemies = battle.units.filter((u) => u.team !== actor.team && u.hp > 0);
  const usable = availableAbilities(actor, content).filter((a) => canUse(actor, a));
  const wounded = [...allies].sort((a, b) => a.hp / a.stats.hp - b.hp / b.stats.hp)[0]!;
  const heal = usable.find((a) => a.target === 'ally' && a.effects.some((e) => e.type === 'heal'));
  if (!basicOnly && heal && wounded.hp / wounded.stats.hp < 0.35)
    return { actorId: actor.id, abilityId: heal.id, targetId: wounded.id };
  const ability = basicOnly
    ? content.ability('strike')
    : usable
        .filter((a) => a.target === 'enemy')
        .sort((a, b) => {
          const weight = (ability: Ability): number =>
            ability.effects.reduce(
              (sum, e) => sum + (e.type === 'damage' ? e.power * actor.stats[e.scaling] : 0),
              0,
            );
          return weight(b) - weight(a) || a.id.localeCompare(b.id, 'en');
        })[0]!;
  const target = [...enemies].sort((a, b) => a.hp - b.hp || a.id.localeCompare(b.id, 'en'))[0]!;
  return { actorId: actor.id, abilityId: ability.id, targetId: target.id };
}
export function runEnemyTurns(previous: Battle, content: ContentIndex): Battle {
  let battle = previous;
  while (currentActor(battle)?.team === 'enemy')
    battle = resolveAction(battle, chooseAction(battle, content), content);
  return battle;
}
export function retreat(previous: Battle): Battle {
  if (previous.status !== 'active') throw new DomainError('Battle has ended');
  const battle = structuredClone(previous);
  battle.status = 'defeat';
  battle.reason = 'retreat';
  log(battle, 'Test cancelled. All specimens return to the habitat.');
  return battle;
}
export function decodeBattle(value: unknown, content: ContentIndex): Battle {
  const b = record(value, 'battle');
  string(b.id, 'battle id');
  date(b.startedAt, 'battle date');
  number(b.round, 'round', 1, content.catalog.rules.combat.maxRounds, true);
  number(b.rngState, 'random state', 0, 0xffffffff, true);
  member(b.status, ['active', 'victory', 'defeat'], 'battle status');
  if (b.reason !== null) member(b.reason, ['eliminated', 'limit', 'retreat'], 'battle reason');
  const challenge = b.challenge === undefined ? undefined : decodeChallenge(b.challenge, content);
  const rawUnits = list(b.units, 'combatants', 6).map((u) => record(u, 'combatant'));
  const units = rawUnits.map((raw) => {
    const u = record(raw, 'combatant');
    string(u.id, 'combatant id');
    const team = member(u.team, ['player', 'enemy'], 'team');
    const source = decodeCreature(u.source, content),
      creature = deriveCreature(source, content),
      stats = challengeStats(
        source,
        team,
        rawUnits.filter((u) => u.team === team).map((u) => decodeCreature(u.source, content)),
        content,
        challenge,
      );
    if (u.id !== `${team}:${source.id}`)
      throw new DomainError('Combatant identity does not match its source');
    number(u.hp, 'health', 0, stats.hp, true);
    number(u.energy, 'energy', 0, stats.energy, true);
    number(u.shield, 'shield', 0, stats.hp, true);
    const statuses = list(u.statuses, 'statuses', STATUS_IDS.length).map((rawStatus) => {
      const s = record(rawStatus, 'status');
      return {
        id: member(s.id, STATUS_IDS, 'status'),
        duration: number(s.duration, 'status duration', 1, 100, true),
        potency: number(
          s.potency,
          'potency',
          0,
          ['shock', 'weakness', 'slow', 'conductive', 'armor-break', 'haste'].includes(
            s.id as string,
          )
            ? 1
            : 1000,
        ),
      };
    });
    unique(
      statuses.map((s) => s.id),
      'statuses',
    );
    const cooldowns = record(u.cooldowns, 'cooldowns');
    for (const [id, ticks] of Object.entries(cooldowns)) {
      if (!creature.abilityIds.includes(id)) throw new DomainError('Unknown ability cooldown');
      number(ticks, 'cooldown', 0, content.ability(id).cooldown, true);
    }
    return {
      id: u.id,
      team,
      source,
      stats,
      hp: u.hp,
      energy: u.energy,
      shield: u.shield,
      statuses,
      cooldowns,
    } as Combatant;
  });
  if (
    units.filter((u) => u.team === 'player').length !== 3 ||
    units.filter((u) => u.team === 'enemy').length !== 3
  )
    throw new DomainError('Battle must contain two teams of three');
  unique(
    units.map((u) => u.id),
    'combatants',
  );
  const order = strings(b.order, 'turn order', 6);
  unique(order, 'turn order');
  if (
    !order.length ||
    order.some((id) => !units.some((u) => u.id === id)) ||
    units.some((u) => u.hp > 0 && !order.includes(u.id))
  )
    throw new DomainError('Invalid turn order');
  number(b.turnIndex, 'turn index', 0, order.length, true);
  const messages = list(b.log, 'battle log', 80).map((v) => string(v, 'battle log', 500));
  const playersAlive = units.some((u) => u.team === 'player' && u.hp > 0),
    enemiesAlive = units.some((u) => u.team === 'enemy' && u.hp > 0);
  if (
    b.status === 'active' &&
    (!playersAlive ||
      !enemiesAlive ||
      b.reason !== null ||
      !units.some((u) => u.id === order[b.turnIndex as number] && u.hp > 0))
  )
    throw new DomainError('Invalid active battle');
  if (b.status === 'victory' && (enemiesAlive || !playersAlive || b.reason !== 'eliminated'))
    throw new DomainError('Invalid victory');
  if (
    b.status === 'defeat' &&
    (b.reason === null ||
      (b.reason === 'eliminated' && playersAlive) ||
      (b.reason === 'limit' && b.round !== content.catalog.rules.combat.maxRounds))
  )
    throw new DomainError('Invalid defeat');
  return structuredClone({
    id: b.id,
    startedAt: b.startedAt,
    round: b.round,
    turnIndex: b.turnIndex,
    order,
    units,
    rngState: b.rngState,
    status: b.status,
    reason: b.reason,
    log: messages,
    ...(challenge ? { challenge } : {}),
  }) as Battle;
}
