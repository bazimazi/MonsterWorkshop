import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ContentIndex, decodeCatalog } from '../dist/src/domain/catalog.js';
import { generateCreature } from '../dist/src/domain/generator.js';
import { expeditionFitness, expeditionReward } from '../dist/src/domain/exploration.js';
import { Workshop } from '../dist/src/application/workshop.js';
import { stateCodec } from '../dist/src/application/state.js';
import { SaveRepository } from '../dist/src/platform/save.js';
import { LocalAnalytics } from '../dist/src/platform/services.js';
import { chooseAction } from '../dist/src/domain/combat.js';
const raw = JSON.parse(readFileSync('content/catalog.json', 'utf8'));
const content = new ContentIndex(decodeCatalog(raw));
const at = '2026-10-03T00:00:00Z',
  base = ['dragon-head', 'wolf-body'];
function fixture() {
  const values = new Map();
  let failed = false;
  const storage = {
    getItem: (k) => values.get(k) ?? null,
    setItem: (k, v) => {
      if (failed) throw new Error('quota');
      values.set(k, v);
    },
  };
  const repo = new SaveRepository(storage, stateCodec(content)),
    analytics = new LocalAnalytics();
  return {
    workshop: new Workshop(content, repo, analytics, 42),
    repo,
    analytics,
    fail: () => {
      failed = true;
    },
  };
}
function finish(workshop, job) {
  for (let i = 0; i < content.region(job.regionId).durationMs / 1000; i++)
    workshop.advanceExpeditions(1000);
  return workshop.claimExpedition(job.id);
}
test('gathering, discovery, new manufacture and mineral specialization form a playable loop', () => {
  const { workshop: w, repo } = fixture();
  const scout = w.manufacture(base, at),
    miner = w.manufacture([...base, 'spider-legs'], at);
  assert.throws(() => w.startExpedition('crystal-caves', miner.id, at), /Complete Green Meadow/);
  const job = w.startExpedition('green-meadow', scout.id, at);
  assert.throws(() => w.claimExpedition(job.id), /in progress/);
  assert.throws(() => w.startExpedition('green-meadow', scout.id, at), /already assigned/);
  const reward = finish(w, job);
  assert.equal(reward.discovery, 'herbal-organ');
  assert(w.state.resources.fiber >= 3);
  assert.equal(w.state.inventory['herbal-organ'], 1);
  assert.throws(() => w.claimExpedition(job.id), /No unclaimed/);
  const gatherer = w.manufacture([...base, 'herbal-organ'], at);
  assert(
    expeditionFitness(gatherer, content.region('green-meadow'), content) >
      expeditionFitness(scout, content.region('green-meadow'), content),
  );
  assert.throws(() => w.startExpedition('crystal-caves', scout.id, at), /climber or mineral/);
  assert.equal(
    finish(w, w.startExpedition('crystal-caves', miner.id, at)).discovery,
    'crystal-body',
  );
  assert(w.state.resources.crystal >= 3);
  const chassis = w.manufacture(['dragon-head', 'crystal-body'], at);
  assert(w.startExpedition('crystal-caves', chassis.id, at));
  assert.throws(() => w.startExpedition('storm-valley', gatherer.id, at), /flyer/);
  assert.deepEqual(new Workshop(content, repo, new LocalAnalytics(), 1).state, w.state);
});
test('progress resumes exactly, ignores wall-clock dates, and rejects oversized intervals', () => {
  const { workshop: w, repo } = fixture(),
    c = w.manufacture(base, at);
  const job = w.startExpedition('green-meadow', c.id, '2099-01-01T00:00:00Z');
  w.advanceExpeditions(1000);
  w.advanceExpeditions(650);
  const loaded = new Workshop(content, repo, new LocalAnalytics(), 0);
  assert.equal(loaded.state.expeditions[0].elapsedMs, 1650);
  assert.throws(() => loaded.advanceExpeditions(3600000));
  assert.throws(() => loaded.advanceExpeditions(-1));
  assert.equal(loaded.state.expeditions[0].elapsedMs, 1650);
  loaded.cancelExpedition(job.id);
  assert(!loaded.isAssigned(c.id));
  assert.deepEqual(loaded.state.resources, {});
  assert.equal(loaded.state.expeditionReports[0].reward, null);
});
test('combat and exploration cannot share an assigned creature', () => {
  const { workshop: w } = fixture(),
    ids = Array.from({ length: 3 }, () => w.manufacture(base, at).id);
  const job = w.startExpedition('green-meadow', ids[0], at);
  assert.throws(() => w.startBattle(ids, at), /expedition creature/);
  w.cancelExpedition(job.id);
  w.startBattle(ids, at);
  assert.throws(() => w.startExpedition('green-meadow', ids[0], at), /already assigned/);
});
test('all three regions are reachable through manufacturing, battle and expedition rewards', () => {
  const { workshop: w } = fixture();
  const parts = content.catalog.components
    .filter((p) => p.discovery === 'starter')
    .map((p) => p.id);
  const ids = Array.from({ length: 3 }, () => w.manufacture(parts, at).id);
  let battle = w.startBattle(ids, at);
  while (battle.status === 'active') battle = w.battleAction(chooseAction(battle, content));
  assert(w.claimBattle().victory);
  finish(w, w.startExpedition('green-meadow', ids[0], at));
  finish(w, w.startExpedition('crystal-caves', ids[0], at));
  const flyer = w.manufacture([...parts, 'storm-wings'], at);
  assert.equal(finish(w, w.startExpedition('storm-valley', flyer.id, at)).discovery, 'gale-wings');
  assert(w.state.resources['storm-essence'] >= 3);
  assert.deepEqual(w.completedRegions, ['green-meadow', 'crystal-caves', 'storm-valley']);
});
test('failed reward writes preserve progress, inventory, currency and telemetry', () => {
  const f = fixture(),
    c = f.workshop.manufacture(base, at);
  const job = f.workshop.startExpedition('green-meadow', c.id, at);
  for (let i = 0; i < 20; i++) f.workshop.advanceExpeditions(1000);
  const before = f.workshop.state,
    telemetry = structuredClone(f.analytics.events);
  f.fail();
  assert.throws(() => f.workshop.claimExpedition(job.id));
  assert.deepEqual(f.workshop.state, before);
  assert.deepEqual(f.analytics.events, telemetry);
});
test('earlier saves migrate without changing creatures or experiment provenance', () => {
  const { workshop: w } = fixture();
  w.manufacture(base, at);
  const old = w.state;
  for (const key of ['expeditions', 'expeditionReports', 'resources', 'nextExpeditionSerial'])
    delete old[key];
  const migrated = stateCodec(content).decode(old);
  assert.deepEqual(migrated.creatures, old.creatures);
  assert.deepEqual(migrated.experiments, old.experiments);
  assert.deepEqual(migrated.expeditions, []);
  assert.deepEqual(migrated.resources, {});
});
test('imports reject replayed jobs, invalid ownership, forged snapshots and reward reports', () => {
  const { workshop: w } = fixture(),
    c = w.manufacture(base, at);
  const job = w.startExpedition('green-meadow', c.id, at);
  for (const damage of [
    (s) => s.expeditions.push(s.expeditions[0]),
    (s) => (s.expeditions[0].source.id = 'alien'),
    (s) => (s.expeditions[0].source.genome.adaptation.value = 100),
    (s) => (s.expeditions[0].elapsedMs = 20001),
    (s) => s.expeditions[0].seed++,
    (s) => (s.resources.unknown = 1),
  ]) {
    const s = w.state;
    damage(s);
    assert.throws(() => stateCodec(content).decode(s));
  }
  finish(w, job);
  for (const damage of [
    (s) => s.expeditions.push({ ...job, elapsedMs: 20000 }),
    (s) => (s.expeditionReports[0].reward.components['gale-wings'] = 1),
    (s) => (s.expeditionReports[0].reward.biomass = 1000),
  ]) {
    const s = w.state;
    damage(s);
    assert.throws(() => stateCodec(content).decode(s));
  }
});
test('seeded specialist rewards are deterministic and bounded across all regions', () => {
  const source = generateCreature(
    [...base, 'herbal-organ', 'crystal-armor', 'gale-wings'],
    content,
    { seed: 17, createdAt: at, creator: 'Test' },
  );
  for (const region of content.regions.values())
    for (let seed = 0; seed < 100; seed++) {
      const job = {
        id: 'test',
        serial: 1,
        regionId: region.id,
        source,
        seed,
        elapsedMs: region.durationMs,
        startedAt: at,
      };
      const reward = expeditionReward(job, content, []);
      assert.deepEqual(reward, expeditionReward(job, content, []));
      assert.equal(reward.discovery, region.discovery);
      assert(reward.biomass >= region.biomass && reward.biomass <= region.biomass * 2);
    }
});
test('region content rejects cyclic prerequisites and invalid reward references', () => {
  for (const damage of [
    (c) => c.regions[0].prerequisites.push('storm-valley'),
    (c) => (c.regions[0].resource = 'unknown'),
    (c) => (c.regions[0].discovery = 'dragon-head'),
    (c) => (c.rules.exploration.affinityWeight = 1),
  ]) {
    const c = structuredClone(raw);
    damage(c);
    assert.throws(() => decodeCatalog(c));
  }
});
