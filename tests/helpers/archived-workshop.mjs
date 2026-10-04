import { readFileSync } from 'node:fs';
import { ContentIndex, decodeCatalog } from '../../dist/src/domain/catalog.js';
import { generateCreature } from '../../dist/src/domain/generator.js';
import { decodeCreature } from '../../dist/src/domain/serialization.js';
import { hash } from '../../dist/src/domain/random.js';
import { salePrice } from '../../dist/src/domain/economy.js';
import { initialState, stateCodec } from '../../dist/src/application/state.js';
import { Workshop } from '../../dist/src/application/workshop.js';
import { SaveRepository } from '../../dist/src/platform/save.js';
import { LocalAnalytics } from '../../dist/src/platform/services.js';

export function archivedWorkshop(count = 1100) {
  const content = new ContentIndex(
    decodeCatalog(JSON.parse(readFileSync('content/catalog.json', 'utf8'))),
  );
  const data = initialState(content, 42),
    values = new Map();
  data.playerName = '実験🧬工程師';
  for (let serial = 1; serial <= count; serial++) {
    const creature = generateCreature(['dragon-head', 'wolf-body'], content, {
      seed: hash(`${data.seedBase}:${serial}`),
      id: `creature-${serial}`,
      createdAt: '2026-10-03T00:00:00Z',
      creator: data.playerName,
    });
    data.creatures.push(decodeCreature(creature, content));
    data.experiments.push({
      serial,
      creatureId: creature.id,
      componentIds: creature.componentIds,
      seed: creature.seed,
      compatibility: creature.compatibility.score,
      mutationIds: creature.mutationIds,
      createdAt: creature.createdAt,
      controlledMutation: null,
    });
    data.discoveredMutations = [...new Set([...data.discoveredMutations, ...creature.mutationIds])];
    if (serial <= count - 3)
      data.sales.push({
        creatureId: creature.id,
        orderSerial: null,
        biomass: salePrice(creature, content),
        resources: {},
      });
  }
  data.nextSerial = count + 1;
  const repo = new SaveRepository(
    { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) },
    stateCodec(content),
  );
  repo.write(data);
  return { w: new Workshop(content, repo, new LocalAnalytics(), 9), repo, values };
}
