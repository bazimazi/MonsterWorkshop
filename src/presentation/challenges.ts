import type { Workshop } from '../application/workshop.js';
import { teamSynergies } from '../domain/challenges.js';
import { escape } from './html.js';
import type { Challenge } from '../domain/challenges.js';
export function challengesView(
  w: Workshop,
  squad: string[],
  modifier: Challenge['modifier'],
): string {
  const state = w.state,
    c = w.content;
  return `<div class="page-heading"><div><p class="eyebrow">DESIGNS UNDER PRESSURE</p><h1 tabindex="-1">Challenge arena</h1><p class="muted">Elemental reactions and team biology change the fight.</p></div><a class="secondary" href="#battle">Choose your squad</a></div><section class="panel"><label class="explorer-picker">Challenge modifier<select data-challenge-modifier="true" aria-label="Challenge modifier"><option value="none" ${modifier === 'none' ? 'selected' : ''}>Standard</option><option value="armored" ${modifier === 'armored' ? 'selected' : ''}>Armored enemies · +50% defense · +10 biomass</option><option value="volatile" ${modifier === 'volatile' ? 'selected' : ''}>Volatile · +30% power for both teams · +10 biomass</option></select></label><p class="micro">Uses the three creatures selected in Battle. Assigned creatures cannot join.</p><div class="dialog-actions"><button class="primary" data-action="start-tower" ${state.activeBattle ? 'disabled' : ''}>Enter tower floor ${state.towerFloor}</button>${c.catalog.advanced.bosses.map((b) => `<button class="secondary" data-action="start-boss" data-id="${b.id}" ${state.activeBattle || (b.requiresRegion && !w.completedRegions.includes(b.requiresRegion)) ? 'disabled' : ''}>Challenge ${escape(b.name)}</button>`).join('')}</div><p class="micro">Tower enemies grow stronger each floor. Victory advances your saved floor and rewards biomass/crystals. Defeat retains your floor and creatures.</p></section><div class="exploration-layout"><section class="panel"><h2>Boss field notes</h2>${c.catalog.advanced.bosses.map((b) => `<h3>${escape(b.name)}</h3><p class="muted">Below ${Math.round(b.phaseAt * 100)}% health, the boss gains a shield, regeneration and amplified power. Focus fire or use control to interrupt its recovery.</p><p class="tag">${state.bossVictories.includes(b.id) ? 'DEFEATED' : 'UNDEFEATED'}</p><p class="micro">Victory recovers ${escape(c.component(b.discovery).name)} and materials.${b.requiresRegion ? ` First explore ${escape(c.region(b.requiresRegion).name)}.` : ''}</p>`).join('')}</section><section class="panel"><h2>Elemental reactions</h2>${c.catalog.advanced.reactions.map((r) => `<p><strong>${escape(r.name)}</strong><br><span class="micro">${r.element} hits ${r.requires}: ×${r.multiplier} damage, then ${r.status}. Consumes the triggering status.</span></p>`).join('')}<h3>Team synergies</h3>${c.catalog.advanced.synergies
    .map(
      (s) =>
        `<p class="micro">${escape(s.name)}: ${s.minimum} creatures with ${s.tag} biology. ${Object.entries(
          s.stats,
        )
          .map(([k, n]) => `+${n} ${k}`)
          .join(', ')} for the team.</p>`,
    )
    .join('')}<p class="tag">SELECTED SQUAD: ${
    teamSynergies(
      w.creatures.filter((creature) => squad.includes(creature.id)),
      c,
    )
      .map((s) => escape(s.name))
      .join(' / ') || 'No matching synergy'
  }</p></section></div>`;
}
