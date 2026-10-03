import type { Workshop } from '../application/workshop.js';
import { currentEvent, eventProgress, eventWindow } from '../domain/events.js';
import { escape } from './html.js';
export function eventsView(w: Workshop, at: string): string {
  const s = w.state,
    c = w.content,
    window = currentEvent(at, c);
  if (!window)
    return '<section class="panel"><h1 tabindex="-1">Event calendar</h1><p>The calendar starts on September 28, 2026 UTC.</p></section>';
  const event = c.catalog.live.events.find((e) => e.id === window.templateId)!;
  const enrolled = s.eventRun?.window.key === window.key;
  const claimed = s.eventClaims.some((claim) => claim.run.window.key === window.key);
  const count = enrolled ? eventProgress(s.eventRun!, s, c) : 0;
  const objective =
    event.objective.type === 'manufacture'
      ? `Manufacture ${event.objective.count} creatures with ${event.objective.tags.join(' + ')} biology.`
      : `Collect ${event.objective.count} new expeditions in ${c.region(event.objective.regionId).name}.`;
  const mutation = c.mutations.get(event.mutation)!;
  return `<div class="page-heading"><div><p class="eyebrow">A NEW QUESTION EVERY WEEK</p><h1 tabindex="-1">Event calendar</h1><p class="muted">Seasonal experiments rotate every ${c.catalog.live.periodDays} days in UTC.</p></div><a class="secondary" href="#market">Marketplace</a></div><section class="panel"><p class="eyebrow">CURRENT EXPERIMENT / ${claimed ? 'COMPLETED' : enrolled ? 'ENROLLED' : 'OPEN'}</p><h2>${escape(event.name)}</h2><p class="muted">${escape(event.description)}</p><p class="micro">${escape(window.startsAt.slice(0, 10))} — ${escape(window.endsAt.slice(0, 10))} UTC (end exclusive)</p><p>${escape(objective)}</p><p class="micro">Only work started after enrollment counts. Breeding and visiting specimens do not count as manufactured experiments.</p><progress value="${claimed ? event.objective.count : Math.min(count, event.objective.count)}" max="${event.objective.count}" aria-label="Seasonal experiment progress"></progress><p class="tag">${claimed ? event.objective.count : Math.min(count, event.objective.count)} / ${event.objective.count} COMPLETE</p><h3>Seasonal reward</h3><p>${escape(c.component(event.component).name)} ×${event.quantity} / ${event.biomass} biomass / ${Object.entries(
    event.resources,
  )
    .map(([id, n]) => `${n} ${escape(c.resources.get(id)!.name)}`)
    .join(
      ' / ',
    )}</p><div class="dialog-actions"><button class="primary" data-action="event-join" ${claimed || enrolled ? 'disabled' : ''}>Enroll in experiment</button><button class="primary" data-action="event-claim" ${!enrolled || count < event.objective.count ? 'disabled' : ''}>Collect seasonal reward</button><a class="secondary" href="${event.objective.type === 'manufacture' ? '#workshop' : '#explore'}">${event.objective.type === 'manufacture' ? 'Build event biology' : 'Explore event region'}</a></div>${s.eventRun && !enrolled ? '<p class="micro">Your previous enrollment has expired. Enroll to begin the current experiment.</p>' : ''}</section>
  <div class="exploration-layout"><section class="panel"><h2>Limited mutation</h2><h3>${escape(mutation.name)}</h3><p class="muted">${escape(mutation.description)}</p><p class="micro">Requires ${escape(mutation.requiredTags.join(' + '))}. Manufacturing and guided creation are available during this event. Existing specimens keep their mutation; descendants can inherit it.</p><h3>Featured boss</h3><p>${escape(c.catalog.advanced.bosses.find((b) => b.id === event.boss)!.name)}</p><a class="secondary" href="#challenges">Visit challenge arena</a></section><section class="panel"><h2>Upcoming experiments</h2>${[
    1, 2, 3,
  ]
    .map((offset) => {
      const next = eventWindow(window.period + offset, c),
        template = c.catalog.live.events.find((e) => e.id === next.templateId)!;
      return `<article class="field-report"><h3>${escape(template.name)}</h3><p class="micro">${next.startsAt.slice(0, 10)} UTC / ${escape(c.component(template.component).name)}</p></article>`;
    })
    .join(
      '',
    )}<p class="micro">Calendar availability uses your device date. Rewards require completed gameplay and one claim per event period. Expeditions still advance only while the game is open and visible.</p></section></div><section class="panel"><h2>Seasonal discoveries</h2>${c.catalog.live.events.map((e) => `<p class="tag">${escape(c.component(e.component).name)} / ${s.discoveredComponents.includes(e.component) ? 'DISCOVERED' : 'UNEXPLORED'}</p>`).join('')}<p class="micro">Seasonal market/crafting supplies return with their experiment. Keep unspent samples between events.</p></section>`;
}
