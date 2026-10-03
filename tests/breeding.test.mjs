import test from 'node:test';
import assert from 'node:assert/strict';
import { fullResearchWorkshop } from './helpers/research-workshop.mjs';
import { breedCreature, inheritGene } from '../dist/src/domain/breeding.js';
import { Random } from '../dist/src/domain/random.js';
import { stateCodec } from '../dist/src/application/state.js';
import { Workshop } from '../dist/src/application/workshop.js';
const at = '2026-10-03T00:00:00Z';
function ready() {
  const f = fullResearchWorkshop(),
    w = f.w;
  const job = w.startExpedition('green-meadow', 'creature-1', at);
  for (let i = 0; i < 20; i++) w.advanceExpeditions(1000);
  w.claimExpedition(job.id);
  return f;
}
test('offspring inheritance is seeded, bounded, anatomically valid and biased toward dominant genes', () => {
  const { w } = ready(),
    [a, b] = w.state.creatures,
    options = { seed: 17, id: 'child', createdAt: at, creator: 'Test' };
  assert.deepEqual(
    breedCreature(a, b, w.content, options),
    breedCreature(a, b, w.content, options),
  );
  let dominant = 0;
  const random = new Random(19);
  for (let i = 0; i < 1000; i++) {
    const result = inheritGene(
      { value: 90, dominance: 'dominant' },
      { value: 10, dominance: 'recessive' },
      random,
      w.content,
    );
    dominant += result.from === 'a' ? 1 : 0;
    assert(result.gene.value >= 0 && result.gene.value <= 100);
  }
  assert(dominant > 500 && dominant < 700);
  assert.equal(
    inheritGene(
      { value: 20, dominance: 'recessive' },
      { value: 30, dominance: 'recessive' },
      random,
      w.content,
    ).gene.dominance,
    'recessive',
  );
});
test('birth spends exact costs, preserves parents and stock, resumes cooldown and records family', () => {
  const f = ready(),
    w = f.w,
    before = w.state;
  const child = w.breed('creature-1', 'creature-2', at);
  assert.equal(child.lineage.generation, 2);
  assert.deepEqual(child.lineage.parentIds, ['creature-1', 'creature-2']);
  assert.deepEqual(w.state.inventory, before.inventory);
  assert.equal(w.state.resources.fiber, before.resources.fiber - 2);
  assert.equal(w.state.biomass, before.biomass - 24);
  assert.deepEqual(w.state.creatures[0], before.creatures[0]);
  assert.throws(() => w.breed('creature-1', 'creature-2', at), /resting/);
  const resumed = new Workshop(w.content, f.repo, f.analytics, 0);
  assert.deepEqual(resumed.state, w.state);
  for (let i = 0; i < 30; i++) resumed.advanceExpeditions(1000);
  assert.equal(resumed.state.breedingCooldowns['creature-1'], 0);
  for (const damage of [
    (s) => s.births[0].parents[0].genome.strength.value++,
    (s) => s.creatures.at(-1).genome.speed.value++,
    (s) => s.births.push(s.births[0]),
    (s) => (s.breedingCooldowns['creature-1'] = 30001),
  ]) {
    const state = w.state;
    damage(state);
    assert.throws(() => stateCodec(w.content).decode(state));
  }
});
test('failed birth writes roll back materials, cooldowns, lineage and telemetry', () => {
  const f = ready(),
    before = f.w.state,
    events = structuredClone(f.analytics.events);
  f.fail();
  assert.throws(() => f.w.breed('creature-1', 'creature-2', at));
  assert.deepEqual(f.w.state, before);
  assert.deepEqual(f.analytics.events, events);
});
