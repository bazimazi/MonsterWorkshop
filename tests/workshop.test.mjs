import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ContentIndex, decodeCatalog } from '../dist/src/domain/catalog.js';
import { Workshop } from '../dist/src/application/workshop.js';
import { initialState, stateCodec } from '../dist/src/application/state.js';
import { SaveRepository, SaveConflictError } from '../dist/src/platform/save.js';
import { LocalAnalytics } from '../dist/src/platform/services.js';
const content = new ContentIndex(
  decodeCatalog(JSON.parse(readFileSync('content/catalog.json', 'utf8'))),
);
const at = '2026-10-02T00:00:00Z',
  ids = ['dragon-head', 'wolf-body', 'lightning-organ'];
function fixture() {
  const values = new Map();
  let fail = false;
  const storage = {
    getItem: (k) => values.get(k) ?? null,
    setItem: (k, v) => {
      if (fail) throw new Error('quota');
      values.set(k, v);
    },
    removeItem: (k) => values.delete(k),
  };
  const repo = new SaveRepository(storage, stateCodec(content));
  const analytics = new LocalAnalytics();
  return {
    workshop: new Workshop(content, repo, analytics, 42),
    repo,
    analytics,
    values,
    fail: () => {
      fail = true;
    },
  };
}
test('manufacture consumes exactly one of each part and records deterministic provenance', () => {
  const f = fixture(),
    before = f.workshop.state,
    c = f.workshop.manufacture(ids, at),
    after = f.workshop.state;
  assert.equal(after.biomass, before.biomass - f.workshop.cost(ids));
  assert.equal(after.nextSerial, 2);
  for (const id of ids) assert.equal(after.inventory[id], before.inventory[id] - 1);
  assert.equal(after.experiments[0].creatureId, c.id);
  assert.equal(after.creatures.length, 1);
  assert.deepEqual(new Workshop(content, f.repo, f.analytics, 9).creatures[0], c);
  const another = fixture().workshop.manufacture(ids, at);
  assert.deepEqual(c, another);
});
test('failed save leaves inventory, currency, creatures and telemetry unchanged', () => {
  const f = fixture(),
    before = f.workshop.state;
  f.fail();
  assert.throws(() => f.workshop.manufacture(ids, at));
  assert.deepEqual(f.workshop.state, before);
  assert.equal(f.analytics.events.length, 0);
});

test('another workshop writer cannot roll back progress through actions, timers, imports or retries', () => {
  const f = fixture();
  f.workshop.manufacture(ids, at);
  f.workshop.startExpedition('green-meadow', 'creature-1', at);
  const storage = {
    getItem: (key) => f.values.get(key) ?? null,
    setItem: (key, value) => f.values.set(key, value),
    removeItem: (key) => f.values.delete(key),
  };
  const analytics = new LocalAnalytics(),
    stale = new Workshop(content, new SaveRepository(storage, stateCodec(content)), analytics, 9),
    before = stale.state,
    earlierSave = stale.exportSave();
  f.workshop.updateProfile('Latest engineer', 'Saved in the active tab.');
  f.workshop.advanceExpeditions(1000);
  const latest = [...f.values];
  for (const action of [
    () => stale.manufacture(['dragon-head', 'wolf-body'], at),
    () => stale.advanceExpeditions(1000),
    () => stale.retrySave(),
    () => stale.importSave(earlierSave),
    () => stale.restoreBackup(),
  ]) {
    assert.throws(action, SaveConflictError);
    assert.deepEqual(stale.state, before);
    assert.deepEqual([...f.values], latest);
    assert.equal(analytics.events.length, 0);
  }
  const reloaded = new Workshop(
    content,
    new SaveRepository(storage, stateCodec(content)),
    analytics,
    9,
  );
  assert.deepEqual(reloaded.state, f.workshop.state);
  reloaded.advanceExpeditions(1000);
  assert.equal(reloaded.state.expeditions[0].elapsedMs, 2000);
});
test('locked components, invalid anatomy and exhausted inventory cannot be spent', () => {
  const f = fixture();
  const before = f.workshop.state;
  assert.throws(() => f.workshop.manufacture([...ids, 'storm-wings'], at));
  assert.throws(() => f.workshop.manufacture(['dragon-head'], at));
  assert.deepEqual(f.workshop.state, before);
  for (let i = 0; i < 5; i++) f.workshop.manufacture(['dragon-head', 'wolf-body'], at);
  const depleted = f.workshop.state;
  assert.throws(() => f.workshop.manufacture(['dragon-head', 'wolf-body'], at));
  assert.deepEqual(f.workshop.state, depleted);
});
test('rename, options and import/export persist; malformed imports preserve state', () => {
  const f = fixture(),
    c = f.workshop.manufacture(ids, at);
  f.workshop.rename(c.id, '   Pip   ');
  f.workshop.updateOptions({ sound: true, haptics: false, reducedMotion: true, textScale: 1.3 });
  const saved = f.workshop.state;
  const g = fixture();
  g.workshop.importSave(f.workshop.exportSave());
  assert.deepEqual(g.workshop.state, saved);
  assert.throws(() => g.workshop.importSave('{broken'));
  assert.deepEqual(g.workshop.state, saved);
  assert.throws(() => g.workshop.rename(c.id, ''));
  assert.throws(() => g.workshop.updateOptions({ ...saved.options, textScale: 4 }));
});
test('save validator rejects duplicate creatures, missing discovery and mismatched experiments', () => {
  const f = fixture();
  f.workshop.manufacture(ids, at);
  for (const change of [
    (s) => s.creatures.push(s.creatures[0]),
    (s) => s.experiments[0].seed++,
    (s) => (s.inventory['storm-wings'] = 3),
    (s) => (s.biomass = -1),
    (s) => (s.contentVersion = 2),
    (s) => (s.experiments = []),
  ]) {
    const s = f.workshop.state;
    change(s);
    assert.throws(() => stateCodec(content).decode(s));
  }
  assert.deepEqual(
    stateCodec(content).decode(initialState(content, 42)),
    initialState(content, 42),
  );
});
