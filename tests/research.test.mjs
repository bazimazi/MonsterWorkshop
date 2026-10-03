import test from 'node:test';
import { fullResearchWorkshop } from './helpers/research-workshop.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ContentIndex, decodeCatalog } from '../dist/src/domain/catalog.js';
import { componentAnalysis, hasResearch, scannerLevel } from '../dist/src/domain/research.js';
import { chooseAction } from '../dist/src/domain/combat.js';
import { Workshop } from '../dist/src/application/workshop.js';
import { stateCodec } from '../dist/src/application/state.js';
import { SaveRepository } from '../dist/src/platform/save.js';
import { LocalAnalytics } from '../dist/src/platform/services.js';
const raw = JSON.parse(readFileSync('content/catalog.json', 'utf8'));
const content = new ContentIndex(decodeCatalog(raw));
const at = '2026-10-03T00:00:00Z',
  base = ['dragon-head', 'wolf-body'];
function fixture() {
  const values = new Map();
  let failed = false;
  const repo = new SaveRepository(
    {
      getItem: (k) => values.get(k) ?? null,
      setItem: (k, v) => {
        if (failed) throw new Error('quota');
        values.set(k, v);
      },
    },
    stateCodec(content),
  );
  const analytics = new LocalAnalytics();
  return {
    w: new Workshop(content, repo, analytics, 42),
    repo,
    analytics,
    fail: () => {
      failed = true;
    },
  };
}
function gather(w, region, id) {
  const job = w.startExpedition(region, id, at);
  for (let i = 0; i < content.region(region).durationMs / 1000; i++) w.advanceExpeditions(1000);
  return w.claimExpedition(job.id);
}
function basic(f) {
  const creature = f.w.manufacture(base, at);
  gather(f.w, 'green-meadow', creature.id);
  f.w.completeResearch('basic-scanner');
  return creature;
}
test('scanning requires discovery and research; repeated scans never charge twice', () => {
  const f = fixture(),
    w = f.w;
  assert.throws(() => w.scanComponent('dragon-head', at), /scanner first/);
  assert.throws(() => w.completeResearch('basic-scanner'), /Green Meadow/);
  basic(f);
  const before = w.state;
  assert.throws(() => w.scanComponent('prism-organ', at), /Discover/);
  w.scanComponent('dragon-head', at);
  assert.equal(w.state.biomass, before.biomass - 2);
  assert.equal(w.state.inventory['dragon-head'], before.inventory['dragon-head']);
  const scanned = w.state;
  assert.throws(() => w.scanComponent('dragon-head', at), /already analyzed/);
  assert.deepEqual(w.state, scanned);
  assert.throws(() => w.completeResearch('basic-scanner'), /Already researched/);
  assert.throws(() => w.completeResearch('advanced-scanner'), /Crystal Caves/);
});
test('all research is reachable through gameplay and enables paid, eligible controlled mutation', () => {
  const f = fullResearchWorkshop(),
    w = f.w;
  assert.equal(w.state.completedResearch.length, 6);
  assert.equal(scannerLevel(w.state.completedResearch, content), 2);
  const snapshot = w.state.creatures[0];
  const before = w.state;
  assert.throws(() => w.manufacture(base, at, 'electrical-overgrowth'), /not eligible/);
  assert.deepEqual(w.state, before);
  const parts = ['verdant-head', 'crystal-body', 'prism-organ'];
  const guided = w.manufacture(parts, at, 'electrical-overgrowth');
  assert(guided.mutationIds.includes('electrical-overgrowth'));
  assert.equal(w.state.biomass, before.biomass - w.cost(parts) - 20);
  assert.equal(w.state.resources.crystal, before.resources.crystal - 2);
  assert.equal(w.state.experiments.at(-1).controlledMutation, 'electrical-overgrowth');
  assert.deepEqual(w.state.creatures[0], snapshot);
  assert.deepEqual(new Workshop(content, f.repo, new LocalAnalytics(), 1).state, w.state);
});
test('cultivated blueprints provide renewable components with exact resource spending', () => {
  const { w } = fullResearchWorkshop();
  const exhausted = w.state;
  assert.throws(() => w.cultivateComponent('verdant-head'), /Botanical Fiber/);
  assert.deepEqual(w.state, exhausted);
  gather(w, 'green-meadow', w.state.creatures[0].id);
  const before = w.state;
  w.cultivateComponent('verdant-head');
  assert.equal(w.state.inventory['verdant-head'], before.inventory['verdant-head'] + 1);
  assert.equal(w.state.resources.fiber, before.resources.fiber - 2);
  assert.equal(w.state.biomass, before.biomass - 6);
  assert.throws(() => w.cultivateComponent('dragon-head'), /blueprint/);
  const locked = fixture();
  assert.throws(() => locked.w.cultivateComponent('verdant-head'), /blueprint/);
});
test('analysis reveals progressively and returns isolated projections of hidden data', () => {
  const basic = componentAnalysis('lightning-organ', 1, content);
  assert.equal(basic.hidden, 4);
  assert(!('genes' in basic));
  assert(!('mutationChance' in basic));
  const advanced = componentAnalysis('lightning-organ', 2, content);
  assert.equal(advanced.hidden, 0);
  assert(advanced.tags.includes('experimental'));
  assert.deepEqual(advanced.genes, content.component('lightning-organ').genes);
  advanced.tags.length = 0;
  advanced.genes.mutation = 999;
  assert(content.component('lightning-organ').tags.length);
  assert.notEqual(content.component('lightning-organ').genes.mutation, 999);
});
test('failed research or scan persistence rolls back costs, knowledge and telemetry', () => {
  const f = fixture(),
    c = f.w.manufacture(base, at);
  gather(f.w, 'green-meadow', c.id);
  const before = f.w.state,
    events = structuredClone(f.analytics.events);
  f.fail();
  assert.throws(() => f.w.completeResearch('basic-scanner'));
  assert.deepEqual(f.w.state, before);
  assert.deepEqual(f.analytics.events, events);
  const g = fixture();
  basic(g);
  const scanned = g.w.state,
    scanEvents = structuredClone(g.analytics.events);
  g.fail();
  assert.throws(() => g.w.scanComponent('dragon-head', at));
  assert.deepEqual(g.w.state, scanned);
  assert.deepEqual(g.analytics.events, scanEvents);
});
test('old saves migrate without losing experiments; forged capabilities and analyses are rejected', () => {
  const f = fixture();
  basic(f);
  f.w.scanComponent('dragon-head', at);
  const old = fixture().w.state;
  delete old.completedResearch;
  delete old.scans;
  assert.deepEqual(stateCodec(content).decode(old).completedResearch, []);
  for (const damage of [
    (s) => s.completedResearch.push('basic-scanner'),
    (s) => s.completedResearch.push('controlled-mutation'),
    (s) => (s.scans[0].level = 2),
    (s) => s.scans.push(s.scans[0]),
    (s) => s.discoveredComponents.push('prism-organ'),
    (s) => (s.completedResearch = []),
    (s) => (s.experiments[0].controlledMutation = 'electrical-overgrowth'),
  ]) {
    const state = f.w.state;
    damage(state);
    assert.throws(() => stateCodec(content).decode(state));
  }
  assert(!hasResearch(f.w.state.completedResearch, 'mutation-control', content));
  assert.throws(
    () => f.w.manufacture([...base, 'lightning-organ'], at, 'electrical-overgrowth'),
    /Research mutation control/,
  );
});
test('research catalog rejects cycles, invalid costs, unreachable observations and reward references', () => {
  for (const damage of [
    (c) => c.research[0].prerequisites.push('controlled-mutation'),
    (c) => (c.research[0].cost.resources.unknown = 1),
    (c) => (c.research[0].objectives.scans = 100),
    (c) => (c.research[1].unlock.id = 'dragon-head'),
    (c) => (c.research[0].unlock.level = 3),
    (c) => (c.research[0].cost.biomass = -1),
  ]) {
    const c = structuredClone(raw);
    damage(c);
    assert.throws(() => decodeCatalog(c));
  }
});
