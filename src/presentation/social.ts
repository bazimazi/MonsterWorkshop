import type { Workshop } from '../application/workshop.js';
import { deriveCreature } from '../domain/generator.js';
import { costRequirements, hasResearch, mutationConditions } from '../domain/research.js';
import { GENES } from '../domain/model.js';
import { escape, title } from './html.js';
import { renderCreature } from './creature.js';
export function socialView(w: Workshop, selectedId?: string): string {
  const s = w.state,
    c = w.content,
    selected = w.creatures.find((x) => x.id === selectedId) ?? w.creatures[0];
  return `<div class="page-heading"><div><p class="eyebrow">IDEAS TRAVEL</p><h1 tabindex="-1">Showcase & blueprints</h1><p class="muted">Share your creatures and collect engineering ideas.</p></div><a class="secondary" href="#market">Marketplace</a></div>
  <div class="exploration-layout"><section class="panel"><h2>Engineer profile</h2><form data-profile="true"><label class="explorer-picker">Engineer name<input name="name" maxlength="40" value="${escape(s.playerName)}" required></label><label class="explorer-picker">Biography<textarea aria-label="Biography" name="bio" maxlength="240" rows="3" required>${escape(s.biography)}</textarea></label><button class="secondary" type="submit">Save profile</button></form><p class="micro">${s.experiments.length} experiments / ${s.discoveredComponents.length} discoveries / ${s.births.length} births</p></section>
  <section class="panel"><h2>Share a specimen</h2><label class="explorer-picker">Specimen<select data-social-creature="true" aria-label="Specimen to share">${w.creatures.map((x) => `<option value="${escape(x.id)}" ${x.id === selected?.id ? 'selected' : ''}>${escape(x.name)}</option>`).join('')}</select></label>${selected ? `<div class="explorer-preview">${renderCreature(selected, c, false)}</div><div class="dialog-actions"><button class="secondary" data-action="share-creature" data-id="${escape(selected.id)}">Export creature</button><button class="secondary" data-action="save-blueprint" data-id="${escape(selected.id)}">Save blueprint</button><button class="primary" data-action="showcase-toggle" data-id="${escape(selected.id)}" aria-pressed="${s.showcase.includes(selected.id)}">${s.showcase.includes(selected.id) ? 'Remove from showcase' : 'Add to showcase'}</button></div>` : '<p class="muted">Your first invention is waiting to be built.</p>'}</section></div>
  <section class="panel"><div class="section-title"><h2>${escape(s.playerName)}'s showcase</h2><button class="secondary" data-action="share-showcase" ${s.showcase.length ? '' : 'disabled'}>Export showcase</button></div><p class="muted">${escape(s.biography)}</p><div class="creature-grid">${s.showcase
    .map((id) => {
      const x = w.creatures.find((x) => x.id === id)!;
      return `<article class="creature-card">${renderCreature(x, c, false)}<h3>${escape(x.name)}</h3><p class="tag">${title(x.quality)} / ${title(x.element)}</p></article>`;
    })
    .join(
      '',
    )}</div><p class="micro">Choose up to three favorites. Export a file to share manually with another player.</p></section>
  <section class="panel"><h2>Blueprint library</h2><p class="muted">Recipes use your discovered parts, stock and biomass. Each manufacture has a fresh seed and its own genetics.</p>${
    s.blueprints.length
      ? s.blueprints
          .map((b) => {
            const locked = b.componentIds.filter((id) => !s.discoveredComponents.includes(id));
            const missing = b.componentIds.filter((id) => (s.inventory[id] ?? 0) < 1);
            const guided = b.controlledMutation;
            const reasons = [
              ...locked.map((id) => `Discover ${c.component(id).name}.`),
              ...missing
                .filter((id) => !locked.includes(id))
                .map((id) => `Restock ${c.component(id).name}.`),
            ];
            if (
              guided &&
              (!hasResearch(s.completedResearch, 'mutation-control', c) ||
                !s.discoveredMutations.includes(guided))
            )
              reasons.push('Research and discover this guided mutation.');
            if (guided)
              reasons.push(
                ...mutationConditions(b.componentIds, guided, c, new Date().toISOString()),
                ...costRequirements(
                  c.catalog.rules.research.controlledMutationCost,
                  s.biomass - w.cost(b.componentIds),
                  s.resources,
                  c,
                ),
              );
            if (s.biomass < w.cost(b.componentIds)) reasons.push('Needs manufacturing biomass.');
            if (w.creatures.length >= c.catalog.rules.workshop.maxCreatures)
              reasons.push('Habitat is full.');
            return `<article class="field-report"><h3>${escape(b.name)}</h3><p class="micro">By ${escape(b.author)}</p><p class="recipe">${b.componentIds.map((id) => escape(c.component(id).name)).join(' + ')}${guided ? ` / Guided ${escape(c.mutations.get(guided)!.name)}` : ''}</p>${reasons.map((r) => `<p class="micro requirement">${escape(r)}</p>`).join('')}<div class="dialog-actions"><button class="primary" data-action="make-blueprint" data-id="${b.id}" ${reasons.length ? 'disabled' : ''}>Manufacture blueprint</button><button class="secondary" data-action="share-blueprint" data-id="${b.id}">Export blueprint</button><button class="secondary" data-action="copy-blueprint" data-id="${b.id}">Copy genetic blueprint</button><button class="quiet" data-action="remove-blueprint" data-id="${b.id}">Remove blueprint</button></div></article>`;
          })
          .join('')
      : '<p class="micro">Save a creature recipe or import one from a friend.</p>'
  }</section>
  <section class="panel"><h2>Visiting gallery</h2><label class="file-button secondary">Import shared design<input type="file" data-share-import="true" accept="application/json,.json" aria-label="Import shared design"></label><details data-detail="share-paste"><summary>Paste a shared design</summary><form data-share-paste="true"><label class="explorer-picker">Shared JSON<textarea name="design" rows="5" required maxlength="200000"></textarea></label><button class="secondary" type="submit">Import pasted design</button></form></details><p class="micro">Accepts creature, blueprint and showcase files. Visiting specimens can be inspected; recreating a design uses your own materials.</p><div class="creature-grid visiting-gallery">${s.gallery
    .map((g) => {
      const x = deriveCreature(g.source, c);
      return `<article class="panel creature-card"><p class="eyebrow">VISITING SPECIMEN</p>${renderCreature(x, c, false)}<h3>${escape(x.name)}</h3><p class="micro">${escape(g.profile.name)} / ${escape(g.profile.bio)}</p><details data-detail="${escape(g.id)}"><summary>Inspect genome & recipe</summary><p class="micro">${x.componentIds.map((id) => escape(c.component(id).name)).join(' + ')}</p><dl class="stats">${GENES.map((gene) => `<div><dt>${title(gene)}</dt><dd>${x.genome[gene].value}<span class="micro">${title(x.genome[gene].dominance)}</span></dd></div>`).join('')}</dl><p class="micro">Traits: ${x.traitIds.map((id) => escape(c.traits.get(id)!.name)).join(', ') || 'None'}</p><p class="micro">Abilities: ${x.abilityIds.map((id) => escape(c.ability(id).name)).join(', ')}</p></details><button class="secondary" data-action="visitor-blueprint" data-id="${g.id}">Save visitor recipe</button><button class="quiet" data-action="remove-gallery" data-id="${g.id}">Remove visitor</button></article>`;
    })
    .join('')}</div></section>`;
}
