import type { ContentIndex } from '../domain/catalog.js';
import type { CreatureSource } from '../domain/model.js';
import { decodeCreature } from '../domain/serialization.js';
import {
  DomainError,
  date,
  list,
  number,
  record,
  string,
  strings,
  unique,
} from '../domain/validation.js';
import type { Codec } from '../platform/save.js';
import { currentActor, decodeBattle } from '../domain/combat.js';
import type { Battle } from '../domain/combat.js';
import {
  decodeExpedition,
  decodeExpeditionReport,
  expeditionRequirements,
} from '../domain/exploration.js';
import type { Expedition, ExpeditionReport } from '../domain/exploration.js';
import { deriveCreature } from '../domain/generator.js';
import { hash } from '../domain/random.js';
export interface Options {
  sound: boolean;
  haptics: boolean;
  reducedMotion: boolean;
  textScale: number;
}
export interface Experiment {
  serial: number;
  creatureId: string;
  componentIds: string[];
  seed: number;
  compatibility: number;
  mutationIds: string[];
  createdAt: string;
}
export interface PlayerState {
  contentVersion: number;
  playerName: string;
  seedBase: number;
  nextSerial: number;
  nextBattleSerial: number;
  biomass: number;
  inventory: Record<string, number>;
  discoveredComponents: string[];
  discoveredMutations: string[];
  creatures: CreatureSource[];
  experiments: Experiment[];
  claimedBattles: string[];
  options: Options;
  activeBattle: Battle | null;
  nextExpeditionSerial: number;
  resources: Record<string, number>;
  expeditions: Expedition[];
  expeditionReports: ExpeditionReport[];
}
export function initialState(content: ContentIndex, seed: number): PlayerState {
  const starter = content.catalog.components.filter((p) => p.discovery === 'starter');
  return {
    contentVersion: content.catalog.version,
    playerName: 'Engineer',
    seedBase: seed,
    nextSerial: 1,
    nextBattleSerial: 1,
    biomass: content.catalog.rules.workshop.startingBiomass,
    inventory: Object.fromEntries(
      starter.map((p) => [p.id, content.catalog.rules.workshop.starterQuantity]),
    ),
    discoveredComponents: starter.map((p) => p.id),
    discoveredMutations: [],
    creatures: [],
    experiments: [],
    claimedBattles: [],
    options: { sound: false, haptics: false, reducedMotion: false, textScale: 1 },
    activeBattle: null,
    nextExpeditionSerial: 1,
    resources: {},
    expeditions: [],
    expeditionReports: [],
  };
}
export function decodeOptions(value: unknown): Options {
  const o = record(value, 'options');
  for (const k of ['sound', 'haptics', 'reducedMotion'])
    if (typeof o[k] !== 'boolean') throw new DomainError(`Invalid ${k} option`);
  number(o.textScale, 'text scale', 1, 1.4);
  return {
    sound: o.sound as boolean,
    haptics: o.haptics as boolean,
    reducedMotion: o.reducedMotion as boolean,
    textScale: o.textScale as number,
  };
}
export function stateCodec(content: ContentIndex): Codec<PlayerState> {
  return {
    decode(raw): PlayerState {
      const s = record(raw, 'player state');
      number(
        s.contentVersion,
        'content version',
        content.catalog.version,
        content.catalog.version,
        true,
      );
      string(s.playerName, 'player name', 40);
      number(s.seedBase, 'workshop seed', 0, 0xffffffff, true);
      number(s.nextSerial, 'serial', 1, 1000000, true);
      number(s.nextBattleSerial, 'battle serial', 1, 1000000, true);
      number(s.biomass, 'biomass', 0, 10000000, true);
      const discoveries = strings(
        s.discoveredComponents,
        'component discoveries',
        content.components.size,
      );
      unique(discoveries, 'discoveries');
      for (const id of discoveries) content.component(id);
      const inventory = record(s.inventory, 'inventory');
      for (const [id, quantity] of Object.entries(inventory)) {
        content.component(id);
        number(quantity, 'quantity', 0, 100000, true);
        if (!discoveries.includes(id))
          throw new DomainError('Inventory contains an undiscovered component');
      }
      const mutations = strings(
        s.discoveredMutations,
        'mutation discoveries',
        content.mutations.size,
      );
      unique(mutations, 'mutation discoveries');
      for (const id of mutations)
        if (!content.mutations.has(id)) throw new DomainError('Unknown mutation discovery');
      const creatures = list(
        s.creatures,
        'creatures',
        content.catalog.rules.workshop.maxCreatures,
      ).map((c) => decodeCreature(c, content));
      unique(
        creatures.map((c) => c.id),
        'creature identities',
      );
      for (const c of creatures)
        if (
          c.componentIds.some((id) => !discoveries.includes(id)) ||
          c.mutationIds.some((id) => !mutations.includes(id))
        )
          throw new DomainError('Creature has an unrecorded discovery');
      const experiments = list(
        s.experiments,
        'experiments',
        content.catalog.rules.workshop.maxCreatures,
      ).map((rawExperiment) => {
        const e = record(rawExperiment, 'experiment');
        number(e.serial, 'experiment serial', 1, (s.nextSerial as number) - 1, true);
        string(e.creatureId, 'experiment creature');
        number(e.seed, 'experiment seed', 0, 0xffffffff, true);
        number(e.compatibility, 'compatibility', 0, 100, true);
        date(e.createdAt, 'experiment date');
        const componentIds = strings(e.componentIds, 'experiment components', 6),
          mutationIds = strings(e.mutationIds, 'experiment mutations');
        const creature = creatures.find((c) => c.id === e.creatureId);
        if (
          !creature ||
          creature.seed !== e.seed ||
          JSON.stringify(creature.componentIds) !== JSON.stringify(componentIds) ||
          JSON.stringify(creature.mutationIds) !== JSON.stringify(mutationIds)
        )
          throw new DomainError('Experiment provenance does not match its creature');
        return {
          serial: e.serial,
          creatureId: e.creatureId,
          componentIds,
          seed: e.seed,
          compatibility: e.compatibility,
          mutationIds,
          createdAt: e.createdAt,
        } as Experiment;
      });
      unique(
        experiments.map((e) => String(e.serial)),
        'experiment serials',
      );
      unique(
        experiments.map((e) => e.creatureId),
        'experiment creatures',
      );
      if (experiments.length !== creatures.length)
        throw new DomainError('Every creature requires an experiment record');
      const claimedBattles = strings(s.claimedBattles, 'reward claims', 10000);
      unique(claimedBattles, 'reward claims');
      // Phase 4 schema-1 saves migrate by adding an empty battle; creature provenance is unchanged.
      const activeBattle =
        s.activeBattle === undefined || s.activeBattle === null
          ? null
          : decodeBattle(s.activeBattle, content);
      if (activeBattle) {
        if (activeBattle.status === 'active' && currentActor(activeBattle)?.team !== 'player')
          throw new DomainError('Saved battle contains an unresolved enemy turn');
        if (claimedBattles.includes(activeBattle.id))
          throw new DomainError('Battle reward was already claimed');
        for (const unit of activeBattle.units.filter((u) => u.team === 'player'))
          if (
            !creatures.some((c) => c.id === unit.source.id && c.signature === unit.source.signature)
          )
            throw new DomainError('Battle squad contains an unowned creature');
      }
      // Additive migration: earlier schema-1 saves have no expedition fields.
      const nextExpeditionSerial = number(
        s.nextExpeditionSerial ?? 1,
        'expedition serial',
        1,
        1000000,
        true,
      );
      const resources = record(s.resources ?? {}, 'resource storage');
      for (const [id, quantity] of Object.entries(resources)) {
        if (!content.resources.has(id)) throw new DomainError('Unknown stored resource');
        number(quantity, 'stored resource', 0, 1000000, true);
      }
      const expeditionReports = list(s.expeditionReports ?? [], 'expedition reports', 10000).map(
        (r) => decodeExpeditionReport(r, content),
      );
      const expeditions = list(
        s.expeditions ?? [],
        'expeditions',
        content.catalog.rules.exploration.maxAssignments,
      ).map((e) => decodeExpedition(e, content));
      const expeditionIdentity = (id: string): number => {
        const prefix = `expedition-${s.seedBase}-`;
        if (!id.startsWith(prefix)) throw new DomainError('Invalid expedition identity');
        const serial = number(
          Number(id.slice(prefix.length)),
          'expedition identity',
          1,
          nextExpeditionSerial - 1,
          true,
        );
        if (id !== `${prefix}${serial}`) throw new DomainError('Invalid expedition serial');
        return serial;
      };
      unique(
        [...expeditionReports.map((r) => r.id), ...expeditions.map((e) => e.id)],
        'expedition identities',
      );
      unique(
        expeditions.map((e) => e.source.id),
        'assigned creatures',
      );
      const completedRegions = expeditionReports
        .filter((r) => r.outcome === 'collected')
        .map((r) => r.regionId);
      for (const report of expeditionReports) {
        expeditionIdentity(report.id);
        if (!creatures.some((c) => c.id === report.creatureId))
          throw new DomainError('Report references an unowned creature');
        if (
          report.reward &&
          Object.keys(report.reward.components).some((id) => !discoveries.includes(id))
        )
          throw new DomainError('Report contains an unrecorded discovery');
      }
      for (const job of expeditions) {
        if (expeditionIdentity(job.id) !== job.serial || job.seed !== hash(job.id))
          throw new DomainError('Expedition provenance does not match');
        const owned = creatures.find((c) => c.id === job.source.id);
        if (!owned || owned.signature !== job.source.signature)
          throw new DomainError('Expedition contains an unowned creature');
        for (const key of [
          'componentIds',
          'genome',
          'mutationIds',
          'level',
          'training',
          'equipment',
        ] as const)
          if (JSON.stringify(owned[key]) !== JSON.stringify(job.source[key]))
            throw new DomainError('Expedition source does not match its owned creature');
        if (
          expeditionRequirements(
            content.region(job.regionId),
            deriveCreature(job.source, content),
            completedRegions,
            content,
          ).length
        )
          throw new DomainError('Expedition requirements are not satisfied');
        if (activeBattle?.units.some((u) => u.team === 'player' && u.source.id === owned.id))
          throw new DomainError('Creature cannot fight and explore simultaneously');
      }
      return structuredClone({
        contentVersion: s.contentVersion,
        playerName: s.playerName,
        seedBase: s.seedBase,
        nextSerial: s.nextSerial,
        nextBattleSerial: s.nextBattleSerial,
        biomass: s.biomass,
        inventory,
        discoveredComponents: discoveries,
        discoveredMutations: mutations,
        creatures,
        experiments,
        claimedBattles,
        options: decodeOptions(s.options),
        activeBattle,
        nextExpeditionSerial,
        resources,
        expeditions,
        expeditionReports,
      }) as PlayerState;
    },
  };
}
