import type { Workshop } from '../application/workshop.js';
import { seasonalAvailable } from '../domain/events.js';
import { costRequirements } from '../domain/research.js';
import { orderAt, orderRequirements, salePrice } from '../domain/economy.js';
import { describeCost } from './research.js';
import { escape } from './html.js';
import { renderCreature } from './creature.js';
export function marketView(
  w: Workshop,
  offerId?: string,
  recipeId?: string,
  creatureId?: string,
): string {
  const s = w.state,
    c = w.content;
  const offers = c.catalog.economy.offers.filter(
    (o) =>
      o.type === 'resource' ||
      (s.discoveredComponents.includes(o.item) &&
        seasonalAvailable(o.item, new Date().toISOString(), c)),
  );
  const offer = offers.find((o) => o.id === offerId) ?? offers[0]!;
  const recipes = c.catalog.economy.recipes.filter(
    (r) =>
      s.discoveredComponents.includes(r.component) &&
      seasonalAvailable(r.component, new Date().toISOString(), c),
  );
  const recipe = recipes.find((r) => r.id === recipeId) ?? recipes[0]!;
  const creature = w.creatures.find((x) => x.id === creatureId) ?? w.creatures[0];
  const order = orderAt(w.orderSerial, c);
  const reasons = orderRequirements(order, creature, c);
  const unavailable =
    !creature ||
    w.creatures.length < 2 ||
    w.isAssigned(creature.id) ||
    (s.breedingCooldowns[creature.id] ?? 0) > 0;
  const name = (type: string, id: string): string =>
    type === 'component' ? c.component(id).name : c.resources.get(id)!.name;
  return `<div class="page-heading"><div><p class="eyebrow">BIOLOGY HAS VALUE</p><h1 tabindex="-1">Marketplace</h1><p class="muted">NPC supplies and requests for your workshop.</p></div><a class="secondary" href="#workshop">Build a design</a></div>
  <nav class="secondary-nav" aria-label="Town"><a class="secondary" href="#events">Event calendar</a><a class="secondary" href="#social">Showcase & blueprints</a></nav><div class="exploration-layout"><section class="panel"><h2>Buy supplies</h2><label class="explorer-picker">Supply<select data-market-offer="true" aria-label="Market supply">${offers.map((o) => `<option value="${o.id}" ${o.id === offer.id ? 'selected' : ''}>${escape(name(o.type, o.item))} ×${o.quantity} · ${o.price} biomass</option>`).join('')}</select></label><p class="micro">Only discovered components can be purchased. Material packs contain three units.</p><button class="primary" data-action="market-buy" data-id="${offer.id}" ${s.biomass < offer.price ? 'disabled' : ''}>Buy supply · ${offer.price} biomass</button><h3>Stored materials</h3>${c.catalog.resources.map((r) => `<p class="tag">${escape(r.name)} ×${s.resources[r.id] ?? 0}</p>`).join('')}</section>
  <section class="panel"><h2>Craft biological samples</h2><label class="explorer-picker">Recipe<select data-market-recipe="true" aria-label="Crafting recipe">${recipes.map((r) => `<option value="${r.id}" ${r.id === recipe.id ? 'selected' : ''}>${escape(c.component(r.component).name)} ×${r.quantity}</option>`).join('')}</select></label><p class="muted">${escape(describeCost(recipe.cost, c))}</p><p class="micro">Uses gathered materials to replenish known anatomy. Research parts have cultivation recipes in Research.</p><button class="primary" data-action="market-craft" data-id="${recipe.id}" ${costRequirements(recipe.cost, s.biomass, s.resources, c).length ? 'disabled' : ''}>Craft sample</button></section></div>
  <section class="panel"><div class="section-title"><h2>Creature sales & requests</h2><span class="tag">REQUEST #${w.orderSerial}</span></div><p class="muted">Sales and deliveries move a creature out of your habitat. Its journal and family records remain. Keep one companion for exploration.</p><label class="explorer-picker">Creature<select data-market-creature="true" aria-label="Creature to sell">${w.creatures.map((x) => `<option value="${escape(x.id)}" ${x.id === creature?.id ? 'selected' : ''}>${escape(x.name)} · ${salePrice(x, c)} biomass${w.isAssigned(x.id) ? ' · assigned' : ''}</option>`).join('')}</select></label>
  ${creature ? `<div class="explorer-preview">${renderCreature(creature, c, false)}</div><button class="secondary" data-action="market-sell" data-id="${escape(creature.id)}" ${unavailable ? 'disabled' : ''}>Sell creature · ${salePrice(creature, c)} biomass</button>` : '<p class="micro">Manufacture a creature to begin.</p>'}
  <h3>${escape(order.customer)}</h3><p class="muted">${escape(order.description)}</p><p class="micro">${escape([...order.tags, ...Object.entries(order.genes).map(([g, n]) => `${g} ≥ ${n}`), ...Object.entries(order.minimumStats).map(([k, n]) => `${k} ≥ ${n}`)].join(' / '))}</p><p class="tag">Sale value + ${order.bonus} biomass / ${Object.entries(
    order.resources,
  )
    .map(([id, n]) => `${n} ${escape(c.resources.get(id)!.name)}`)
    .join(
      ' / ',
    )}</p><div>${reasons.map((r) => `<p class="micro requirement">${escape(r)}</p>`).join('')}</div><button class="primary" data-action="market-deliver" data-id="${escape(creature?.id ?? '')}" ${unavailable || reasons.length ? 'disabled' : ''}>Deliver creature</button><p class="micro">Requests rotate after delivery. Assigned and resting creatures stay in the habitat.</p></section>
  <section class="panel"><h2>Commerce ledger</h2>${
    s.sales.length
      ? s.sales
          .slice(-10)
          .reverse()
          .map(
            (sale) =>
              `<p class="micro">${escape(s.creatures.find((x) => x.id === sale.creatureId)!.name)} · ${sale.orderSerial ? `Request #${sale.orderSerial}` : 'Sale'} · +${sale.biomass} biomass</p>`,
          )
          .join('')
      : '<p class="muted">Your first customer is waiting.</p>'
  }</section>`;
}
