import test from 'node:test';
import assert from 'node:assert/strict';
import { SaveRepository, SaveError } from '../dist/src/platform/save.js';
import { LocalAnalytics } from '../dist/src/platform/services.js';
const codec = {
  decode(value) {
    if (!value || typeof value.count !== 'number') throw new Error('Invalid state');
    return value;
  },
};
function storage() {
  const values = new Map();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}
test('save roundtrip, backup recovery and validated imports', () => {
  const s = storage(),
    repo = new SaveRepository(s, codec);
  assert.equal(repo.load(), null);
  repo.write({ count: 1 });
  repo.write({ count: 2 });
  assert.deepEqual(repo.load(), { count: 2 });
  assert.deepEqual(repo.restoreBackup(), { count: 1 });
  assert.throws(() => repo.import('{"schemaVersion":2}'), SaveError);
  assert.throws(() => repo.write({ nope: true }));
  assert.deepEqual(repo.load(), { count: 1 });
});
test('corrupt and future saves are preserved and reported', () => {
  const s = storage();
  for (const damaged of ['corrupt', '', '{"schemaVersion":2}']) {
    s.setItem('monster-workshop.save', damaged);
    assert.throws(() => new SaveRepository(s, codec).load(), SaveError);
    assert.equal(s.getItem('monster-workshop.save'), damaged);
  }
});
test('failed storage writes do not report success', () => {
  const repo = new SaveRepository(
    {
      getItem: () => null,
      setItem: () => {
        throw new Error('Quota');
      },
      removeItem: () => {},
    },
    codec,
  );
  assert.throws(() => repo.write({ count: 1 }), SaveError);
});
test('recovery preserves the valid backup when the primary save is damaged or unsupported', () => {
  const s = storage(),
    repo = new SaveRepository(s, codec);
  repo.write({ count: 1 });
  repo.write({ count: 2 });
  const backup = s.getItem('monster-workshop.save.backup');
  for (const damaged of ['{broken', '{"schemaVersion":2}', '{"schemaVersion":1,"data":{}}']) {
    s.setItem('monster-workshop.save', damaged);
    assert.deepEqual(repo.restoreBackup(), { count: 1 });
    assert.equal(s.getItem('monster-workshop.save.backup'), backup);
  }
  s.setItem('monster-workshop.save', '{broken');
  repo.write({ count: 0 });
  assert.deepEqual(repo.load(), { count: 0 });
  assert.equal(s.getItem('monster-workshop.save.backup'), backup);
});
test('an interrupted recovery preserves both damaged primary and valid backup until retry succeeds', () => {
  const s = storage(),
    repo = new SaveRepository(s, codec);
  repo.write({ count: 1 });
  repo.write({ count: 2 });
  s.setItem('monster-workshop.save', '{broken');
  const backup = s.getItem('monster-workshop.save.backup'),
    originalWrite = s.setItem;
  s.setItem = (key, value) => {
    if (key === 'monster-workshop.save') throw new Error('quota');
    originalWrite(key, value);
  };
  assert.throws(() => repo.restoreBackup(), SaveError);
  assert.equal(s.getItem('monster-workshop.save'), '{broken');
  assert.equal(s.getItem('monster-workshop.save.backup'), backup);
  s.setItem = originalWrite;
  assert.deepEqual(repo.restoreBackup(), { count: 1 });
});
test('unavailable storage reads report SaveError consistently and can be retried', () => {
  const s = storage(),
    repo = new SaveRepository(s, codec);
  repo.write({ count: 1 });
  repo.write({ count: 2 });
  const originalRead = s.getItem;
  s.getItem = () => {
    throw new Error('denied');
  };
  for (const action of [() => repo.load(), () => repo.export(), () => repo.restoreBackup()])
    assert.throws(action, SaveError);
  s.getItem = originalRead;
  assert.deepEqual(repo.load(), { count: 2 });
  assert.deepEqual(repo.restoreBackup(), { count: 1 });
});
test('analytics stays local and has a bounded event buffer', () => {
  const analytics = new LocalAnalytics();
  for (let i = 0; i < 220; i++) analytics.track('experiment', { i });
  assert.equal(analytics.events.length, 200);
  assert.equal(analytics.events[0].properties.i, 20);
});
