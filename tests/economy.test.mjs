import test from 'node:test';
import assert from 'node:assert/strict';
import { fullResearchWorkshop } from './helpers/research-workshop.mjs';
import { stateCodec } from '../dist/src/application/state.js';
import { salePrice, orderAt, orderRequirements } from '../dist/src/domain/economy.js';
const at = '2026-10-03T00:00:00Z';
test('market buys known biology/materials, crafts exact costs, and blocks undiscovered samples', () => {
  const { w } = fullResearchWorkshop(),
    before = w.state;
  w.buy('buy-fiber');
  assert.equal(w.state.biomass, before.biomass - 12);
  assert.equal(w.state.resources.fiber, (before.resources.fiber ?? 0) + 3);
  w.craft('craft-dragon-head');
  assert.equal(w.state.inventory['dragon-head'], before.inventory['dragon-head'] + 1);
  assert.equal(w.state.resources.fiber, (before.resources.fiber ?? 0) + 1);
  assert.equal(w.state.resources.crystal, before.resources.crystal - 1);
  const saved = w.state;
  assert.throws(() => w.buy('buy-tide-organ'), /Discover/);
  assert.throws(() => w.craft('invalid'));
  assert.deepEqual(w.state, saved);
});
test('sales free habitat capacity while preserving journal, family and unique ordered rewards', () => {
  const { w, repo } = fullResearchWorkshop(),
    c = w.creatures[0],
    before = w.state;
  const sale = w.sell(c.id, true);
  assert.equal(sale.biomass, salePrice(c, w.content) + orderAt(1, w.content).bonus);
  assert.equal(w.orderSerial, 2);
  assert.equal(w.creatures.length, before.creatures.length - 1);
  assert.deepEqual(w.state.creatures, before.creatures);
  assert.deepEqual(w.state.experiments, before.experiments);
  assert.throws(() => w.sell(c.id));
  assert.throws(() => w.rename(c.id, 'Missing'));
  assert.throws(() => w.breed(c.id, w.creatures[0].id, at));
  assert.throws(() => w.startExpedition('green-meadow', c.id, at));
  const flyer = w.creatures.find(
    (x) => !orderRequirements(orderAt(2, w.content), x, w.content).length,
  );
  assert(flyer);
  w.sell(flyer.id, true);
  assert.equal(w.orderSerial, 3);
  assert.deepEqual(repo.load(), w.state);
  const bad = w.state;
  bad.sales[0].biomass++;
  assert.throws(() => stateCodec(w.content).decode(bad));
  const invalid = w.state;
  invalid.sales[0].orderSerial = 9;
  assert.throws(() => stateCodec(w.content).decode(invalid));
});
test('assigned sales and failed writes preserve currency, inventory and ownership', () => {
  const f = fullResearchWorkshop(),
    w = f.w,
    id = w.creatures[0].id;
  const job = w.startExpedition('green-meadow', id, at);
  assert.throws(() => w.sell(id), /Assigned/);
  w.cancelExpedition(job.id);
  const before = w.state;
  f.fail();
  assert.throws(() => w.sell(id));
  assert.throws(() => w.buy('buy-dragon-head'));
  assert.deepEqual(w.state, before);
});
test('sales cannot fund an endless manufacture loop; all basic anatomies cost more than resale', () => {
  const { w } = fullResearchWorkshop(),
    parts = ['spider-legs', 'lightning-organ', 'crystal-armor', 'storm-wings'];
  for (let mask = 0; mask < 16; mask++) {
    const ids = ['dragon-head', 'wolf-body', ...parts.filter((_, i) => mask & (1 << i))];
    const template = w.creatures[0];
    const quote = salePrice(
      { ...template, componentIds: ids, level: 1, mutationIds: [] },
      w.content,
    );
    assert(quote < w.cost(ids));
    const purchasedCost =
      ids.reduce(
        (n, id) => n + w.content.catalog.economy.offers.find((o) => o.item === id).price,
        0,
      ) + w.cost(ids);
    assert(quote < purchasedCost);
  }
});
