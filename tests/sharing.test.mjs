import test from 'node:test';
import assert from 'node:assert/strict';
import { fullResearchWorkshop } from './helpers/research-workshop.mjs';
import { decodeShare } from '../dist/src/domain/sharing.js';
import { initialState, stateCodec } from '../dist/src/application/state.js';
import { Workshop } from '../dist/src/application/workshop.js';
import { SaveRepository } from '../dist/src/platform/save.js';
import { LocalAnalytics } from '../dist/src/platform/services.js';
test('profile/showcase exports preserve biology and visiting imports grant no ownership or resources', () => {
  const { w } = fullResearchWorkshop(),
    guest = fullResearchWorkshop();
  w.updateProfile('Aster', 'Explorer of peculiar biology.');
  for (const c of w.creatures.slice(0, 3)) w.toggleShowcase(c.id);
  assert.throws(() => w.toggleShowcase(w.creatures[3].id), /three/);
  const share = w.exportShowcase(),
    decoded = decodeShare(share, w.content),
    before = guest.w.state;
  assert.equal(decoded.profile.name, 'Aster');
  assert.deepEqual(decoded.creatures[0], w.state.creatures[0]);
  guest.w.importShare(share);
  const state = guest.w.state;
  assert.equal(state.gallery.length, 3);
  for (const key of [
    'creatures',
    'inventory',
    'biomass',
    'resources',
    'experiments',
    'discoveredComponents',
  ])
    assert.deepEqual(state[key], before[key]);
  assert.throws(() => guest.w.importShare(share), /already/);
  assert.deepEqual(guest.repo.load(), state);
  guest.w.saveVisitorBlueprint(state.gallery[0].id);
  assert.equal(guest.w.state.blueprints.length, 1);
  assert.deepEqual(guest.w.state.inventory, before.inventory);
  w.sell(w.creatures[0].id);
  assert.equal(w.state.showcase.length, 2);
});
test('blueprints share recipes, retain discovery locks and use ordinary paid manufacture', () => {
  const { w } = fullResearchWorkshop(),
    selected = w.creatures.find((c) => c.componentIds.includes('storm-wings'));
  const b = w.saveBlueprint(selected.id),
    raw = w.exportBlueprint(b.id);
  const values = new Map(),
    repo = new SaveRepository(
      { getItem: (k) => values.get(k) ?? null, setItem: (k, v) => values.set(k, v) },
      stateCodec(w.content),
    );
  const receiver = new Workshop(w.content, repo, new LocalAnalytics(), 78);
  receiver.importShare(raw);
  const before = receiver.state;
  assert.throws(() => receiver.manufactureBlueprint(b.id, '2026-10-03T00:00:00Z'), /storage/);
  assert.deepEqual(receiver.state, before);
  const ownBefore = w.state,
    made = w.manufactureBlueprint(b.id, '2026-10-03T00:00:00Z');
  assert.notEqual(made.seed, selected.seed);
  assert.deepEqual(made.componentIds, selected.componentIds);
  assert.equal(w.state.biomass, ownBefore.biomass - w.cost(b.componentIds));
  for (const id of b.componentIds) assert.equal(w.state.inventory[id], ownBefore.inventory[id] - 1);
});
test('shared validation drops derived claims and rejects unsupported formats, anatomy and duplicates', () => {
  const { w } = fullResearchWorkshop(),
    raw = JSON.parse(w.exportCreature(w.creatures[0].id));
  raw.creatures[0].stats = { hp: 999999 };
  assert.equal(decodeShare(JSON.stringify(raw), w.content).creatures[0].stats, undefined);
  for (const change of [
    (s) => (s.version = 2),
    (s) => (s.contentVersion = 2),
    (s) => (s.kind = 'inventory'),
    (s) => (s.creatures[0].genome.speed.value = -1),
    (s) => s.creatures[0].componentIds.push('wolf-body'),
  ]) {
    const bad = structuredClone(raw);
    change(bad);
    assert.throws(() => decodeShare(JSON.stringify(bad), w.content));
  }
  assert.throws(() => decodeShare('x'.repeat(200001), w.content));
  const s = initialState(w.content, 42);
  delete s.biography;
  delete s.showcase;
  delete s.blueprints;
  delete s.gallery;
  assert.deepEqual(stateCodec(w.content).decode(s).gallery, []);
});
test('failed sharing/profile saves roll back libraries and profile changes', () => {
  const f = fullResearchWorkshop(),
    before = f.w.state,
    raw = f.w.exportCreature(f.w.creatures[0].id);
  f.fail();
  assert.throws(() => f.w.importShare(raw));
  assert.throws(() => f.w.saveBlueprint(f.w.creatures[0].id));
  assert.throws(() => f.w.updateProfile('Another', 'Changed biography.'));
  assert.deepEqual(f.w.state, before);
});
