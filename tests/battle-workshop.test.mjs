import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ContentIndex, decodeCatalog } from '../dist/src/domain/catalog.js';
import { Workshop } from '../dist/src/application/workshop.js';
import { stateCodec } from '../dist/src/application/state.js';
import { SaveRepository } from '../dist/src/platform/save.js';
import { LocalAnalytics } from '../dist/src/platform/services.js';
import { chooseAction } from '../dist/src/domain/combat.js';
const content = new ContentIndex(
    decodeCatalog(JSON.parse(readFileSync('content/catalog.json', 'utf8'))),
  ),
  at = '2026-10-02T00:00:00Z';
function fixture() {
  const values = new Map();
  let fail = false;
  const storage = {
      getItem: (k) => values.get(k) ?? null,
      setItem: (k, v) => {
        if (fail) throw new Error('Quota');
        values.set(k, v);
      },
      removeItem: (k) => values.delete(k),
    },
    repo = new SaveRepository(storage, stateCodec(content)),
    analytics = new LocalAnalytics(),
    workshop = new Workshop(content, repo, analytics, 42);
  for (let i = 0; i < 3; i++)
    workshop.manufacture(
      ['dragon-head', 'wolf-body', 'lightning-organ', 'crystal-armor', 'spider-legs'],
      at,
    );
  return {
    workshop,
    repo,
    analytics,
    values,
    fail: () => {
      fail = true;
    },
  };
}
test('owned squads only; an active battle survives reload with the same next turn', () => {
  const f = fixture(),
    ids = f.workshop.creatures.map((c) => c.id);
  assert.throws(() => f.workshop.startBattle([ids[0]], at));
  assert.throws(() => f.workshop.startBattle(['unknown', ...ids.slice(1)], at));
  const b = f.workshop.startBattle(ids, at);
  assert.throws(() => f.workshop.startBattle(ids, at));
  assert.deepEqual(new Workshop(content, f.repo, f.analytics, 99).state.activeBattle, b);
  const moved = f.workshop.battleAction(chooseAction(b, content));
  assert.deepEqual(new Workshop(content, f.repo, f.analytics, 99).state.activeBattle, moved);
});
test('victory reward is claimed once, discovers wings and supports another manufacture', () => {
  const f = fixture(),
    ids = f.workshop.creatures.map((c) => c.id);
  let b = f.workshop.startBattle(ids, at);
  while (b.status === 'active') b = f.workshop.battleAction(chooseAction(b, content));
  assert.equal(b.status, 'victory');
  const before = f.workshop.state,
    reward = f.workshop.claimBattle(),
    after = f.workshop.state;
  assert.equal(reward.newComponent, 'storm-wings');
  assert.equal(after.biomass, before.biomass + content.catalog.rules.combat.victoryBiomass);
  assert(after.discoveredComponents.includes('storm-wings'));
  assert.equal(after.inventory['storm-wings'], 3);
  assert(after.creatures.every((c) => c.history.victories === 1));
  assert.throws(() => f.workshop.claimBattle());
  assert.deepEqual(f.workshop.state, after);
  const winged = f.workshop.manufacture(['dragon-head', 'wolf-body', 'storm-wings'], at);
  assert.equal(winged.anatomy.wings, 'storm-wings');
  assert.equal(f.workshop.state.experiments.length, 4);
});
test('failed reward/action saves do not advance the battle or grant resources', () => {
  const f = fixture(),
    ids = f.workshop.creatures.map((c) => c.id);
  const b = f.workshop.startBattle(ids, at),
    before = f.workshop.state;
  f.fail();
  assert.throws(() => f.workshop.battleAction(chooseAction(b, content)));
  assert.deepEqual(f.workshop.state, before);
  const g = fixture();
  let terminal = g.workshop.startBattle(
    g.workshop.creatures.map((c) => c.id),
    at,
  );
  while (terminal.status === 'active')
    terminal = g.workshop.battleAction(chooseAction(terminal, content));
  const previous = g.workshop.state;
  g.fail();
  assert.throws(() => g.workshop.claimBattle());
  assert.deepEqual(g.workshop.state, previous);
});
test('defeat/retreat preserves creatures, grants no farmable resources, and allows retry', () => {
  const f = fixture(),
    before = f.workshop.state;
  f.workshop.startBattle(
    f.workshop.creatures.map((c) => c.id),
    at,
  );
  f.workshop.retreatBattle();
  const reward = f.workshop.claimBattle();
  assert.equal(reward.biomass, 0);
  assert.deepEqual(reward.quantities, {});
  assert.equal(f.workshop.state.biomass, before.biomass);
  assert.equal(f.workshop.creatures.length, 3);
  f.workshop.startBattle(
    f.workshop.creatures.map((c) => c.id),
    at,
  );
});
test('phase-4 saves migrate without losing existing creature sources', () => {
  const f = fixture(),
    old = f.workshop.state;
  delete old.activeBattle;
  const decoded = stateCodec(content).decode(old);
  assert.equal(decoded.activeBattle, null);
  assert.deepEqual(decoded.creatures, old.creatures);
});
