import test from 'node:test';
import assert from 'node:assert/strict';
import { SaveRepository, SaveError } from '../dist/src/platform/save.js';
import { LocalAnalytics } from '../dist/src/platform/services.js';
const codec = { decode(value) { if (!value || typeof value.count !== 'number') throw new Error('Invalid state'); return value; } };
function storage() { const values = new Map(); return { values, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }; }
test('save roundtrip, backup recovery and validated imports', () => {
  const s = storage(), repo = new SaveRepository(s, codec);
  assert.equal(repo.load(), null);
  repo.write({ count: 1 }); repo.write({ count: 2 });
  assert.deepEqual(repo.load(), { count: 2 });
  assert.deepEqual(repo.restoreBackup(), { count: 1 });
  assert.throws(() => repo.import('{"schemaVersion":2}'), SaveError);
  assert.throws(() => repo.write({ nope: true }));
  assert.deepEqual(repo.load(), { count: 1 });
});
test('corrupt and future saves are preserved and reported', () => {
  const s = storage(); s.setItem('monster-workshop.save', 'corrupt');
  assert.throws(() => new SaveRepository(s, codec).load(), SaveError);
  assert.equal(s.getItem('monster-workshop.save'), 'corrupt');
});
test('failed storage writes do not report success', () => {
  const repo = new SaveRepository({ getItem: () => null, setItem: () => { throw new Error('Quota'); }, removeItem: () => {} }, codec);
  assert.throws(() => repo.write({ count: 1 }), SaveError);
});
test('analytics stays local and has a bounded event buffer', () => {
  const analytics = new LocalAnalytics();
  for (let i = 0; i < 220; i++) analytics.track('experiment', { i });
  assert.equal(analytics.events.length, 200);
  assert.equal(analytics.events[0].properties.i, 20);
});
