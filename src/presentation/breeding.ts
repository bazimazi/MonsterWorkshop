import type { Workshop } from '../application/workshop.js';
import { costRequirements } from '../domain/research.js';
import { GENES } from '../domain/model.js';
import { describeCost } from './research.js';
import { renderCreature } from './creature.js';
import { escape, title } from './html.js';

export function breedingView(w: Workshop, a: string | undefined, b: string | undefined): string {
  const state = w.state,
    content = w.content,
    creatures = w.creatures;
  const parents = [a, b].map((id) => creatures.find((c) => c.id === id));
  const reasons = costRequirements(
    content.catalog.rules.breeding.cost,
    state.biomass,
    state.resources,
    content,
  );
  if (!a || !b || a === b) reasons.push('Choose two different parents.');
  for (const id of [a, b])
    if (id && (w.isAssigned(id) || (state.breedingCooldowns[id] ?? 0) > 0))
      reasons.push('A selected parent is assigned or resting.');
  if (creatures.length >= content.catalog.rules.workshop.maxCreatures)
    reasons.push('Your habitat is full.');
  return `<div class="page-heading"><div><p class="eyebrow">THE NEXT GENERATION</p><h1 tabindex="-1">Breeding nursery</h1><p class="muted">Two inventions. A family of possibilities.</p></div><a class="secondary" href="#creatures">Back to habitat</a></div><div class="exploration-layout">${parents.map((p, i) => `<section class="panel"><label class="explorer-picker">Parent ${i === 0 ? 'A' : 'B'}<select aria-label="Parent ${i === 0 ? 'A' : 'B'}" data-parent="${i}"><option value="">Choose a parent</option>${creatures.map((c) => `<option value="${c.id}" ${c.id === [a, b][i] ? 'selected' : ''}>${escape(c.name)}${w.isAssigned(c.id) ? ' · Assigned' : (state.breedingCooldowns[c.id] ?? 0) > 0 ? ' · Resting' : ''}</option>`).join('')}</select></label>${p ? `${renderCreature(p, content, false)}<p class="tag">GENERATION ${p.lineage?.generation ?? 1}</p>${GENES.map((id) => `<div class="gene-row"><span>${title(id)}</span><strong>${p.genome[id].value}</strong><small>${p.genome[id].dominance}</small></div>`).join('')}` : '<p class="muted">Select a specimen to compare its genes.</p>'}</section>`).join('')}</div><section class="panel"><h2>Inheritance</h2><p class="muted">Each anatomy slot comes from a parent. Dominant genes are more likely to be inherited; recessive genes can persist, and blended genes combine both values. Small variation keeps offspring distinct. Only eligible mutations can pass to the child.</p><p>${escape(describeCost(content.catalog.rules.breeding.cost, content))} · No components consumed.</p><button class="primary" data-action="breed" ${reasons.length ? 'disabled' : ''}>Create offspring</button>${reasons.map((r) => `<p class="micro requirement">${escape(r)}</p>`).join('')}<p class="micro">Parents rest for ${content.catalog.rules.breeding.cooldownMs / 1000}s of visible play after breeding. Progress is saved.</p><div class="codex-list">${creatures
    .filter((c) => (state.breedingCooldowns[c.id] ?? 0) > 0)
    .map(
      (c) =>
        `<div><span>${escape(c.name)}</span><span data-resting="${c.id}">${Math.ceil(state.breedingCooldowns[c.id]! / 1000)}s resting</span></div>`,
    )
    .join('')}</div></section><section class="panel expedition-queue"><h2>Family album</h2>${
    creatures
      .filter((c) => c.lineage)
      .reverse()
      .map(
        (c) =>
          `<article class="field-report"><h3>${escape(c.name)} · Generation ${c.lineage!.generation}</h3><p>${c.lineage!.parentNames.map(escape).join(' + ')}</p><p class="micro">${GENES.map((id) => `${title(id)}: ${c.lineage!.inheritance[id] === 'blend' ? 'blended' : 'Parent ' + c.lineage!.inheritance[id].toUpperCase()}`).join(' · ')}</p></article>`,
      )
      .join('') || '<p class="muted">Your first family begins here.</p>'
  }</section>`;
}
