import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { ContentIndex, decodeCatalog } from '../dist/src/domain/catalog.js';
import { generateCreature, validateAnatomy } from '../dist/src/domain/generator.js';
import { chooseAction, createBattle, resolveAction } from '../dist/src/domain/combat.js';
import { renderCreature } from '../dist/src/presentation/creature.js';
import { orderAt, orderRequirements } from '../dist/src/domain/economy.js';
import { Workshop } from '../dist/src/application/workshop.js';
import { stateCodec } from '../dist/src/application/state.js';
import { SaveRepository } from '../dist/src/platform/save.js';
import { LocalAnalytics } from '../dist/src/platform/services.js';
const content = new ContentIndex(
  decodeCatalog(JSON.parse(readFileSync('content/catalog.json', 'utf8'))),
);
const [command = 'help', ...args] = process.argv.slice(2);
const at = '2026-10-02T00:00:00.000Z';
const starter = content.catalog.components
  .filter((p) => p.discovery === 'starter')
  .map((p) => p.id);
const options = (seed) => ({ seed, createdAt: at, creator: 'Developer' });
function player(seed) {
  const values = new Map(),
    storage = {
      getItem: (k) => values.get(k) ?? null,
      setItem: (k, v) => values.set(k, v),
      removeItem: (k) => values.delete(k),
    };
  return new Workshop(
    content,
    new SaveRepository(storage, stateCodec(content)),
    new LocalAnalytics(),
    seed,
  );
}
function win(workshop) {
  const squad = workshop.creatures
    .toSorted(
      (a, b) =>
        b.stats.hp +
        b.stats.power +
        b.stats.defense -
        (a.stats.hp + a.stats.power + a.stats.defense),
    )
    .slice(0, 3);
  let battle = workshop.startBattle(
    squad.map((c) => c.id),
    at,
  );
  while (battle.status === 'active') battle = workshop.battleAction(chooseAction(battle, content));
  return workshop.claimBattle().victory;
}
if (command === 'catalog')
  console.table(
    content.catalog.components.map((p) => ({
      id: p.id,
      slot: p.slot,
      element: p.element,
      discovery: p.discovery,
      energy: p.energyCost,
    })),
  );
else if (command === 'generate' || command === 'validate') {
  const seed = Number(args.shift() ?? 1742),
    force = args.find((arg) => arg.startsWith('--mutation='))?.split('=')[1];
  const parts = args.filter((arg) => !arg.startsWith('--'));
  const ids = parts.length ? parts : starter;
  validateAnatomy(ids, content);
  const creature = generateCreature(ids, content, {
    ...options(seed),
    ...(force ? { forceMutation: force } : {}),
  });
  console.log(JSON.stringify(command === 'validate' ? creature.compatibility : creature, null, 2));
} else if (command === 'edit-genome') {
  const source = JSON.parse(readFileSync(args.shift(), 'utf8'));
  for (const assignment of args) {
    const [gene, value] = assignment.split('=');
    if (!source.genome[gene]) throw new Error(`Unknown gene ${gene}`);
    source.genome[gene].value = Number(value);
  }
  const { decodeCreature } = await import('../dist/src/domain/serialization.js');
  console.log(JSON.stringify(decodeCreature(source, content), null, 2));
} else if (command === 'mutations') {
  const count = Number(args[0] ?? 10000);
  let mutated = 0;
  for (let seed = 0; seed < count; seed++)
    if (generateCreature(starter, content, options(seed)).mutationIds.length) mutated++;
  console.log(JSON.stringify({ trials: count, mutated, rate: mutated / count }, null, 2));
} else if (command === 'combat') {
  const count = Number(args[0] ?? 100);
  let wins = 0,
    rounds = 0;
  for (let seed = 0; seed < count; seed++) {
    const players = [0, 1, 2].map((i) =>
      generateCreature(starter, content, { ...options(seed * 3 + i), id: `player-${i}` }),
    );
    const enemies = content.catalog.rules.combat.opponents.map((o, i) =>
      generateCreature(o.components, content, {
        ...options(o.seed),
        id: `enemy-${i}`,
        skipMutations: true,
      }),
    );
    let battle = createBattle(players, enemies, content, `sim-${seed}`, seed, at);
    while (battle.status === 'active')
      battle = resolveAction(battle, chooseAction(battle, content), content);
    wins += battle.status === 'victory' ? 1 : 0;
    rounds += battle.round;
  }
  console.log(
    JSON.stringify(
      { trials: count, wins, winRate: wins / count, averageRounds: rounds / count },
      null,
      2,
    ),
  );
} else if (command === 'economy') {
  const profiles = {
    casual: 1,
    regular: 2,
    hardcore: 5,
    optimizer: 3,
    collector: 2,
    experimenter: 3,
  };
  const rows = [];
  for (const [profile, sessions] of Object.entries(profiles))
    for (const days of [1, 7, 30, 90]) {
      const workshop = player(42);
      for (let i = 0; i < 3; i++) workshop.manufacture(starter, at);
      let victories = 0,
        blocked = 0;
      for (let day = 0; day < days; day++)
        for (let session = 0; session < sessions; session++) {
          victories += win(workshop) ? 1 : 0;
          if (workshop.creatures.length > 5) {
            const order = orderAt(workshop.orderSerial, content);
            const matching = workshop.creatures.find(
              (c) => !orderRequirements(order, c, content).length,
            );
            workshop.sell((matching ?? workshop.creatures.at(-1)).id, !!matching);
          }
          if (workshop.state.resources.fiber >= 2 && workshop.state.resources.crystal >= 1)
            workshop.craft('craft-dragon-head');
          if (profile === 'collector') workshop.buy('buy-fiber');
          if (workshop.creatures.length < content.catalog.rules.workshop.maxCreatures) {
            try {
              workshop.manufacture(
                [
                  ...starter,
                  ...(profile === 'collector' || profile === 'experimenter' ? ['storm-wings'] : []),
                ],
                at,
              );
            } catch {
              blocked++;
            }
          }
        }
      rows.push({
        profile,
        days,
        victories,
        creatures: workshop.creatures.length,
        biomass: workshop.state.biomass,
        sales: workshop.state.sales.length,
        requests: workshop.orderSerial - 1,
        lowestStock: Math.min(...Object.values(workshop.state.inventory)),
        blocked,
      });
    }
  console.table(rows);
} else if (command === 'profile') {
  const count = 2000,
    start = performance.now();
  let creature;
  for (let seed = 0; seed < count; seed++)
    creature = generateCreature(starter, content, options(seed));
  const generated = performance.now();
  for (let i = 0; i < count; i++) renderCreature(creature, content, false);
  console.log(
    JSON.stringify(
      {
        trials: count,
        generateMs: (generated - start) / count,
        visualMs: (performance.now() - generated) / count,
      },
      null,
      2,
    ),
  );
} else
  console.log(
    'Lab commands: catalog | generate [seed] [component IDs] [--mutation=id] | validate [seed] [IDs] | edit-genome source.json gene=value | mutations [trials] | combat [trials] | economy | profile',
  );
