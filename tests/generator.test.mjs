import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ContentIndex, decodeCatalog } from '../dist/src/domain/catalog.js';
import {
  analyzeDesign,
  deriveCreature,
  generateCreature,
  validateAnatomy,
} from '../dist/src/domain/generator.js';
import { serializeCreature, deserializeCreature } from '../dist/src/domain/serialization.js';
import { Random, hash } from '../dist/src/domain/random.js';
const content = new ContentIndex(
  decodeCatalog(JSON.parse(readFileSync('content/catalog.json', 'utf8'))),
);
const options = { seed: 1742, createdAt: '2026-10-02T00:00:00.000Z', creator: 'Engineer' };
const base = ['dragon-head', 'wolf-body'];
const all = content.catalog.components
  .filter((p) => ['starter', 'battle'].includes(p.discovery))
  .map((p) => p.id);
test('same normalized anatomy and seed yields identical creature', () => {
  const c = generateCreature(all, content, options);
  assert.deepEqual(c, generateCreature([...all].reverse(), content, options));
  assert.notDeepEqual(c.genome, generateCreature(all, content, { ...options, seed: 1 }).genome);
  assert.deepEqual(
    deriveCreature(deserializeCreature(serializeCreature(c, content), content), content),
    c,
  );
});
test('invalid anatomy is rejected before generation', () => {
  for (const ids of [[], ['dragon-head'], [...base, 'wolf-body'], [...base, 'unknown']])
    assert.throws(() => validateAnatomy(ids, content));
});
test('compatibility is symmetric, bounded and exposes synergy/conflict reasons', () => {
  const c = analyzeDesign([...base, 'spider-legs', 'lightning-organ'], content);
  assert.deepEqual(c, analyzeDesign(['lightning-organ', 'spider-legs', ...base], content));
  assert(c.reasons.some((r) => r.includes('conflict')));
  assert(c.reasons.some((r) => r.includes('synergy')));
  assert(c.score >= 0 && c.score <= 100);
  assert.equal(analyzeDesign(base, content).mutationChance, 0);
});
test('functional mutation changes genes, abilities, traits and visible phenotype', () => {
  const ids = [...base, 'lightning-organ'];
  const normal = generateCreature(ids, content, { ...options, skipMutations: true });
  const mutant = generateCreature(ids, content, {
    ...options,
    forceMutation: 'electrical-overgrowth',
  });
  assert(mutant.stats.power > normal.stats.power);
  assert(mutant.genome.stability.value < normal.genome.stability.value);
  assert(mutant.phenotype.features.includes('electric-spines'));
  assert(mutant.traitIds.includes('overcharged'));
  assert.throws(() =>
    generateCreature(base, content, { ...options, forceMutation: 'electrical-overgrowth' }),
  );
});
test('property sweep: all 16 anatomies across 120 seeds stay valid and roundtrip', () => {
  const optional = all.filter((id) => !base.includes(id));
  for (let mask = 0; mask < 16; mask++)
    for (let seed = 0; seed < 120; seed++) {
      const ids = [...base, ...optional.filter((_, index) => mask & (1 << index))];
      const c = generateCreature(ids, content, { ...options, seed });
      assert(Object.values(c.stats).every((v) => Number.isFinite(v) && v > 0));
      assert(Object.values(c.genome).every((g) => g.value >= 0 && g.value <= 100));
      assert(c.abilityIds.every((id) => content.abilities.has(id)));
      assert.equal(new Set(Object.keys(c.anatomy)).size, ids.length);
      assert.deepEqual(
        deriveCreature(deserializeCreature(serializeCreature(c, content), content), content),
        c,
      );
    }
});
test('mutation frequencies match the predicted probability within 2 percentage points', () => {
  const ids = [...base, 'lightning-organ', 'spider-legs'];
  let mutated = 0;
  const trials = 4000;
  for (let seed = 0; seed < trials; seed++)
    if (generateCreature(ids, content, { ...options, seed }).mutationIds.length) mutated++;
  assert(Math.abs(mutated / trials - analyzeDesign(ids, content).mutationChance) < 0.02);
});
test('PRNG output is deterministic, bounded and resumable', () => {
  const a = new Random(hash('genome')),
    b = new Random(hash('genome'));
  for (let i = 0; i < 1000; i++) {
    const value = a.next();
    assert.equal(value, b.next());
    assert(value >= 0 && value < 1);
  }
  assert.equal(a.next(), new Random(b.state).next());
});
