import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ContentIndex, decodeCatalog } from '../dist/src/domain/catalog.js';
import { generateCreature, deriveCreature } from '../dist/src/domain/generator.js';
import {
  availableAbilities,
  canUse,
  chooseAction,
  createBattle,
  currentActor,
  damageAmount,
  decodeBattle,
  resolveAction,
  retreat,
} from '../dist/src/domain/combat.js';
const raw = JSON.parse(readFileSync('content/catalog.json', 'utf8'));
const content = new ContentIndex(decodeCatalog(raw));
const at = '2026-10-02T00:00:00Z',
  base = ['dragon-head', 'wolf-body'];
function specimen(id, seed, ids = [...base, 'lightning-organ', 'crystal-armor', 'spider-legs']) {
  return generateCreature(ids, content, {
    seed,
    createdAt: at,
    creator: 'Test',
    id,
    skipMutations: true,
  });
}
function fixture(seed = 42, tough = false) {
  const players = [1, 2, 3].map((i) => specimen('p' + i, i)),
    enemies = [1, 2, 3].map((i) => specimen('e' + i, i + 8, base));
  if (tough)
    for (const c of [...players, ...enemies]) {
      c.training.hp = 1000;
      Object.assign(c, deriveCreature(c, content));
    }
  return createBattle(players, enemies, content, 'test-battle', seed, at);
}
function untilActor(battle, id) {
  let next = battle;
  for (let i = 0; i < 12 && currentActor(next)?.id !== id; i++)
    next = resolveAction(next, chooseAction(next, content, true), content);
  assert.equal(currentActor(next)?.id, id);
  return next;
}
test('damage handles armor, resistance, critical hits and minimum damage', () => {
  assert.equal(damageAmount(100, 20, 0.045, 1, false, 1.5), 53);
  assert.equal(damageAmount(100, 20, 0.045, 0.8, true, 1.5), 63);
  assert.equal(damageAmount(0, 9999, 0.045, 1, false, 1.5), 1);
});
test('three versus three and stable speed ordering are enforced', () => {
  const b = fixture(),
    speeds = b.order.map((id) => b.units.find((u) => u.id === id).stats.speed);
  assert.deepEqual(
    speeds,
    [...speeds].sort((a, b) => b - a),
  );
  assert.deepEqual(b, fixture());
  assert.throws(() => createBattle([specimen('a', 1)], [], content, 'x', 1, at));
  assert.throws(() =>
    createBattle(
      [specimen('a', 1), specimen('a', 1), specimen('b', 2)],
      [specimen('d', 1), specimen('e', 2), specimen('f', 3)],
      content,
      'x',
      1,
      at,
    ),
  );
});
test('illegal turns, abilities, targets, energy and cooldowns do not mutate battle', () => {
  const b = fixture(),
    actor = currentActor(b),
    target = b.units.find((u) => u.team !== actor.team),
    before = structuredClone(b);
  for (const action of [
    { actorId: target.id, abilityId: 'strike', targetId: actor.id },
    { actorId: actor.id, abilityId: 'missing', targetId: target.id },
    { actorId: actor.id, abilityId: 'strike', targetId: actor.id },
    { actorId: actor.id, abilityId: 'crystal-guard', targetId: target.id },
  ])
    assert.throws(() => resolveAction(b, action, content));
  assert.deepEqual(b, before);
  const starved = structuredClone(b);
  currentActor(starved).energy = 0;
  assert.throws(() =>
    resolveAction(
      starved,
      { actorId: actor.id, abilityId: 'thunder-pulse', targetId: target.id },
      content,
    ),
  );
});
test('shields absorb damage before health and defeated targets cannot be healed', () => {
  const b = fixture(),
    actor = currentActor(b),
    target = b.units.find((u) => u.team !== actor.team);
  target.shield = target.stats.hp;
  const next = resolveAction(
      b,
      { actorId: actor.id, abilityId: 'strike', targetId: target.id },
      content,
    ),
    after = next.units.find((u) => u.id === target.id);
  assert.equal(after.hp, target.hp);
  assert(after.shield < target.shield);
  const dead = structuredClone(b);
  dead.units.find((u) => u.id === target.id).hp = 0;
  assert.throws(() =>
    resolveAction(dead, { actorId: actor.id, abilityId: 'strike', targetId: target.id }, content),
  );
});
test('cooldowns block exactly N own turns; basic attack and energy recovery remain available', () => {
  let b = fixture(42, true);
  const actor = currentActor(b),
    guard = content.ability('crystal-guard');
  assert(canUse(actor, guard));
  b = resolveAction(b, { actorId: actor.id, abilityId: guard.id, targetId: actor.id }, content);
  for (let turn = 0; turn < 2; turn++) {
    b = untilActor(b, actor.id);
    assert(!canUse(currentActor(b), guard));
    assert(canUse(currentActor(b), content.ability('strike')));
    b = resolveAction(b, chooseAction(b, content, true), content);
  }
  b = untilActor(b, actor.id);
  assert(canUse(currentActor(b), guard));
  assert(currentActor(b).energy <= currentActor(b).stats.energy);
});
test('burn and regeneration tick for the exact number of affected turns', () => {
  let b = fixture(42, true);
  const first = currentActor(b),
    second = b.units.find((u) => u.id === b.order[1]);
  second.hp -= 20;
  second.statuses = [
    { id: 'burn', potency: 5, duration: 2 },
    { id: 'regeneration', potency: 3, duration: 2 },
  ];
  b = resolveAction(b, chooseAction(b, content, true), content);
  assert.equal(currentActor(b).id, second.id);
  assert.equal(currentActor(b).hp, second.hp - 2);
  assert.equal(currentActor(b).statuses[0].duration, 2);
  b = resolveAction(b, chooseAction(b, content, true), content);
  b = untilActor(b, second.id);
  assert.equal(currentActor(b).statuses[0].duration, 1);
  b = resolveAction(b, chooseAction(b, content, true), content);
  assert.equal(b.units.find((u) => u.id === second.id).statuses.length, 0);
  assert.notEqual(first.id, second.id);
});
test('shock and weakness reduce outgoing damage and slow affects subsequent round ordering', () => {
  const rules = structuredClone(raw);
  rules.rules.combat.criticalChance = 0;
  const noCrit = new ContentIndex(decodeCatalog(rules));
  const b = fixture(42, true),
    actor = currentActor(b),
    target = b.units.find((u) => u.team !== actor.team),
    action = { actorId: actor.id, abilityId: 'strike', targetId: target.id };
  const normal = resolveAction(b, action, noCrit);
  actor.statuses.push({ id: 'shock', potency: 0.5, duration: 2 });
  const weak = resolveAction(b, action, noCrit);
  assert(
    weak.units.find((u) => u.id === target.id).hp > normal.units.find((u) => u.id === target.id).hp,
  );
  const slowed = fixture(42, true);
  const fast = currentActor(slowed);
  fast.statuses.push({ id: 'slow', potency: 0.9, duration: 5 });
  let next = slowed;
  while (next.round === 1) next = resolveAction(next, chooseAction(next, content, true), content);
  assert.equal(next.order.at(-1), fast.id);
});
test('healing clamps to maximum HP; statuses apply from ability data', () => {
  const players = [1, 2, 3].map((i) => specimen('p' + i, i, base)),
    enemies = [1, 2, 3].map((i) => specimen('e' + i, i + 8, base));
  let b = createBattle(players, enemies, content, 'heal', 0, at);
  const actor = currentActor(b),
    ally = b.units.find((u) => u.team === actor.team && u.id !== actor.id);
  ally.hp -= 10;
  b = resolveAction(b, { actorId: actor.id, abilityId: 'mend', targetId: ally.id }, content);
  assert.equal(b.units.find((u) => u.id === ally.id).hp, ally.stats.hp);
  const web = fixture(),
    webActor = currentActor(web),
    target = web.units.find((u) => u.team !== webActor.team);
  const result = resolveAction(
    web,
    { actorId: webActor.id, abilityId: 'web-trap', targetId: target.id },
    content,
  );
  assert(result.units.find((u) => u.id === target.id).statuses.some((s) => s.id === 'slow'));
});
test('battle save decoding reconstructs stats and rejects impossible state', () => {
  const b = fixture();
  assert.deepEqual(decodeBattle(b, content), b);
  const injection = structuredClone(b);
  injection.units[0].stats.attack = 999999;
  assert.equal(decodeBattle(injection, content).units[0].stats.attack, b.units[0].stats.attack);
  for (const change of [
    (b) => (b.rngState = -1),
    (b) => (b.units[0].hp = 99999),
    (b) => (b.order = ['missing']),
    (b) => (b.order = [b.order[0]]),
    (b) => (b.status = 'victory'),
    (b) => (b.units[0].statuses = [{ id: 'void', duration: 2, potency: 1 }]),
    (b) => (b.units[0].cooldowns.missing = 1),
  ]) {
    const invalid = fixture();
    change(invalid);
    assert.throws(() => decodeBattle(invalid, content));
  }
});
test('enemy victory defeats the squad without deleting creature provenance', () => {
  const players = [1, 2, 3].map((i) => {
    const c = specimen('weak-' + i, i, base);
    c.training = { hp: -1000, attack: -1000, defense: -1000, speed: -1000, power: -1000 };
    return deriveCreature(c, content);
  });
  const enemies = [1, 2, 3].map((i) => specimen('enemy-' + i, i + 8));
  let battle = createBattle(players, enemies, content, 'defeat-test', 42, at);
  while (battle.status === 'active')
    battle = resolveAction(battle, chooseAction(battle, content), content);
  assert.equal(battle.status, 'defeat');
  assert.equal(battle.reason, 'eliminated');
  const retained = battle.units.filter((u) => u.team === 'player');
  assert.equal(retained.length, 3);
  assert(retained.every((u) => u.hp === 0));
  assert.deepEqual(
    retained.map((u) => u.source.id),
    players.map((p) => p.id),
  );
  assert.deepEqual(decodeBattle(battle, content), battle);
});
test('100 seeded combat simulations terminate with valid HP, energy, turn state and deterministic outcomes', () => {
  for (let seed = 0; seed < 100; seed++) {
    const simulate = () => {
      let b = fixture(seed);
      let actions = 0;
      while (b.status === 'active') {
        b = resolveAction(b, chooseAction(b, content), content);
        assert.deepEqual(decodeBattle(b, content), b);
        assert(++actions <= content.catalog.rules.combat.maxRounds * 6);
      }
      return b;
    };
    const b = simulate();
    assert.deepEqual(b, simulate());
    assert(['victory', 'defeat'].includes(b.status));
    assert(b.log.length <= 80);
  }
});
test('retreat and round limits end safely; defeated creatures remain in source snapshots', () => {
  const b = fixture();
  assert.equal(retreat(b).status, 'defeat');
  assert.equal(retreat(b).units.length, 6);
  assert.equal(b.status, 'active');
  const rawLimit = structuredClone(raw);
  rawLimit.rules.combat.maxRounds = 1;
  const limit = new ContentIndex(decodeCatalog(rawLimit));
  let next = fixture(42, true);
  while (next.status === 'active')
    next = resolveAction(next, chooseAction(next, limit, true), limit);
  assert.equal(next.reason, 'limit');
  assert.equal(next.status, 'defeat');
  assert.throws(() => resolveAction(next, {}, limit));
});
