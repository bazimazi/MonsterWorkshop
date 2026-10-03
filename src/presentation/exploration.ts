import type { Workshop } from '../application/workshop.js';
import type { PlayerState } from '../application/state.js';
import type { ContentIndex } from '../domain/catalog.js';
import { expeditionFitness, expeditionRequirements } from '../domain/exploration.js';
import { renderCreature } from './creature.js';
import { escape, title } from './html.js';

export function explorationView(
  state: PlayerState,
  workshop: Workshop,
  content: ContentIndex,
  regionId: string,
  creatureId: string | undefined,
): string {
  const region = content.region(regionId),
    creatures = workshop.creatures;
  const selected = creatures.find((c) => c.id === creatureId);
  const reasons = expeditionRequirements(region, selected, workshop.completedRegions, content);
  if (selected && workshop.isAssigned(selected.id))
    reasons.push('This creature is already assigned.');
  if (state.expeditions.length >= content.catalog.rules.exploration.maxAssignments)
    reasons.push('All expedition slots are occupied.');
  const fitness = selected ? expeditionFitness(selected, region, content) : 0;
  const duration = region.durationMs / 1000;
  return `<div class="page-heading"><div><p class="eyebrow">MORE THAN A FIGHTER</p><h1 tabindex="-1">Into the wild</h1><p class="muted">Build a specialist. Bring home a discovery.</p></div><span class="tag">${state.expeditions.length} / ${content.catalog.rules.exploration.maxAssignments} AWAY</span></div>
  <div class="exploration-layout"><section class="panel"><h2>Choose a region</h2><div class="region-list">${content.catalog.regions
    .map((r, i) => {
      const unlocked = r.prerequisites.every((id) => workshop.completedRegions.includes(id));
      return `<button class="region-card ${r.id === region.id ? 'selected' : ''}" data-action="region" data-region="${r.id}" aria-pressed="${r.id === region.id}"><span class="region-art region-${i}" aria-hidden="true">${['❧', '◇', '≋'][i] ?? '◈'}</span><span><strong>${escape(r.name)}</strong><small>${escape(r.activity)} · ${r.durationMs / 1000}s ${unlocked ? '' : '· Locked'}</small></span></button>`;
    })
    .join(
      '',
    )}</div><h3>${escape(region.name)}</h3><p class="muted">${escape(region.description)}</p><p class="micro">Specialists: ${region.affinityTags.map(title).join(' / ')}. Adaptation genes and speed also improve the haul.</p><div class="reward-items"><span class="tag mint">${region.biomass}–${region.biomass * 2} BIOMASS</span><span class="tag">${region.quantity}–${region.quantity * 2} ${escape(content.resources.get(region.resource)!.name)}</span><span class="tag gold">${state.discoveredComponents.includes(region.discovery) ? 'COMPONENT CHANCE' : 'FIRST VISIT: NEW COMPONENT'}</span></div></section>
  <section class="panel assignment-panel"><h2>Choose your explorer</h2>${creatures.length ? `<label class="explorer-picker">Expedition creature<select data-explorer="true" aria-label="Expedition creature"><option value="">Choose a creature</option>${creatures.map((c) => `<option value="${escape(c.id)}" ${c.id === creatureId ? 'selected' : ''} ${workshop.isAssigned(c.id) ? 'disabled' : ''}>${escape(c.name)}${workshop.isAssigned(c.id) ? ' · Assigned' : ''}</option>`).join('')}</select></label>` : '<p class="muted">Create a creature to begin exploring.</p><a href="#workshop">Visit the workshop →</a>'}${selected ? `<div class="explorer-preview">${renderCreature(selected, content, false)}</div><div class="section-title"><strong>${Math.round(fitness * 100)}% expedition fitness</strong><span class="tag">${selected.genome.adaptation.value} ADAPTATION</span></div><p class="micro">Estimated haul: ${Math.floor(region.biomass * (1 + fitness * content.catalog.rules.exploration.yieldBonus))} biomass · ${Math.floor(region.quantity * (1 + fitness * content.catalog.rules.exploration.yieldBonus))} ${escape(content.resources.get(region.resource)!.name)}.</p>` : ''}<button class="primary" data-action="start-expedition" ${reasons.length ? 'disabled' : ''}>Send on expedition · ${duration}s</button>${reasons.map((r) => `<p class="micro requirement">${escape(r)}</p>`).join('')}<p class="micro">Progress continues while this game is open and visible, including offline. Closing or hiding it pauses the expedition.</p></section></div>
  <section class="panel expedition-queue"><div class="section-title"><h2>Field teams</h2><span class="tag">PROGRESS SAVED</span></div>${
    state.expeditions.length
      ? state.expeditions
          .map((job) => {
            const r = content.region(job.regionId),
              ready = job.elapsedMs >= r.durationMs;
            return `<article class="expedition-job" data-job="${job.id}"><div><strong>${escape(state.creatures.find((c) => c.id === job.source.id)!.name)}</strong><p class="micro">${escape(r.name)} · ${escape(r.activity)}</p></div><div class="expedition-progress"><progress max="${r.durationMs}" value="${job.elapsedMs}" aria-label="${escape(r.name)} progress"></progress><span data-remaining>${ready ? 'Ready to collect' : `${Math.ceil((r.durationMs - job.elapsedMs) / 1000)}s remaining`}</span></div><div class="job-actions"><button class="secondary" data-action="claim-expedition" data-id="${job.id}" ${ready ? '' : 'disabled'}>Collect expedition</button><button class="quiet" data-action="cancel-expedition" data-id="${job.id}">Recall creature</button></div></article>`;
          })
          .join('')
      : '<p class="muted">Your explorers are resting at home.</p>'
  }</section>
  <div class="exploration-layout"><section class="panel"><h2>Gathered resources</h2><div class="codex-list">${content.catalog.resources.map((r) => `<div><span>${escape(r.name)}</span><strong>${state.resources[r.id] ?? 0}</strong></div>`).join('')}</div><p class="micro">Keep these materials for biological research.</p></section><section class="panel"><h2>Field journal</h2>${
    state.expeditionReports.length
      ? [...state.expeditionReports]
          .reverse()
          .slice(0, 5)
          .map(
            (r) =>
              `<article class="field-report"><strong>${escape(content.region(r.regionId).name)} · ${escape(state.creatures.find((c) => c.id === r.creatureId)!.name)}</strong><p class="micro">${
                r.reward
                  ? `+${r.reward.biomass} biomass · ${Object.entries(r.reward.resources)
                      .map(([id, n]) => `+${n} ${escape(content.resources.get(id)!.name)}`)
                      .join(
                        ' · ',
                      )}${r.reward.discovery ? ` · Recovered ${escape(content.component(r.reward.discovery).name)}` : ''}`
                  : 'Recalled safely. No rewards collected.'
              }</p></article>`,
          )
          .join('')
      : '<p class="muted">Your first journey is waiting.</p>'
  }</section></div>`;
}
