import test from 'node:test';
import assert from 'node:assert/strict';
import { fullResearchWorkshop } from './helpers/research-workshop.mjs';
import { currentEvent, eventProgress } from '../dist/src/domain/events.js';
import { generateCreature, deriveCreature, analyzeDesign } from '../dist/src/domain/generator.js';
import { chooseAction } from '../dist/src/domain/combat.js';
import { stateCodec } from '../dist/src/application/state.js';
import { renderCreature } from '../dist/src/presentation/creature.js';
import { ContentIndex, decodeCatalog } from '../dist/src/domain/catalog.js';
import { validateVisuals } from '../dist/src/presentation/creature.js';
import { breedCreature } from '../dist/src/domain/breeding.js';
const at = '2026-10-03T00:00:00Z',
  fireAt = '2026-10-06T00:00:00Z',
  bloomAt = '2026-10-13T00:00:00Z';
const base = ['dragon-head', 'wolf-body'],
  winged = [...base, 'lightning-organ', 'storm-wings'];
function enrollAndMake(w, at) {
  w.joinEvent(at);
  for (let i = 0; i < 2; i++) w.manufacture(winged, at);
  w.claimEvent(at);
}
function gather(w, region, id, at) {
  const job = w.startExpedition(region, id, at);
  for (let i = 0; i < w.content.region(region).durationMs / 1000; i++) w.advanceExpeditions(1000);
  return w.claimExpedition(job.id);
}
function boss(w, id, at) {
  let b = w.startBattle(
    w.creatures.slice(0, 3).map((c) => c.id),
    at,
    { kind: 'boss', bossId: id },
  );
  while (b.status === 'active') b = w.battleAction(chooseAction(b, w.content));
  assert.equal(b.status, 'victory');
  return w.claimBattle();
}
test('weekly enrollment counts new work, pays once, resumes and rejects forged or expired claims', () => {
  const { w, repo } = fullResearchWorkshop(),
    before = w.state;
  assert.equal(currentEvent(at, w.content).templateId, 'aurora-lab');
  assert.equal(currentEvent('2026-10-05T00:00:00Z', w.content).templateId, 'cinder-lab');
  assert.equal(currentEvent('2026-09-01T00:00:00Z', w.content), null);
  w.joinEvent(at);
  assert.equal(eventProgress(w.state.eventRun, w.state, w.content), 0);
  assert.throws(() => w.claimEvent(at), /Complete/);
  w.manufacture(winged, at);
  assert.equal(eventProgress(w.state.eventRun, w.state, w.content), 1);
  assert.deepEqual(repo.load(), w.state);
  w.manufacture(winged, at);
  const earned = w.state;
  w.claimEvent(at);
  assert.equal(w.state.inventory['frost-organ'], 3);
  assert.equal(w.state.biomass, earned.biomass + 30);
  assert.equal(w.state.resources.fiber, (earned.resources.fiber ?? 0) + 3);
  assert.equal(w.state.eventClaims.length, 1);
  assert.throws(() => w.claimEvent(at));
  assert.throws(() => w.joinEvent(at));
  const bad = w.state;
  bad.eventClaims[0].run.baselineSerial = bad.eventClaims[0].endSerial;
  assert.throws(() => stateCodec(w.content).decode(bad), /objective/);
  const forged = structuredClone(before);
  forged.discoveredComponents.push('frost-organ');
  forged.inventory['frost-organ'] = 3;
  assert.throws(() => stateCodec(w.content).decode(forged), /Seasonal/);
  w.joinEvent(fireAt);
  assert.throws(() => w.claimEvent(bloomAt), /current/);
  assert.deepEqual(repo.load(), w.state);
});
test('seasonal anatomy unlocks two new regions and bosses with real gameplay and persistent rewards', () => {
  const { w, repo } = fullResearchWorkshop();
  assert.throws(
    () =>
      w.startBattle(
        w.creatures.slice(0, 3).map((c) => c.id),
        at,
        { kind: 'boss', bossId: 'frost-matriarch' },
      ),
    /Explore/,
  );
  enrollAndMake(w, at);
  const icy = w.manufacture([...base, 'frost-organ', 'crystal-armor', 'storm-wings'], at);
  assert.equal(gather(w, 'frozen-peaks', icy.id, at).discovery, 'frost-body');
  assert.equal(boss(w, 'frost-matriarch', at).newComponent, 'frost-armor');
  enrollAndMake(w, fireAt);
  const fiery = w.manufacture([...base, 'ember-organ', 'crystal-armor'], fireAt);
  assert.equal(gather(w, 'ashen-grove', fiery.id, fireAt).discovery, 'cinder-legs');
  assert.equal(boss(w, 'cinder-chimera', fireAt).newComponent, 'cinder-head');
  w.joinEvent(bloomAt);
  for (let i = 0; i < 2; i++) gather(w, 'green-meadow', w.creatures[0].id, bloomAt);
  w.claimEvent(bloomAt);
  assert(w.state.discoveredComponents.includes('bloom-head'));
  assert.equal(w.state.eventClaims.length, 3);
  assert.deepEqual(repo.load(), w.state);
});
test('limited mutations are seeded and functional only in their window; old specimens keep their phenotype', () => {
  const { w } = fullResearchWorkshop(),
    c = w.content;
  const designs = [
    ['storm-frost', [...base, 'frost-organ', 'storm-wings'], at],
    ['ember-crown', [...base, 'ember-organ'], fireAt],
    ['living-bloom', ['bloom-head', 'wolf-body', 'herbal-organ'], bloomAt],
  ];
  for (const [mutation, ids, createdAt] of designs) {
    const made = generateCreature(ids, c, {
      seed: 3,
      createdAt,
      creator: 'Lab',
      forceMutation: mutation,
    });
    assert(made.mutationIds.includes(mutation));
    assert(
      renderCreature(made, c, false).includes(
        `data-feature="${c.mutations.get(mutation).feature}"`,
      ),
    );
    assert.deepEqual(deriveCreature(made, c), made);
    const other = mutation === 'storm-frost' ? fireAt : at;
    assert.throws(
      () =>
        generateCreature(ids, c, {
          seed: 3,
          createdAt: other,
          creator: 'Lab',
          forceMutation: mutation,
        }),
      /eligible/,
    );
    for (let seed = 0; seed < 100; seed++)
      assert(
        !generateCreature(ids, c, { seed, createdAt: other, creator: 'Lab' }).mutationIds.includes(
          mutation,
        ),
      );
    assert(
      analyzeDesign(ids, c, createdAt).mutationChance > analyzeDesign(ids, c, other).mutationChance,
    );
  }
});
test('seasonal crafting returns with the calendar; failed event writes roll back reward and enrollment', () => {
  const f = fullResearchWorkshop(),
    w = f.w;
  enrollAndMake(w, at);
  w.buy('buy-frost-organ', at);
  const before = w.state;
  assert.throws(() => w.buy('buy-frost-organ', fireAt), /Seasonal/);
  assert.deepEqual(w.state, before);
  w.joinEvent(fireAt);
  for (let i = 0; i < 2; i++) w.manufacture(winged, fireAt);
  const ready = w.state;
  f.fail();
  assert.throws(() => w.claimEvent(fireAt));
  assert.deepEqual(w.state, ready);
  const fresh = fullResearchWorkshop(),
    initial = fresh.w.state;
  fresh.fail();
  assert.throws(() => fresh.w.joinEvent(at));
  assert.deepEqual(fresh.w.state, initial);
});
test('limited parental biology persists through inheritance outside the natural event window', () => {
  const { w } = fullResearchWorkshop(),
    c = w.content,
    ids = [...base, 'frost-organ', 'storm-wings'];
  const a = generateCreature(ids, c, {
    seed: 3,
    createdAt: at,
    creator: 'Lab',
    id: 'a',
    forceMutation: 'storm-frost',
  });
  const b = generateCreature(ids, c, {
    seed: 7,
    createdAt: at,
    creator: 'Lab',
    id: 'b',
    forceMutation: 'storm-frost',
  });
  let inherited = 0;
  for (let seed = 0; seed < 40; seed++) {
    const child = breedCreature(a, b, c, { seed, createdAt: fireAt, creator: 'Lab', id: 'child' });
    if (child.mutationIds.includes('storm-frost')) inherited++;
  }
  assert(inherited > 10);
  assert(inherited < 40);
});
test('live catalog rejects broken rotations, rewards and visuals; migration preserves existing sources', () => {
  const { w } = fullResearchWorkshop(),
    catalog = w.content.catalog;
  for (const change of [
    (c) => (c.live.events = []),
    (c) => (c.live.periodDays = 0),
    (c) => (c.live.events[0].component = 'dragon-head'),
    (c) => (c.live.events[0].mutation = 'ember-crown'),
    (c) => (c.advanced.bosses[1].requiresRegion = 'missing'),
    (c) => (c.live.events[0].objective.tags = ['impossible']),
  ]) {
    const bad = structuredClone(catalog);
    change(bad);
    assert.throws(() => decodeCatalog(bad));
  }
  const visual = structuredClone(catalog);
  visual.mutations[1].feature = 'missing';
  assert.throws(() => validateVisuals(new ContentIndex(decodeCatalog(visual))));
  const old = w.state;
  delete old.eventRun;
  delete old.eventClaims;
  const migrated = stateCodec(w.content).decode(old);
  assert.equal(migrated.eventRun, null);
  assert.deepEqual(migrated.eventClaims, []);
  assert.deepEqual(migrated.creatures, old.creatures);
});
