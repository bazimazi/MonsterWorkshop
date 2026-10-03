import test from 'node:test';
import assert from 'node:assert/strict';
import { fullResearchWorkshop } from './helpers/research-workshop.mjs';
import {
  chooseAction,
  currentActor,
  decodeBattle,
  resolveAction,
} from '../dist/src/domain/combat.js';
import { challengeStats } from '../dist/src/domain/challenges.js';
const at = '2026-10-03T00:00:00Z';
test('boss mechanics, unique discovery and tower advancement survive validated persistence', () => {
  const { w } = fullResearchWorkshop(),
    ids = w.creatures.slice(0, 3).map((c) => c.id);
  let b = w.startBattle(ids, at, { kind: 'boss', bossId: 'storm-hydra' }),
    phased = false;
  while (b.status === 'active') {
    b = w.battleAction(chooseAction(b, w.content));
    phased ||= b.challenge.bossPhase;
    assert.deepEqual(decodeBattle(b, w.content), b);
  }
  assert(phased);
  assert.equal(b.status, 'victory');
  const reward = w.claimBattle();
  assert.equal(reward.newComponent, 'tide-organ');
  assert(w.state.bossVictories.includes('storm-hydra'));
  assert.throws(() => w.claimBattle());
  b = w.startBattle(ids, at, { kind: 'tower', modifier: 'armored' });
  while (b.status === 'active') b = w.battleAction(chooseAction(b, w.content));
  assert.equal(b.status, 'victory');
  w.claimBattle();
  assert.equal(w.state.towerFloor, 2);
  w.startBattle(ids, at, { kind: 'tower' });
  w.retreatBattle();
  w.claimBattle();
  assert.equal(w.state.towerFloor, 2);
});
test('reactions consume a triggering status and apply advanced effects; synergies and floors alter stats', () => {
  const { w } = fullResearchWorkshop(),
    ids = w.creatures.slice(0, 3).map((c) => c.id);
  const b = w.startBattle(ids, at, { kind: 'tower' }),
    actor = currentActor(b),
    target = b.units.find((u) => u.team === 'enemy');
  target.statuses.push({ id: 'shock', duration: 2, potency: 0.25 });
  const next = resolveAction(
    b,
    { actorId: actor.id, abilityId: 'thunder-pulse', targetId: target.id },
    w.content,
  );
  assert(next.log.some((line) => line.includes('Electrical Overload')));
  assert(!next.units.find((u) => u.id === target.id).statuses.some((s) => s.id === 'shock'));
  const source = w.state.creatures[0],
    base = challengeStats(source, 'player', [source], w.content);
  const synergy = challengeStats(
    source,
    'player',
    w.state.creatures.slice(0, 3),
    w.content,
    b.challenge,
  );
  assert(synergy.defense > base.defense);
  assert(synergy.energy > base.energy);
  const high = challengeStats(source, 'enemy', [source], w.content, { ...b.challenge, floor: 10 });
  const low = challengeStats(source, 'enemy', [source], w.content, b.challenge);
  assert(high.hp > low.hp);
  const corrupt = structuredClone(next);
  corrupt.challenge.floor = -1;
  assert.throws(() => decodeBattle(corrupt, w.content));
});
