import type { ContentIndex } from '../domain/catalog.js';
import type { Cost } from '../domain/model.js';
import type { PlayerState } from '../application/state.js';
import type { Workshop } from '../application/workshop.js';
import {
  componentAnalysis,
  costRequirements,
  hasResearch,
  researchRequirements,
  scannerLevel,
} from '../domain/research.js';
import { escape, title } from './html.js';

export function describeCost(cost: Cost, content: ContentIndex): string {
  return [
    `${cost.biomass} biomass`,
    ...Object.entries(cost.resources).map(([id, n]) => `${n} ${content.resources.get(id)!.name}`),
  ].join(' · ');
}
export function researchView(
  state: PlayerState,
  workshop: Workshop,
  content: ContentIndex,
  selectedId: string,
): string {
  const level = scannerLevel(state.completedResearch, content);
  const selected = content.component(selectedId);
  const scan = state.scans.find((s) => s.componentId === selectedId);
  const analysis = componentAnalysis(selectedId, scan?.level ?? 0, content);
  const scanCost =
    level === 2
      ? content.catalog.rules.research.advancedScanCost
      : content.catalog.rules.research.basicScanCost;
  const reasons = !level
    ? ['Research Basic Biological Scanner first.']
    : scan && scan.level >= level
      ? ['Analysis is complete for your current scanner.']
      : costRequirements(scanCost, state.biomass, state.resources, content);
  const mutationAnalysis = hasResearch(state.completedResearch, 'mutation-analysis', content);
  return `<div class="page-heading"><div><p class="eyebrow">TURN CURIOSITY INTO KNOWLEDGE</p><h1 tabindex="-1">The research laboratory</h1><p class="muted">Field notes, living samples, and one more experiment.</p></div><button class="secondary" data-action="open-scanner">Component scanner ↓</button></div><div class="research-stock">${content.catalog.resources.map((r) => `<span class="tag">${state.resources[r.id] ?? 0} ${escape(r.name)}</span>`).join('')}<span class="tag mint">${state.completedResearch.length} / ${content.research.size} RESEARCHED</span></div>
  <div class="research-layout"><section><h2>Research tree</h2><div class="research-grid">${content.catalog.research
    .map((node) => {
      const done = state.completedResearch.includes(node.id),
        requirements = researchRequirements(node, workshop.researchProgress, content);
      const unlock = node.unlock;
      const reward =
        unlock.type === 'component'
          ? `${unlock.quantity} samples + ${content.component(unlock.id).name} blueprint`
          : unlock.type === 'scanner'
            ? `Scanner level ${unlock.level}`
            : unlock.type === 'mutation-analysis'
              ? 'Mutation conditions + precise forecasts'
              : 'Target an observed mutation';
      return `<article class="panel research-node ${done ? 'completed' : requirements.length ? 'unavailable' : 'available'}" data-research="${node.id}"><p class="eyebrow">${escape(node.branch)} ${done ? ' / COMPLETE' : ''}</p><h3>${escape(node.name)}</h3>${node.prerequisites.length ? `<p class="micro">After ${node.prerequisites.map((id) => escape(content.research.get(id)!.name)).join(' + ')}</p>` : ''}<p class="muted">${escape(node.description)}</p><p class="research-unlock">✦ ${escape(reward)}</p><p class="micro">${escape(describeCost(node.cost, content))}</p><button class="${done ? 'secondary' : 'primary'}" data-action="research" data-id="${node.id}" ${done || requirements.length ? 'disabled' : ''}>${done ? 'Researched' : 'Research ' + escape(node.name)}</button>${!done && requirements.length ? `<ul class="research-requirements">${requirements.map((r) => `<li>${escape(r)}</li>`).join('')}</ul>` : ''}</article>`;
    })
    .join('')}</div></section>
  <section class="research-sidebar"><section class="panel component-scanner" id="component-scanner"><div class="section-title"><h2 tabindex="-1">Component scanner</h2><span class="tag">LEVEL ${level}</span></div><label class="explorer-picker">Recovered sample<select aria-label="Scanner component" data-scanner-component="true">${content.catalog.components
    .filter((p) => state.discoveredComponents.includes(p.id))
    .map(
      (p) =>
        `<option value="${p.id}" ${p.id === selectedId ? 'selected' : ''}>${escape(p.name)}</option>`,
    )
    .join(
      '',
    )}</select></label><div class="scanner-orb" aria-hidden="true">${{ head: '♜', body: '◆', legs: '╳', organ: 'ϟ', armor: '⬡', wings: '⋈' }[selected.slot]}</div><h3>${escape(analysis.name)}</h3><p class="tag">${title(analysis.element)}</p><div class="scan-results">${scan ? `<h4>Biology tags</h4><p>${analysis.tags.map(title).join(' / ')}</p>` : '<p class="muted">An unexamined sample. Start a scan to identify its biology.</p>'}${
    analysis.hidden
      ? `<p class="hidden-properties">${analysis.hidden} hidden properties</p><p class="micro">${scan ? 'Gene biases, affinities, traits and mutation potential need a Resonance Scanner.' : 'Biology tags and four deeper properties await analysis.'}</p>`
      : `<h4>Gene biases</h4><div class="codex-list">${
          Object.entries(analysis.genes ?? {})
            .map(
              ([id, value]) =>
                `<div><span>${title(id)}</span><strong>${value >= 0 ? '+' : ''}${value}</strong></div>`,
            )
            .join('') || '<p class="micro">No innate gene biases.</p>'
        }</div><h4>Affinities & conflicts</h4><p>Affinity: ${analysis.compatibleTags?.map(title).join(' / ') || 'None'}<br>Conflict: ${analysis.conflictTags?.map(title).join(' / ') || 'None'}</p><h4>Inherited traits</h4>${analysis.traits?.map((t) => `<p><strong>${escape(t.name)}</strong><br><span class="micro">${escape(t.description)}</span></p>`).join('') || '<p class="micro">None</p>'}<h4>Mutation potential</h4><p>${Math.round((analysis.mutationChance ?? 0) * 100)}% biological contribution</p><p class="micro">This contributes to the recipe forecast. Compatibility and mutation rules also affect the final chance.</p>`
  }</div><button class="primary" data-action="scan" data-id="${selectedId}" ${reasons.length ? 'disabled' : ''}>${level === 2 && scan?.level === 1 ? 'Upgrade analysis' : 'Scan component'}</button><p class="micro">${escape(describeCost(scanCost, content))}. The component is retained.</p>${reasons.map((r) => `<p class="micro">${escape(r)}</p>`).join('')}</section>
  <section class="panel"><h2>Biological blueprints</h2>${
    state.completedResearch.some((id) => content.research.get(id)!.unlock.type === 'component')
      ? content.catalog.research
          .filter((n) => n.unlock.type === 'component' && state.completedResearch.includes(n.id))
          .map((n) => {
            if (n.unlock.type !== 'component') return '';
            const blocked = costRequirements(
              n.unlock.synthesisCost,
              state.biomass,
              state.resources,
              content,
            );
            return `<article class="blueprint"><h3>${escape(content.component(n.unlock.id).name)}</h3><p class="micro">${state.inventory[n.unlock.id] ?? 0} in storage · ${escape(describeCost(n.unlock.synthesisCost, content))}</p><button class="secondary" data-action="cultivate" data-id="${n.unlock.id}" ${blocked.length ? 'disabled' : ''}>Cultivate ${escape(content.component(n.unlock.id).name)}</button>${blocked.map((r) => `<p class="micro">${escape(r)}</p>`).join('')}</article>`;
          })
          .join('')
      : '<p class="muted">Anatomy research turns discoveries into reusable, cultivable samples.</p>'
  }</section>
  <section class="panel"><h2>Mutation studies</h2>${
    state.discoveredMutations.length
      ? state.discoveredMutations
          .map((id) => {
            const m = content.mutations.get(id)!;
            return `<article class="discovery"><h3>${escape(m.name)}</h3><p class="muted">${escape(m.description)}</p>${mutationAnalysis ? `<p class="micro">Requires: ${m.requiredTags.map(title).join(' / ') || 'Any biology'}. Excludes: ${m.excludedTags.map(title).join(' / ') || 'None'}.</p><p class="micro">Base rule chance: ${Math.round(m.chance * 100)}%. Component mutation contributions and instability modify it.</p>` : '<p class="micro">Biological conditions are unresolved. Complete Mutation Atlas to study them.</p>'}</article>`;
          })
          .join('')
      : '<p class="muted">No mutations observed yet. Try energetic anatomy in repeated experiments.</p>'
  }</section></section></div>`;
}
