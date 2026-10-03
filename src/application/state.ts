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
import { decodeScan, hasResearch, researchRequirements, scannerLevel } from '../domain/research.js';
import type { Scan, ResearchProgress } from '../domain/research.js';
import { breedCreature } from '../domain/breeding.js';
import type { Birth } from '../domain/breeding.js';
import { orderAt, orderRequirements, salePrice } from '../domain/economy.js';
import type { Sale } from '../domain/economy.js';
import { decodeBlueprint, decodeGallery } from '../domain/sharing.js';
import type { Blueprint, GalleryEntry } from '../domain/sharing.js';
import { decodeEventRun, eventProgress } from '../domain/events.js';
import type { EventRun, EventClaim } from '../domain/events.js';
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
  controlledMutation: string | null;
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
  completedResearch: string[];
  scans: Scan[];
  births: Birth[];
  breedingCooldowns: Record<string, number>;
  towerFloor: number;
  bossVictories: string[];
  sales: Sale[];
  biography: string;
  showcase: string[];
  blueprints: Blueprint[];
  gallery: GalleryEntry[];
  eventRun: EventRun | null;
  eventClaims: EventClaim[];
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
    completedResearch: [],
    scans: [],
    births: [],
    breedingCooldowns: {},
    towerFloor: 1,
    bossVictories: [],
    sales: [],
    biography: 'Curious creature engineer.',
    showcase: [],
    blueprints: [],
    gallery: [],
    eventRun: null,
    eventClaims: [],
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
      const creatures = list(s.creatures, 'creatures', 10000).map((c) =>
        decodeCreature(c, content),
      );
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
      const sales = list(s.sales ?? [], 'creature sales', creatures.length).map((raw) => {
        const sale = record(raw, 'sale'),
          creatureId = string(sale.creatureId, 'sold creature');
        const source = creatures.find((c) => c.id === creatureId);
        if (!source) throw new DomainError('Sale references an unknown creature');
        const c = deriveCreature(source, content);
        const orderSerial =
          sale.orderSerial === null
            ? null
            : number(sale.orderSerial, 'order serial', 1, 10000, true);
        const order = orderSerial ? orderAt(orderSerial, content) : null;
        if (order && orderRequirements(order, c, content).length)
          throw new DomainError('Delivered creature does not satisfy the request');
        const expected = {
          biomass: salePrice(c, content) + (order?.bonus ?? 0),
          resources: order?.resources ?? {},
        };
        if (
          sale.biomass !== expected.biomass ||
          JSON.stringify(sale.resources) !== JSON.stringify(expected.resources)
        )
          throw new DomainError('Incorrect sale reward');
        return { creatureId, orderSerial, ...expected };
      });
      unique(
        sales.map((sale) => sale.creatureId),
        'sales',
      );
      const serials = sales
        .filter((sale) => sale.orderSerial !== null)
        .map((sale) => sale.orderSerial!)
        .sort((a, b) => a - b);
      if (serials.some((serial, i) => serial !== i + 1))
        throw new DomainError('Invalid request progression');
      const sold = new Set(sales.map((sale) => sale.creatureId));
      const habitat = creatures.filter((c) => !sold.has(c.id));
      const biography = string(s.biography ?? 'Curious creature engineer.', 'biography', 240);
      const showcase = strings(s.showcase ?? [], 'showcase', 3);
      unique(showcase, 'showcase specimens');
      for (const id of showcase)
        if (!habitat.some((c) => c.id === id))
          throw new DomainError('Showcase contains an unavailable creature');
      const blueprints = list(s.blueprints ?? [], 'blueprints', 50).map((b) =>
        decodeBlueprint(b, content),
      );
      unique(
        blueprints.map((b) => b.id),
        'blueprints',
      );
      const gallery = list(s.gallery ?? [], 'gallery', 100).map((g) => decodeGallery(g, content));
      unique(
        gallery.map((g) => g.id),
        'gallery',
      );
      if (
        habitat.length > content.catalog.rules.workshop.maxCreatures ||
        (creatures.length && !habitat.length)
      )
        throw new DomainError('Invalid habitat capacity');
      const experiments = list(s.experiments, 'experiments', 10000).map((rawExperiment) => {
        const e = record(rawExperiment, 'experiment');
        number(e.serial, 'experiment serial', 1, (s.nextSerial as number) - 1, true);
        string(e.creatureId, 'experiment creature');
        number(e.seed, 'experiment seed', 0, 0xffffffff, true);
        number(e.compatibility, 'compatibility', 0, 100, true);
        date(e.createdAt, 'experiment date');
        const componentIds = strings(e.componentIds, 'experiment components', 6),
          mutationIds = strings(e.mutationIds, 'experiment mutations');
        const creature = creatures.find((c) => c.id === e.creatureId);
        const controlledMutation =
          e.controlledMutation === undefined || e.controlledMutation === null
            ? null
            : string(e.controlledMutation, 'controlled mutation');
        if (controlledMutation && !mutationIds.includes(controlledMutation))
          throw new DomainError('Controlled mutation is missing from the creature');
        if (
          !creature ||
          creature.seed !== e.seed ||
          creature.createdAt !== e.createdAt ||
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
          controlledMutation,
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
            !habitat.some((c) => c.id === unit.source.id && c.signature === unit.source.signature)
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
        const owned = habitat.find((c) => c.id === job.source.id);
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
      const completedResearch = strings(
        s.completedResearch ?? [],
        'completed research',
        content.research.size,
      );
      unique(completedResearch, 'completed research');
      for (const id of completedResearch)
        if (!content.research.has(id)) throw new DomainError('Unknown completed research');
      const scans = list(s.scans ?? [], 'component scans', content.components.size).map((v) =>
        decodeScan(v, content),
      );
      unique(
        scans.map((scan) => scan.componentId),
        'component scans',
      );
      for (const scan of scans)
        if (
          !discoveries.includes(scan.componentId) ||
          scan.level > scannerLevel(completedResearch, content)
        )
          throw new DomainError('Scan exceeds available discoveries or scanner capability');
      const progress: ResearchProgress = {
        completedResearch,
        scans,
        experimentCount: experiments.length,
        discoveredMutations: mutations,
        completedRegions,
        biomass: s.biomass as number,
        resources: resources as Record<string, number>,
      };
      for (const id of completedResearch)
        if (
          researchRequirements(
            content.research.get(id)!,
            { ...progress, completedResearch: completedResearch.filter((r) => r !== id) },
            content,
            false,
          ).length
        )
          throw new DomainError('Completed research has unmet prerequisites or objectives');
      for (const id of discoveries.filter((id) => content.component(id).discovery === 'research'))
        if (
          !completedResearch.some((r) => {
            const unlock = content.research.get(r)!.unlock;
            return unlock.type === 'component' && unlock.id === id;
          })
        )
          throw new DomainError('Research component has no unlocked blueprint');
      for (const id of completedResearch) {
        const unlock = content.research.get(id)!.unlock;
        if (unlock.type === 'component' && !discoveries.includes(unlock.id))
          throw new DomainError('Research component discovery is missing');
      }
      if (
        experiments.some((e) => e.controlledMutation) &&
        !hasResearch(completedResearch, 'mutation-control', content)
      )
        throw new DomainError('Controlled experiment requires mutation research');
      const breedingCooldowns = record(s.breedingCooldowns ?? {}, 'breeding cooldowns');
      for (const [id, remaining] of Object.entries(breedingCooldowns)) {
        if (!creatures.some((c) => c.id === id)) throw new DomainError('Unknown resting parent');
        number(remaining, 'breeding cooldown', 0, content.catalog.rules.breeding.cooldownMs, true);
      }
      const births = list(s.births ?? [], 'births', creatures.length).map((value) => {
        const birth = record(value, 'birth'),
          childId = string(birth.childId, 'offspring');
        const parents = list(birth.parents, 'parent snapshots', 2).map((p) =>
          decodeCreature(p, content),
        );
        if (parents.length !== 2) throw new DomainError('Two parent snapshots required');
        const child = creatures.find((c) => c.id === childId);
        if (
          !child?.lineage ||
          parents.some((p) => !creatures.some((c) => c.id === p.id && c.signature === p.signature))
        )
          throw new DomainError('Invalid family ownership');
        const childSerial = experiments.find((e) => e.creatureId === childId)!.serial;
        if (
          parents.some((p) => experiments.find((e) => e.creatureId === p.id)!.serial >= childSerial)
        )
          throw new DomainError('Cyclic lineage');
        const expected = breedCreature(parents[0]!, parents[1]!, content, {
          seed: child.seed,
          id: child.id,
          creator: child.creator,
          createdAt: child.createdAt,
        });
        for (const key of [
          'signature',
          'genome',
          'componentIds',
          'mutationIds',
          'lineage',
        ] as const)
          if (JSON.stringify(child[key]) !== JSON.stringify(expected[key]))
            throw new DomainError('Offspring provenance is invalid');
        return { childId, parents: parents as [CreatureSource, CreatureSource] };
      });
      unique(
        births.map((b) => b.childId),
        'births',
      );
      if (creatures.filter((c) => c.lineage).length !== births.length)
        throw new DomainError('Missing birth record');
      const towerFloor = number(s.towerFloor ?? 1, 'tower floor', 1, 1000000, true);
      const bossVictories = strings(
        s.bossVictories ?? [],
        'boss victories',
        content.catalog.advanced.bosses.length,
      );
      unique(bossVictories, 'boss victories');
      for (const id of bossVictories)
        if (!content.catalog.advanced.bosses.some((b) => b.id === id))
          throw new DomainError('Unknown defeated boss');
      const eventRun =
        s.eventRun === undefined || s.eventRun === null
          ? null
          : decodeEventRun(s.eventRun, content, s.nextSerial as number, nextExpeditionSerial);
      const eventClaims = list(s.eventClaims ?? [], 'event claims', 10000).map((raw) => {
        const claim = record(raw, 'event claim');
        const run = decodeEventRun(
          claim.run,
          content,
          s.nextSerial as number,
          nextExpeditionSerial,
        );
        const completedAt = date(claim.completedAt, 'event completion');
        if (
          Date.parse(completedAt) < Date.parse(run.startedAt) ||
          Date.parse(completedAt) >= Date.parse(run.window.endsAt)
        )
          throw new DomainError('Claim is outside its event');
        const endSerial = number(
          claim.endSerial,
          'event completed serial',
          run.baselineSerial,
          s.nextSerial as number,
          true,
        );
        const endExpeditionSerial = number(
          claim.endExpeditionSerial,
          'event completed expedition serial',
          run.baselineExpeditionSerial,
          nextExpeditionSerial,
          true,
        );
        const event = content.catalog.live.events.find((e) => e.id === run.window.templateId)!;
        if (
          eventProgress(
            run,
            { creatures, experiments, expeditionReports, seedBase: s.seedBase as number },
            content,
            endSerial,
            endExpeditionSerial,
            completedAt,
          ) < event.objective.count
        )
          throw new DomainError('Event objective has not been completed');
        if (!discoveries.includes(event.component))
          throw new DomainError('Event discovery is missing');
        return { run, completedAt, endSerial, endExpeditionSerial };
      });
      unique(
        eventClaims.map((claim) => claim.run.window.key),
        'event reward claims',
      );
      if (eventRun && eventClaims.some((claim) => claim.run.window.key === eventRun.window.key))
        throw new DomainError('Completed event is still enrolled');
      for (const id of discoveries.filter((id) => content.component(id).discovery === 'event'))
        if (
          !eventClaims.some(
            (claim) =>
              content.catalog.live.events.find((e) => e.id === claim.run.window.templateId)!
                .component === id,
          )
        )
          throw new DomainError('Seasonal discovery requires a completed event');
      if (activeBattle?.challenge?.kind === 'boss') {
        const boss = content.catalog.advanced.bosses.find(
          (b) => b.id === activeBattle.challenge!.bossId,
        )!;
        if (boss.requiresRegion && !completedRegions.includes(boss.requiresRegion))
          throw new DomainError('Boss requires regional fieldwork');
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
        completedResearch,
        scans,
        births,
        breedingCooldowns,
        towerFloor,
        bossVictories,
        sales,
        biography,
        showcase,
        blueprints,
        gallery,
        eventRun,
        eventClaims,
      }) as PlayerState;
    },
  };
}
