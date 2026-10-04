import type { ContentIndex } from '../domain/catalog.js';
import type { Creature } from '../domain/model.js';
import { GENES, STAT_KEYS } from '../domain/model.js';
import { generateCreature } from '../domain/generator.js';
import type { Workshop } from '../application/workshop.js';
import type { PlayerState } from '../application/state.js';
import { Feedback, logger } from '../platform/services.js';
import { Navigation } from '../platform/navigation.js';
import type { Screen } from '../platform/navigation.js';
import { renderCreature } from './creature.js';
import { escape, title } from './html.js';
import { availableAbilities, canUse, currentActor } from '../domain/combat.js';
import type { Battle, Combatant } from '../domain/combat.js';
import { deriveCreature } from '../domain/generator.js';
import { eventsView } from './events.js';
import { socialView } from './social.js';
import { marketView } from './market.js';
import { challengesView } from './challenges.js';
import type { Challenge } from '../domain/challenges.js';
import { breedingView } from './breeding.js';
import { explorationView } from './exploration.js';
import { describeCost, researchView } from './research.js';
import { costRequirements, hasResearch, mutationConditions } from '../domain/research.js';
import { currentEvent } from '../domain/events.js';
import { captureFocus, containTabFocus, restoreFocus } from './focus.js';
import type { FocusBookmark } from './focus.js';
import type { BattleReward } from '../application/workshop.js';
import {
  MAX_SAVE_BYTES,
  SAVE_KEY,
  SAVE_SIZE_ERROR,
  SaveConflictError,
  SaveError,
} from '../platform/save.js';
import { MAX_SHARE_BYTES } from '../domain/sharing.js';
import { showSaveChanged } from './recovery.js';
export function downloadSave(raw: string, filename = 'monster-workshop-save.json'): void {
  const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' })),
    link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
const sequenceSteps = [
  'Inserting components',
  'Scanning biological signatures',
  'Assembling the genome',
  'Checking for mutations',
  'Opening the chamber',
];
const statNames = {
  hp: 'Health',
  attack: 'Attack',
  defense: 'Armor',
  speed: 'Speed',
  power: 'Power',
  energy: 'Energy',
};
export class GameUI {
  private nav: Navigation;
  private selected = new Set<string>();
  private inspectedId: string | undefined;
  private filter = 'all';
  private notice = '';
  private isError = false;
  private sequence: { id: string; step: number } | undefined;
  private revealId: string | undefined;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private feedback = new Feedback();
  private squad = new Set<string>();
  private squadInitialized = false;
  private selectedAbility = 'strike';
  private selectedTarget: string | undefined;
  private lastActor: string | undefined;
  private reward: BattleReward | undefined;
  private regionId = 'green-meadow';
  private explorerId: string | undefined;
  private lastTick = performance.now();
  private clockFailed = false;
  private saveChanged = false;
  private sessionEnded = false;
  private calendarKey: string | null = null;
  private renderedScreen: Screen | undefined;
  private dialogReturnFocus: FocusBookmark | undefined;
  private socialCreature: string | undefined;
  private marketOffer: string | undefined;
  private marketRecipe: string | undefined;
  private marketCreature: string | undefined;
  private challengeModifier: Challenge['modifier'] = 'none';
  private parents: [string | undefined, string | undefined] = [undefined, undefined];
  private scannerId = 'dragon-head';
  private controlledMutation: string | undefined;
  constructor(
    private root: HTMLElement,
    private workshop: Workshop,
    private content: ContentIndex,
  ) {
    for (const part of content.components.values())
      if (part.discovery === 'starter' && (part.slot === 'head' || part.slot === 'body'))
        this.selected.add(part.id);
    this.nav = new Navigation(() => {
      this.render();
      this.root.querySelector<HTMLElement>('h1')?.focus();
    });
    root.addEventListener('click', (event) => {
      const button = (event.target as HTMLElement).closest<HTMLElement>('[data-action]');
      if (button) {
        if (button instanceof HTMLAnchorElement) event.preventDefault();
        void this.act(button.dataset.action!, button).catch((error) => this.fail(error));
      }
    });
    root.addEventListener('submit', (event) => {
      if (this.saveChanged || this.sessionEnded) {
        event.preventDefault();
        return;
      }
      const form = event.target as HTMLFormElement;
      if (form.dataset.sharePaste) {
        event.preventDefault();
        try {
          this.workshop.importShare(new FormData(form).get('design') as string);
          this.notify('Shared design imported.');
          this.render();
        } catch (error) {
          this.fail(error);
        }
      }
      if (form.dataset.profile) {
        event.preventDefault();
        try {
          const values = new FormData(form);
          this.workshop.updateProfile(values.get('name') as string, values.get('bio') as string);
          this.notify('Profile saved.');
          this.render();
        } catch (error) {
          this.fail(error);
        }
      }
      if (form.dataset.rename) {
        event.preventDefault();
        try {
          this.workshop.rename(form.dataset.rename, new FormData(form).get('name') as string);
          this.notify('Name saved.');
          this.render();
        } catch (error) {
          this.fail(error);
        }
      }
    });
    root.addEventListener(
      'change',
      (event) =>
        void this.change(event.target as HTMLInputElement).catch((error) => this.fail(error)),
    );
    document.addEventListener('visibilitychange', () => {
      this.lastTick = performance.now();
      if (!document.hidden) this.refreshCalendar();
    });
    const interval = setInterval(() => this.tick(), 1000);
    window.addEventListener(
      'pagehide',
      () => {
        this.sessionEnded = true;
        clearInterval(interval);
        if (this.timer) clearTimeout(this.timer);
      },
      { once: true },
    );
    window.addEventListener('storage', (event) => {
      if (event.storageArea === localStorage && (event.key === SAVE_KEY || event.key === null)) {
        this.saveChanged = true;
        if (this.timer) clearTimeout(this.timer);
        this.render();
      }
    });
    this.render();
  }
  private tick(): void {
    const now = performance.now(),
      elapsed = Math.max(0, Math.min(1000, Math.floor(now - this.lastTick)));
    this.lastTick = now;
    if (document.hidden || this.saveChanged || this.sessionEnded) return;
    this.refreshCalendar();
    if (this.clockFailed) return;
    try {
      this.workshop.advanceExpeditions(elapsed);
      const current = this.workshop.state;
      for (const node of this.root.querySelectorAll<HTMLElement>('[data-resting]'))
        node.textContent = `${Math.ceil((current.breedingCooldowns[node.dataset.resting!] ?? 0) / 1000)}s resting`;
      const breedButton = this.root.querySelector<HTMLButtonElement>('[data-action="breed"]');
      if (
        breedButton &&
        this.parents.every(
          (id) => id && !this.workshop.isAssigned(id) && !(current.breedingCooldowns[id] ?? 0),
        )
      ) {
        const rules = this.content.catalog.rules.breeding;
        breedButton.disabled =
          this.parents[0] === this.parents[1] ||
          current.biomass < rules.cost.biomass ||
          Object.entries(rules.cost.resources).some(
            ([id, n]) => (current.resources[id] ?? 0) < n,
          ) ||
          this.workshop.creatures.length >= this.content.catalog.rules.workshop.maxCreatures;
      }
      for (const job of current.expeditions) {
        const card = this.root.querySelector<HTMLElement>(`[data-job="${job.id}"]`);
        if (!card) continue;
        const duration = this.content.region(job.regionId).durationMs,
          ready = job.elapsedMs >= duration;
        const progress = card.querySelector<HTMLProgressElement>('progress');
        if (progress) progress.value = job.elapsedMs;
        const remaining = card.querySelector('[data-remaining]');
        if (remaining)
          remaining.textContent = ready
            ? 'Ready to collect'
            : `${Math.ceil((duration - job.elapsedMs) / 1000)}s remaining`;
        const claim = card.querySelector<HTMLButtonElement>('[data-action="claim-expedition"]');
        if (claim) claim.disabled = !ready;
      }
    } catch (error) {
      this.clockFailed = true;
      this.fail(error);
    }
  }
  private animated(): boolean {
    return (
      !this.workshop.state.options.reducedMotion &&
      !matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }
  private refreshCalendar(): void {
    const key = currentEvent(new Date().toISOString(), this.content)?.key ?? null;
    if (
      (this.nav.current === 'events' ||
        this.nav.current === 'market' ||
        this.nav.current === 'workshop') &&
      key !== this.calendarKey
    )
      this.render();
  }
  private resetSession(): void {
    if (this.timer) clearTimeout(this.timer);
    const state = this.workshop.state;
    this.selected = new Set(
      this.content.catalog.rules.generation.requiredSlots.flatMap((slot) => {
        const part = this.content.catalog.components.find(
          (p) =>
            p.slot === slot &&
            state.discoveredComponents.includes(p.id) &&
            (state.inventory[p.id] ?? 0) > 0,
        );
        return part ? [part.id] : [];
      }),
    );
    this.sequence = undefined;
    this.revealId = undefined;
    this.timer = undefined;
    this.dialogReturnFocus = undefined;
    this.inspectedId = undefined;
    this.filter = 'all';
    this.explorerId = undefined;
    this.regionId = 'green-meadow';
    this.scannerId = 'dragon-head';
    this.controlledMutation = undefined;
    this.parents = [undefined, undefined];
    this.socialCreature = undefined;
    this.marketOffer = undefined;
    this.marketRecipe = undefined;
    this.marketCreature = undefined;
    this.challengeModifier = 'none';
    this.squad.clear();
    this.squadInitialized = false;
    this.reward = undefined;
    this.selectedAbility = 'strike';
    this.selectedTarget = undefined;
    this.lastActor = undefined;
    this.clockFailed = false;
    this.lastTick = performance.now();
  }
  private prepareSquad(): void {
    const available = this.workshop.creatures.filter((c) => !this.workshop.isAssigned(c.id));
    for (const id of this.squad) if (!available.some((c) => c.id === id)) this.squad.delete(id);
    if (!this.squadInitialized && available.length >= 3) {
      this.squad = new Set(available.slice(0, 3).map((c) => c.id));
      this.squadInitialized = true;
    }
  }
  private notify(message: string, isError = false): void {
    this.notice = message;
    this.isError = isError;
  }
  private fail(error: unknown): void {
    logger.error(error);
    if (error instanceof SaveConflictError) {
      this.saveChanged = true;
      if (this.timer) clearTimeout(this.timer);
    }
    this.notify(error instanceof Error ? error.message : 'Something went wrong', true);
    this.render();
  }
  private applyOptions(state: PlayerState): void {
    document.documentElement.style.fontSize = `${16 * state.options.textScale}px`;
    document.body.classList.toggle('reduced-motion', state.options.reducedMotion);
    this.feedback.enabled = state.options.sound;
    this.feedback.haptics = state.options.haptics;
  }
  private render(focusPart?: string): void {
    if (this.sessionEnded) return;
    if (this.saveChanged) {
      showSaveChanged(this.root);
      return;
    }
    const focus = captureFocus(this.root),
      previousDialog = this.root.querySelector('dialog'),
      sameScreen = this.renderedScreen === this.nav.current,
      disclosures = new Map(
        Array.from(this.root.querySelectorAll<HTMLDetailsElement>('details[data-detail]')).map(
          (details) => [details.dataset.detail!, details.open] as const,
        ),
      );
    const state = this.workshop.state;
    this.applyOptions(state);
    if (!hasResearch(state.completedResearch, 'mutation-control', this.content))
      this.controlledMutation = undefined;
    const screen = this.nav.current;
    this.renderedScreen = screen;
    this.calendarKey = currentEvent(new Date().toISOString(), this.content)?.key ?? null;
    if (!state.activeBattle && (screen === 'battle' || screen === 'challenges'))
      this.prepareSquad();
    const ownedIds = new Set(this.workshop.creatures.map((c) => c.id));
    for (const index of [0, 1] as const) {
      const id = this.parents[index];
      if (id && !ownedIds.has(id)) this.parents[index] = undefined;
    }
    const body =
      screen === 'events'
        ? eventsView(this.workshop, new Date().toISOString())
        : screen === 'social'
          ? socialView(this.workshop, this.socialCreature)
          : screen === 'market'
            ? marketView(this.workshop, this.marketOffer, this.marketRecipe, this.marketCreature)
            : screen === 'challenges'
              ? challengesView(this.workshop, [...this.squad], this.challengeModifier)
              : screen === 'breeding'
                ? breedingView(this.workshop, ...this.parents)
                : screen === 'research'
                  ? researchView(
                      state,
                      this.workshop,
                      this.content,
                      state.discoveredComponents.includes(this.scannerId)
                        ? this.scannerId
                        : state.discoveredComponents[0]!,
                    )
                  : screen === 'explore'
                    ? explorationView(
                        state,
                        this.workshop,
                        this.content,
                        this.regionId,
                        this.explorerId,
                      )
                    : screen === 'creatures'
                      ? this.creaturesView(state)
                      : screen === 'battle'
                        ? this.battleView(state)
                        : screen === 'journal'
                          ? this.journalView(state)
                          : screen === 'settings'
                            ? this.settingsView(state)
                            : this.workshopView(state);
    const tabs: [Screen, string, string][] = [
      ['workshop', 'Workshop', '⚗'],
      ['creatures', 'Creatures', '◈'],
      ['battle', 'Battle', '⚔'],
      ['research', 'Research', '⌕'],
      ['explore', 'Explore', '❧'],
    ];
    this.root.innerHTML = `<a class="skip-link" href="#main-content" data-action="skip-content">Skip to content</a><header class="topbar"><a class="brand" href="#workshop"><img src="./icon.svg" alt="" width="36" height="36"><span>MONSTER<span class="brand-light">WORKSHOP</span></span></a><div class="resource"><span class="resource-dot" aria-hidden="true"></span><strong>${state.biomass}</strong><span>biomass</span></div><div class="utility-links"><a class="utility-link" href="#market" aria-label="Marketplace">&#9878;</a><a class="utility-link" href="#journal" aria-label="Journal">&#8801;</a><a class="utility-link" href="#settings" aria-label="Settings">&#9881;</a></div></header><nav class="navigation" aria-label="Main navigation">${tabs.map(([key, label, symbol]) => `<a href="#${key}" ${screen === key ? 'aria-current="page"' : ''}><span aria-hidden="true">${symbol}</span>${label}${key === 'creatures' ? `<small aria-hidden="true">${this.workshop.creatures.length}</small>` : ''}</a>`).join('')}</nav><main class="shell game-shell" id="main-content">${this.notice ? `<div class="notice ${this.isError ? 'error' : ''}" role="${this.isError ? 'alert' : 'status'}">${escape(this.notice)}<button class="quiet" data-action="dismiss" aria-label="Dismiss message">×</button></div>` : ''}${this.clockFailed ? '<section class="notice clock-recovery" role="status"><p>Expeditions and parent recovery are paused until this browser can save.</p><button class="secondary" data-action="retry-clock">Resume active timers</button></section>' : ''}${body}</main><footer class="footer">A little science. A little strange. <span>Saved on this device</span></footer>${this.modal()}`;
    const dialog = this.root.querySelector<HTMLDialogElement>('dialog');
    if (sameScreen)
      for (const details of this.root.querySelectorAll<HTMLDetailsElement>(
        'details[data-detail]',
      )) {
        const open = disclosures.get(details.dataset.detail!);
        if (open !== undefined) details.open = open;
      }
    if (dialog) {
      if (!previousDialog) this.dialogReturnFocus = focus;
      dialog.showModal();
      dialog.addEventListener('keydown', (event) => containTabFocus(dialog, event));
      dialog.addEventListener('cancel', (event) => {
        event.preventDefault();
        this.closeReveal();
      });
      restoreFocus(this.root, focus, dialog);
    } else if (sameScreen) {
      const returning = previousDialog ? this.dialogReturnFocus : focus;
      if (!restoreFocus(this.root, returning) && (returning || previousDialog))
        this.root.querySelector<HTMLElement>('main h1')?.focus();
      if (previousDialog) this.dialogReturnFocus = undefined;
    }
    if (focusPart)
      Array.from(this.root.querySelectorAll<HTMLButtonElement>('[data-part]'))
        .find((b) => b.dataset.part === focusPart)
        ?.focus();
  }
  private preview(): Creature | undefined {
    try {
      return generateCreature([...this.selected], this.content, {
        seed: 0,
        createdAt: new Date().toISOString(),
        creator: 'Preview',
        skipMutations: true,
        ...(this.controlledMutation &&
        !mutationConditions(
          [...this.selected],
          this.controlledMutation,
          this.content,
          new Date().toISOString(),
        ).length
          ? { forceMutation: this.controlledMutation }
          : {}),
      });
    } catch {
      return undefined;
    }
  }
  private stats(creature: Creature): string {
    return `<dl class="stats">${STAT_KEYS.map((k) => `<div><dt>${statNames[k]}</dt><dd>${creature.stats[k]}</dd></div>`).join('')}</dl>`;
  }
  private workshopView(state: PlayerState): string {
    const creature = this.preview(),
      cost = creature
        ? this.workshop.cost([...this.selected]) +
          (this.controlledMutation
            ? this.content.catalog.rules.research.controlledMutationCost.biomass
            : 0)
        : 0;
    const controlAvailable = hasResearch(state.completedResearch, 'mutation-control', this.content);
    const controlReasons = this.controlledMutation
      ? [
          ...mutationConditions(
            [...this.selected],
            this.controlledMutation,
            this.content,
            new Date().toISOString(),
          ),
          ...costRequirements(
            this.content.catalog.rules.research.controlledMutationCost,
            state.biomass,
            state.resources,
            this.content,
          ),
        ]
      : [];
    const mutationForecast = this.controlledMutation
      ? 'Controlled: guaranteed'
      : !creature
        ? 'Unresolved'
        : hasResearch(state.completedResearch, 'mutation-analysis', this.content)
          ? Math.round(creature.compatibility.mutationChance * 100) + '%'
          : creature.compatibility.mutationChance === 0
            ? 'None detected'
            : creature.compatibility.mutationChance < 0.25
              ? 'Low'
              : creature.compatibility.mutationChance < 0.5
                ? 'Moderate'
                : 'High';
    const enough =
      creature &&
      cost <= state.biomass &&
      !controlReasons.length &&
      [...this.selected].every((id) => (state.inventory[id] ?? 0) > 0) &&
      this.workshop.creatures.length < this.content.catalog.rules.workshop.maxCreatures;
    const blockedReason = controlReasons.length
      ? controlReasons.join(' ')
      : !creature
        ? 'Choose a head and body to complete the anatomy.'
        : this.workshop.creatures.length >= this.content.catalog.rules.workshop.maxCreatures
          ? `Your habitat is full (${this.content.catalog.rules.workshop.maxCreatures} specimens). Export your discoveries in Settings.`
          : cost > state.biomass
            ? 'Not enough biomass. Win a simulator battle to replenish it.'
            : 'A selected part is out of stock. Win a simulator battle to replenish it.';
    const guidance =
      this.workshop.creatures.length === 0
        ? 'Start with a head and body. Add an organ, then bring your idea to life.'
        : this.workshop.creatures.length < 3
          ? `Your habitat has ${this.workshop.creatures.length} creature${this.workshop.creatures.length === 1 ? '' : 's'}. Build a squad of three to enter the simulator.`
          : state.discoveredComponents.length > 5
            ? 'New biology recovered. Try adding your discovery to a fresh design.'
            : 'Your squad is ready. <a href="#battle">Test your inventions in a 3v3 battle →</a>';
    return `<div class="page-heading"><div><p class="eyebrow">WORKSHOP 01 / APPRENTICE ENGINEER</p><h1 tabindex="-1">What will you create?</h1><p class="muted">Impossible anatomy. Unexpected possibilities.</p></div><span class="tag mint">● SYSTEMS ONLINE</span></div><div class="guide"><span class="guide-icon" aria-hidden="true">✦</span><div><strong>Your next experiment</strong><p>${guidance}</p></div></div><div class="preview-grid"><section class="panel stage"><div class="stage-label"><span class="tag">CREATION CHAMBER</span><span class="tag">${String(state.nextSerial).padStart(3, '0')} / PROTOTYPE</span></div><div class="preview-art">${creature ? renderCreature(creature, this.content, this.animated()) : '<div class="empty-chamber"><span aria-hidden="true">⚗</span><p>Select a head and body</p></div>'}</div><h2>${creature ? escape(creature.name) : 'An idea takes shape'}</h2><p>${creature ? `${title(creature.element)} · predicted ${creature.quality}` : 'Every creature starts with a question.'}</p>${creature ? this.stats(creature) : ''}<p class="micro">Live anatomy preview · final genes vary at manufacture</p></section><section class="panel bench"><div class="section-title"><h2>Anatomy bench</h2><span class="tag">${this.selected.size} PARTS</span></div><p class="muted">Tap a component to add or remove it.</p><div class="part-grid">${this.content.catalog.components
      .map((p) => {
        const discovered = state.discoveredComponents.includes(p.id),
          selected = this.selected.has(p.id),
          quantity = state.inventory[p.id] ?? 0;
        return `<button class="part ${selected ? 'selected' : ''} ${!discovered ? 'locked' : ''}" data-action="part" data-part="${p.id}" aria-pressed="${selected}" ${!discovered || (!selected && quantity === 0) ? 'disabled' : ''}><span class="part-icon" aria-hidden="true">${discovered ? { head: '♜', body: '◆', legs: '╳', organ: 'ϟ', armor: '⬡', wings: '⋈' }[p.slot] : '?'}</span><span class="part-copy"><strong>${discovered ? escape(p.name) : 'Unknown component'}</strong><small>${title(p.slot)} · ${discovered ? title(p.element) : p.discovery === 'battle' ? 'Win a battle to discover' : p.discovery === 'expedition' ? 'Explore a region to discover' : p.discovery === 'challenge' ? 'Win a challenge to discover' : p.discovery === 'event' ? 'Complete a seasonal event' : 'Research to discover'}</small></span><span class="quantity">${discovered ? '×' + quantity : 'LOCKED'}</span></button>`;
      })
      .join(
        '',
      )}</div><div class="forecast"><div><span>Compatibility</span><strong>${creature ? creature.compatibility.score + '%' : '—'}</strong></div><div class="meter"><span style="width:${creature?.compatibility.score ?? 0}%"></span></div><div><span>${creature?.compatibility.tier ?? 'Incomplete anatomy'}</span><span class="mutation-hint">Mutation potential ${mutationForecast}</span></div></div>${creature?.compatibility.reasons.length ? `<details class="interactions" data-detail="interactions"><summary>Genetic interactions · ${creature.compatibility.reasons.length}</summary><ul>${creature.compatibility.reasons.map((r) => `<li>${escape(r)}</li>`).join('')}</ul></details>` : ''}${controlAvailable ? `<label class="controlled-picker">Mutation guidance<select aria-label="Mutation guidance" data-controlled-mutation="true"><option value="">Natural experiment</option>${state.discoveredMutations.map((id) => `<option value="${id}" ${this.controlledMutation === id ? 'selected' : ''}>${escape(this.content.mutations.get(id)!.name)}</option>`).join('')}</select></label><p class="micro">Guided creation adds ${escape(describeCost(this.content.catalog.rules.research.controlledMutationCost, this.content))}. Required biology still applies.</p>${controlReasons.map((r) => `<p class="micro requirement">${escape(r)}</p>`).join('')}` : ''}<button class="primary manufacture" data-action="manufacture" ${!enough ? 'disabled' : ''}><span>✦ Manufacture creature</span><span>${cost} biomass</span></button>${!enough ? `<p class="micro">${escape(blockedReason)}</p>` : '<p class="micro">Consumes one of each selected part. No two genomes are quite alike.</p>'}</section></div>`;
  }
  private creaturesView(_state: PlayerState): string {
    const all = this.workshop.creatures,
      creatures = all.filter((c) => this.filter !== 'mutated' || c.mutationIds.length > 0);
    const selected = all.find((c) => c.id === this.inspectedId);
    return `<div class="page-heading"><div><p class="eyebrow">YOUR LIVING INVENTIONS</p><a class="secondary" href="#social">Showcase & blueprints</a><a class="secondary" href="#breeding">Breeding nursery</a><h1 tabindex="-1">The habitat</h1><p class="muted">${this.workshop.creatures.length} / ${this.content.catalog.rules.workshop.maxCreatures} specimens · Made by you.</p></div><label class="filter-label">Show <select data-filter="true" aria-label="Filter creatures"><option value="all" ${this.filter === 'all' ? 'selected' : ''}>All creatures</option><option value="mutated" ${this.filter === 'mutated' ? 'selected' : ''}>Mutated creatures</option></select></label></div>${!all.length ? '<section class="panel empty"><h2>Your first invention belongs here.</h2><p class="muted">Build something curious in the creation chamber.</p><a class="primary" href="#workshop">Start an experiment</a></section>' : `<div class="creature-grid">${creatures.map((c) => `<button class="panel creature-card" data-action="inspect" data-id="${escape(c.id)}">${renderCreature(c, this.content, false)}<strong>${escape(c.name)}</strong><span class="card-meta">${title(c.element)} · ${title(c.quality)} · Lv ${c.level}</span><span class="tag ${c.mutationIds.length ? 'gold' : ''}">${c.mutationIds.length ? '✦ MUTATED' : c.roles.map(title).join(' / ')}</span></button>`).join('')}</div>${!creatures.length ? '<p class="muted">No mutations discovered yet. Try an electric component.</p>' : ''}`}${
      selected
        ? `<section class="panel specimen-detail" id="specimen-detail"><div class="section-title"><h2>${escape(selected.name)}</h2><span class="tag">SPECIMEN ${escape(selected.id)}</span></div>${this.stats(selected)}<form data-rename="${escape(selected.id)}" class="rename-form"><label>Name your creation<input name="name" maxlength="40" required value="${escape(selected.name)}"></label><button class="secondary" type="submit">Save name</button></form><div class="detail-grid"><div><h3>Genome</h3>${GENES.map((id) => `<div class="gene-row"><span>${title(id)}</span><meter min="0" max="100" value="${selected.genome[id].value}" aria-label="${id}"></meter><strong>${selected.genome[id].value}</strong></div>`).join('')}</div><div><h3>Abilities</h3>${selected.abilityIds
            .map((id) => {
              const a = this.content.ability(id);
              return `<div class="ability-detail"><strong>${escape(a.name)}</strong><p>${escape(a.description)}</p></div>`;
            })
            .join(
              '',
            )}</div><div><h3>Origin & traits</h3><p class="muted">Created by ${escape(selected.creator)}<br>${escape(new Date(selected.createdAt).toLocaleDateString())}<br>Seed ${selected.seed} · ${selected.history.victories} victories</p>${selected.componentIds.map((id) => `<span class="tag">${escape(this.content.component(id).name)}</span>`).join('')}<p>${selected.traitIds.map((id) => escape(this.content.traits.get(id)!.name)).join(' · ')}</p>${selected.mutationIds.map((id) => `<p class="gold-text">✦ ${escape(this.content.mutations.get(id)!.name)}</p>`).join('')}</div></div></section>`
        : ''
    }`;
  }
  private journalView(state: PlayerState): string {
    return `<div class="page-heading"><div><p class="eyebrow">SCIENCE BEGINS WITH A QUESTION</p><h1 tabindex="-1">Experiment journal</h1><p class="muted">Every combination tells you something.</p></div><span class="tag">${state.experiments.length} EXPERIMENTS</span></div><div class="journal-layout"><section class="panel"><h2>Discovery codex</h2><p class="muted">${state.discoveredComponents.length} / ${this.content.components.size} components</p><div class="codex-list">${this.content.catalog.components.map((p) => `<div><span>${state.discoveredComponents.includes(p.id) ? escape(p.name) : '???'}</span><span class="tag">${state.discoveredComponents.includes(p.id) ? title(p.rarity) : 'UNDISCOVERED'}</span></div>`).join('')}</div><h3>Mutations</h3>${this.content.catalog.mutations.map((m) => `<div class="discovery"><strong>${state.discoveredMutations.includes(m.id) ? escape(m.name) : '??? / Unknown mutation'}</strong><p class="muted">${state.discoveredMutations.includes(m.id) ? escape(m.description) : 'Experiment with unstable or energetic biology.'}</p></div>`).join('')}</section><section class="experiment-list">${
      state.experiments.length
        ? [...state.experiments]
            .reverse()
            .map(
              (e) =>
                `<article class="panel experiment"><p class="eyebrow">EXPERIMENT #${String(e.serial).padStart(3, '0')}</p><h2>${escape(state.creatures.find((c) => c.id === e.creatureId)!.name)}</h2><p class="recipe">${e.componentIds.map((id) => escape(this.content.component(id).name)).join(' + ')}</p><div class="section-title"><span class="tag">${e.compatibility}% COMPATIBLE</span><span class="tag ${e.mutationIds.length ? 'gold' : ''}">${e.mutationIds.length ? e.mutationIds.map((id) => escape(this.content.mutations.get(id)!.name)).join(', ') : 'STABLE MANUFACTURE'}</span></div><p class="micro">Seed ${e.seed} · ${escape(new Date(e.createdAt).toLocaleString())}</p></article>`,
            )
            .join('')
        : '<section class="panel empty"><h2>A blank page. Infinite possibilities.</h2><p class="muted">Your first manufacture will be recorded here.</p></section>'
    }</section></div>`;
  }
  private settingsView(state: PlayerState): string {
    return `<div class="page-heading"><div><p class="eyebrow">MAKE YOURSELF AT HOME</p><h1 tabindex="-1">Workshop settings</h1></div></div><div class="settings-grid"><section class="panel"><h2>Comfort & feedback</h2>${(['sound', 'haptics', 'reducedMotion'] as const).map((k) => `<label class="option"><span>${{ sound: 'Sound effects', haptics: 'Haptic feedback', reducedMotion: 'Reduce animation' }[k]}</span><input type="checkbox" data-option="${k}" ${state.options[k] ? 'checked' : ''}></label>`).join('')}<label class="option"><span>Text size</span><select data-option="textScale" aria-label="Text size">${[1, 1.15, 1.3].map((v) => `<option value="${v}" ${state.options.textScale === v ? 'selected' : ''}>${Math.round(v * 100)}%</option>`).join('')}</select></label></section><section class="panel"><h2>Keep your discoveries</h2><p class="muted">Your workshop lives in this browser. Export a copy to keep it safe or move it to another device.</p><div class="save-actions"><button class="secondary" data-action="export">Export save</button><label class="secondary file-button">Import save<input type="file" accept=".json,application/json" data-import="true" aria-label="Import save"></label><button class="quiet" data-action="backup">Restore previous save</button></div><p class="micro">Imports replace this workshop after validation. A backup of the previous save is retained. Diagnostics stay on this device.</p></section></div>`;
  }
  private validTargets(battle: Battle, actor: Combatant): Combatant[] {
    const ability = this.content.ability(this.selectedAbility);
    return battle.units.filter(
      (u) =>
        u.hp > 0 &&
        (ability.target === 'self'
          ? u.id === actor.id
          : ability.target === 'ally'
            ? u.team === actor.team
            : u.team !== actor.team),
    );
  }
  private battleView(state: PlayerState): string {
    const heading =
      '<div class="page-heading"><div><p class="eyebrow">BUILD IT. TEST IT. IMPROVE IT.</p><a class="secondary" href="#challenges">Challenge arena</a><h1 tabindex="-1">Combat simulator</h1><p class="muted">Three inventions. A thousand possibilities.</p></div><span class="tag">3 VS 3 / FIELD TEST</span></div>';
    if (this.reward) {
      const discovery = this.reward.newComponent
        ? this.content.component(this.reward.newComponent)
        : undefined;
      return `${heading}<section class="panel reward-panel"><p class="eyebrow">${this.reward.victory ? 'FIELD TEST PASSED' : 'TEST COMPLETE'}</p><h2>${discovery ? 'New biology. New possibilities.' : this.reward.victory ? 'Your inventions proved themselves.' : 'A new idea is already taking shape.'}</h2>${discovery ? `<div class="reward-symbol" aria-hidden="true">⋈</div><h3>${escape(discovery.name)}</h3><p class="muted">${escape(discovery.lore)}</p>` : '<p class="muted">Every specimen has returned safely to the habitat.</p>'}<div class="reward-items"><span class="tag mint">+${this.reward.biomass} BIOMASS</span>${Object.entries(
        this.reward.quantities,
      )
        .map(
          ([id, n]) => `<span class="tag">+${n} ${escape(this.content.component(id).name)}</span>`,
        )
        .join('')}${Object.entries(this.reward.resources)
        .map(
          ([id, n]) =>
            `<span class="tag mint">+${n} ${escape(this.content.resources.get(id)!.name)}</span>`,
        )
        .join(
          '',
        )}</div><div class="dialog-actions"><button class="primary" data-action="use-discovery">${discovery ? 'Try your new component' : 'Build another creature'}</button><button class="secondary" data-action="new-test">Run another test</button></div><p class="micro">Rewards saved. Creature history updated.</p></section>`;
    }
    const battle = state.activeBattle;
    if (!battle) {
      const creatures = this.workshop.creatures;
      return `${heading}<section class="panel"><div class="section-title"><h2>Choose your field team</h2><span class="tag">${this.squad.size} / 3 SELECTED</span></div><p class="muted">${creatures.length < 3 ? 'Manufacture three creatures to begin. Every team member must be your own invention.' : 'Mix armor, speed and elemental power. Tap a specimen to change the squad.'}</p>${creatures.length ? `<div class="creature-grid squad-grid">${creatures.map((c) => `<button class="panel creature-card ${this.squad.has(c.id) ? 'squad-selected' : ''}" data-action="squad" data-id="${escape(c.id)}" aria-pressed="${this.squad.has(c.id)}" ${this.workshop.isAssigned(c.id) ? 'disabled' : ''}>${renderCreature(c, this.content, false)}<strong>${escape(c.name)}</strong><span class="card-meta">${title(c.element)} · ${c.stats.hp} HP · ${c.stats.speed} speed</span><span class="tag">${this.squad.has(c.id) ? '✓ SELECTED' : 'ADD TO SQUAD'}</span></button>`).join('')}</div>` : '<div class="empty"><p>Your first team is waiting to be built.</p><a class="primary" href="#workshop">Return to the workshop</a></div>'}<div class="battle-start"><p class="micro">Victory earns biomass, components and a new discovery. Defeated creatures recover. No entry cost.</p><button class="primary" data-action="start-battle" ${this.squad.size !== 3 ? 'disabled' : ''}>Start field test</button></div></section>`;
    }
    const actor = currentActor(battle);
    if (actor && actor.id !== this.lastActor) {
      this.lastActor = actor.id;
      this.selectedAbility = 'strike';
      this.selectedTarget = undefined;
    }
    const targets = actor ? this.validTargets(battle, actor) : [];
    if (!targets.some((u) => u.id === this.selectedTarget)) this.selectedTarget = targets[0]?.id;
    const card = (u: Combatant): string => {
      const creature = deriveCreature(u.source, this.content),
        valid = targets.some((t) => t.id === u.id);
      return `<button class="fight-card ${u.id === actor?.id ? 'current' : ''} ${u.id === this.selectedTarget ? 'target' : ''} ${u.hp === 0 ? 'defeated' : ''}" data-action="target" data-target="${escape(u.id)}" aria-label="Target ${escape(u.source.name)}, ${u.hp} of ${u.stats.hp} health" aria-pressed="${u.id === this.selectedTarget}" ${!valid ? 'disabled' : ''}>${renderCreature(creature, this.content, false)}<strong>${escape(u.source.name)}</strong><span class="hp-label">${u.hp} / ${u.stats.hp} HP${u.shield ? ` · ${u.shield} shield` : ''}</span><span class="health-meter"><span style="width:${(u.hp / u.stats.hp) * 100}%"></span></span><span class="unit-statuses">${u.statuses.map((s) => `<span class="tag">${title(s.id)} ${s.duration}</span>`).join('')}${u.hp === 0 ? '<span class="tag">RECOVERING</span>' : ''}</span></button>`;
    };
    const terminal = battle.status !== 'active';
    return `${heading}<div class="battle-grid"><section class="panel battlefield"><div class="section-title"><h2>${terminal ? (battle.status === 'victory' ? 'Victory!' : 'Test complete') : `Round ${battle.round}`}</h2><span class="tag">${terminal ? 'ALL SPECIMENS RETAINED' : `TURN ${battle.turnIndex + 1} / ${battle.order.length}`}</span></div><p class="team-label">SIMULATOR PROTOTYPES</p><div class="fight-team enemies">${battle.units
      .filter((u) => u.team === 'enemy')
      .map(card)
      .join(
        '',
      )}</div><div class="arena-divider"><span>VS</span></div><div class="fight-team allies">${battle.units
      .filter((u) => u.team === 'player')
      .map(card)
      .join('')}</div><p class="team-label">YOUR INVENTIONS</p>${
      !terminal
        ? `<p class="micro">Turn order · ${battle.order
            .slice(battle.turnIndex)
            .map((id) => escape(battle.units.find((u) => u.id === id)!.source.name))
            .join(' → ')}</p>`
        : ''
    }</section><section class="combat-sidebar">${
      actor
        ? `<section class="panel combat-controls"><p class="eyebrow">YOUR TURN</p><h2>${escape(actor.source.name)}</h2><p class="muted">${actor.energy} / ${actor.stats.energy} energy · Choose an ability, then a target.</p><div class="ability-grid">${availableAbilities(
            actor,
            this.content,
          )
            .map(
              (a) =>
                `<button class="ability-button ${a.id === this.selectedAbility ? 'selected' : ''}" data-action="ability" data-ability="${a.id}" aria-pressed="${a.id === this.selectedAbility}" title="${escape(a.description)}" ${!canUse(actor, a) ? 'disabled' : ''}><strong>${escape(a.name)}</strong><small>${a.cost} energy · ${(actor.cooldowns[a.id] ?? 0) > 0 ? `${actor.cooldowns[a.id]} turns left` : a.target === 'enemy' ? 'Enemy' : title(a.target)}</small></button>`,
            )
            .join(
              '',
            )}</div><p class="ability-description">${escape(this.content.ability(this.selectedAbility).description)}</p><button class="primary execute-action" data-action="battle-action" ${!this.selectedTarget ? 'disabled' : ''}>Use ${escape(this.content.ability(this.selectedAbility).name)}</button><p class="micro">Target: ${escape(targets.find((u) => u.id === this.selectedTarget)?.source.name ?? 'Choose a target')}</p><button class="quiet retreat" data-action="retreat">Retreat safely</button></section>`
        : `<section class="panel battle-result"><p class="eyebrow">${battle.status === 'victory' ? 'CREATURE ENGINEERING: SUCCESS' : 'A CHANCE TO IMPROVE'}</p><h2>${battle.status === 'victory' ? 'Your designs work.' : 'Every experiment teaches you something.'}</h2><p class="muted">${battle.status === 'victory' ? 'Collect your materials and a new component discovery.' : 'Your creatures recover for another attempt. Try more armor or elemental power.'}</p><button class="primary" data-action="claim-battle">${battle.status === 'victory' ? 'Collect rewards' : 'Return to habitat'}</button></section>`
    }<details class="panel battle-log" data-detail="battle-log" open><summary>Battle log</summary><ol role="log" aria-live="polite">${battle.log
      .slice(-8)
      .map((line) => `<li>${escape(line)}</li>`)
      .join('')}</ol></details></section></div>`;
  }
  private modal(): string {
    const id = this.sequence?.id ?? this.revealId;
    if (!id) return '';
    const creature = this.workshop.creatures.find((c) => c.id === id)!;
    const guided = this.workshop.state.experiments.some(
      (e) => e.creatureId === id && e.controlledMutation,
    );
    if (this.sequence)
      return `<dialog class="creation-dialog" aria-labelledby="sequence-title"><p class="eyebrow">MANUFACTURING IN PROGRESS</p><h2 id="sequence-title">${sequenceSteps[this.sequence.step]}</h2><div class="scan-orb" aria-hidden="true">ϟ</div><div class="sequence-dots" aria-hidden="true">${sequenceSteps.map((_, i) => `<span class="${i <= this.sequence!.step ? 'active' : ''}"></span>`).join('')}</div><p class="muted">Something impossible is waking up.</p><button class="secondary" data-action="skip">Skip sequence</button></dialog>`;
    return `<dialog class="creation-dialog reveal" aria-labelledby="reveal-title"><p class="eyebrow">${guided ? '✦ GUIDED MUTATION' : creature.mutationIds.length ? '✦ UNEXPECTED MUTATION' : 'MANUFACTURE COMPLETE'}</p><h2 id="reveal-title">${escape(creature.name)}</h2>${renderCreature(creature, this.content, this.animated())}<span class="tag">${title(creature.quality)} · ${title(creature.element)}</span>${creature.mutationIds.map((id) => `<div class="discovery"><strong>${escape(this.content.mutations.get(id)!.name)}</strong><p>${escape(this.content.mutations.get(id)!.description)}</p></div>`).join('')}<p class="muted">You made this. Now see what it can do.</p><div class="dialog-actions"><button class="primary" data-action="view-created">Meet your creature</button><button class="quiet" data-action="close">Keep experimenting</button></div></dialog>`;
  }
  private closeReveal(): void {
    if (this.timer) clearTimeout(this.timer);
    this.sequence = undefined;
    this.revealId = undefined;
    this.render();
  }
  private finishSequence(): void {
    if (this.timer) clearTimeout(this.timer);
    this.revealId = this.sequence?.id ?? this.revealId;
    this.sequence = undefined;
    this.render();
  }
  private advanceSequence(): void {
    this.timer = setTimeout(() => {
      if (!this.sequence) return;
      if (this.sequence.step >= sequenceSteps.length - 1) this.finishSequence();
      else {
        this.sequence.step++;
        this.render();
        this.advanceSequence();
      }
    }, 450);
  }
  private async act(action: string, button: HTMLElement): Promise<void> {
    if (action === 'reload-save') {
      location.reload();
      return;
    }
    if (this.saveChanged || this.sessionEnded) return;
    if (action === 'skip-content') {
      const heading = this.root.querySelector<HTMLElement>('main h1');
      heading?.focus();
      heading?.scrollIntoView({ block: 'start', behavior: this.animated() ? 'smooth' : 'instant' });
    }
    if (action === 'retry-clock') {
      this.workshop.retrySave();
      this.clockFailed = false;
      this.lastTick = performance.now();
      this.notify('Active timers resumed.');
      this.render();
    }
    if (action === 'event-join') {
      this.workshop.joinEvent(new Date().toISOString());
      this.notify('Enrolled. New work counts toward this experiment.');
      this.render();
    }
    if (action === 'event-claim') {
      this.workshop.claimEvent(new Date().toISOString());
      this.notify('Seasonal biology recovered.');
      this.render();
    }
    if (action === 'save-blueprint') {
      this.workshop.saveBlueprint(button.dataset.id!);
      this.notify('Blueprint saved.');
      this.render();
    }
    if (action === 'showcase-toggle') {
      this.workshop.toggleShowcase(button.dataset.id!);
      this.render();
    }
    if (action === 'visitor-blueprint') {
      this.workshop.saveVisitorBlueprint(button.dataset.id!);
      this.notify('Visitor recipe saved.');
      this.render();
    }
    if (action === 'share-creature')
      downloadSave(
        this.workshop.exportCreature(button.dataset.id!),
        'monster-workshop-creature.json',
      );
    if (action === 'share-blueprint')
      downloadSave(
        this.workshop.exportBlueprint(button.dataset.id!),
        'monster-workshop-blueprint.json',
      );
    if (action === 'share-showcase')
      downloadSave(this.workshop.exportShowcase(), 'monster-workshop-showcase.json');
    if (action === 'copy-blueprint') {
      const raw = this.workshop.exportBlueprint(button.dataset.id!);
      if (!navigator.clipboard) {
        downloadSave(raw, 'monster-workshop-blueprint.json');
        this.notify('Blueprint exported.');
      } else {
        await navigator.clipboard.writeText(raw);
        this.notify('Genetic blueprint copied.');
      }
      this.render();
    }
    if (action === 'remove-blueprint') {
      this.workshop.removeBlueprint(button.dataset.id!);
      this.render();
    }
    if (action === 'remove-gallery') {
      this.workshop.removeGallery(button.dataset.id!);
      this.render();
    }
    if (action === 'make-blueprint') {
      const c = this.workshop.manufactureBlueprint(button.dataset.id!, new Date().toISOString());
      this.inspectedId = c.id;
      this.revealId = c.id;
      this.render();
    }
    if (action === 'market-buy') {
      this.workshop.buy(button.dataset.id!, new Date().toISOString());
      this.notify('Supplies purchased.');
      this.render();
    }
    if (action === 'market-craft') {
      this.workshop.craft(button.dataset.id!, new Date().toISOString());
      this.notify('Biological sample crafted.');
      this.render();
    }
    if (action === 'market-sell' || action === 'market-deliver') {
      const sale = this.workshop.sell(button.dataset.id!, action === 'market-deliver');
      this.squad.delete(sale.creatureId);
      this.notify(`Creature transferred. +${sale.biomass} biomass.`);
      this.render();
    }
    if (action === 'part') {
      const id = button.dataset.part!;
      if (this.selected.has(id)) this.selected.delete(id);
      else {
        const slot = this.content.component(id).slot;
        for (const chosen of this.selected)
          if (this.content.component(chosen).slot === slot) this.selected.delete(chosen);
        this.selected.add(id);
      }
      this.feedback.play('select');
      this.notify('');
      this.render(id);
    }
    if (action === 'manufacture' && !this.sequence && !this.revealId) {
      const creature = this.workshop.manufacture(
        [...this.selected],
        new Date().toISOString(),
        this.controlledMutation,
      );
      this.inspectedId = creature.id;
      this.feedback.play('create');
      this.notify('');
      if (this.animated()) {
        this.sequence = { id: creature.id, step: 0 };
        this.render();
        this.advanceSequence();
      } else {
        this.revealId = creature.id;
        this.render();
      }
    }
    if (action === 'skip') this.finishSequence();
    if (action === 'close') this.closeReveal();
    if (action === 'view-created') {
      this.closeReveal();
      this.nav.go('creatures');
    }
    if (action === 'inspect') {
      this.inspectedId = button.dataset.id;
      this.render();
      this.root
        .querySelector('#specimen-detail')
        ?.scrollIntoView({ behavior: this.animated() ? 'smooth' : 'instant', block: 'start' });
    }
    if (action === 'breed') {
      const child = this.workshop.breed(
        this.parents[0]!,
        this.parents[1]!,
        new Date().toISOString(),
      );
      this.inspectedId = child.id;
      this.revealId = child.id;
      this.notify('An offspring has joined your family.');
      this.render();
    }
    if (action === 'research') {
      this.workshop.completeResearch(button.dataset.id!);
      this.notify(`${this.content.research.get(button.dataset.id!)!.name} researched.`);
      this.render();
    }
    if (action === 'open-scanner') {
      this.root
        .querySelector('#component-scanner')
        ?.scrollIntoView({ behavior: this.animated() ? 'smooth' : 'instant', block: 'start' });
      this.root.querySelector<HTMLElement>('#component-scanner h2')?.focus({ preventScroll: true });
    }
    if (action === 'scan') {
      this.workshop.scanComponent(button.dataset.id!, new Date().toISOString());
      this.notify('Biological analysis saved.');
      this.render();
      this.root.querySelector('#component-scanner')?.scrollIntoView({ block: 'start' });
    }
    if (action === 'cultivate') {
      this.workshop.cultivateComponent(button.dataset.id!);
      this.notify(
        `${this.content.component(button.dataset.id!).name} cultivated. One sample added to storage.`,
      );
      this.render();
    }
    if (action === 'region') {
      this.regionId = button.dataset.region!;
      this.render();
    }
    if (action === 'start-expedition') {
      if (!this.explorerId) throw new Error('Choose an explorer');
      this.workshop.startExpedition(this.regionId, this.explorerId, new Date().toISOString());
      this.lastTick = performance.now();
      this.explorerId = undefined;
      this.notify('Your explorer is on its way.');
      this.render();
    }
    if (action === 'claim-expedition') {
      const reward = this.workshop.claimExpedition(button.dataset.id!);
      this.notify(
        `Expedition collected: +${reward.biomass} biomass${reward.discovery ? ' / Recovered ' + this.content.component(reward.discovery).name : ''}.`,
      );
      this.feedback.play('victory');
      this.render();
    }
    if (action === 'cancel-expedition') {
      this.workshop.cancelExpedition(button.dataset.id!);
      this.notify('Your explorer returned safely.');
      this.render();
    }
    if (action === 'export') downloadSave(this.workshop.exportSave());
    if (action === 'backup') {
      this.workshop.restoreBackup();
      this.resetSession();
      this.notify('Previous save restored.');
      this.render();
    }
    if (action === 'dismiss') {
      this.notify('');
      this.render();
    }
    if (action === 'squad') {
      const id = button.dataset.id!;
      if (this.squad.has(id)) this.squad.delete(id);
      else if (this.squad.size < 3) this.squad.add(id);
      else {
        this.notify('Remove one team member before adding another.');
      }
      this.render();
    }
    if (action === 'start-tower' || action === 'start-boss') {
      this.workshop.startBattle(
        [...this.squad],
        new Date().toISOString(),
        action === 'start-tower'
          ? { kind: 'tower', modifier: this.challengeModifier }
          : { kind: 'boss', bossId: button.dataset.id!, modifier: this.challengeModifier },
      );
      this.reward = undefined;
      this.lastActor = undefined;
      this.nav.go('battle');
    }
    if (action === 'start-battle') {
      this.workshop.startBattle([...this.squad], new Date().toISOString());
      this.lastActor = undefined;
      this.selectedTarget = undefined;
      this.notify('');
      this.render();
    }
    if (action === 'ability') {
      this.selectedAbility = button.dataset.ability!;
      this.selectedTarget = undefined;
      this.render();
    }
    if (action === 'target') {
      this.selectedTarget = button.dataset.target;
      this.render();
    }
    if (action === 'battle-action') {
      const battle = this.workshop.state.activeBattle,
        actor = battle ? currentActor(battle) : undefined;
      if (!actor || !this.selectedTarget) throw new Error('Choose an action and target');
      this.workshop.battleAction({
        actorId: actor.id,
        abilityId: this.selectedAbility,
        targetId: this.selectedTarget,
      });
      this.feedback.play('select');
      this.render();
    }
    if (action === 'retreat') {
      this.workshop.retreatBattle();
      this.render();
    }
    if (action === 'claim-battle') {
      this.reward = this.workshop.claimBattle();
      if (this.reward.victory) this.feedback.play('victory');
      this.render();
    }
    if (action === 'use-discovery') {
      const discovery =
        this.reward?.newComponent ?? this.content.catalog.rules.combat.rewardComponent;
      this.reward = undefined;
      const state = this.workshop.state;
      this.selected = new Set(
        this.content.catalog.rules.generation.requiredSlots.flatMap((slot) => {
          const part = this.content.catalog.components.find(
            (p) => p.slot === slot && (state.inventory[p.id] ?? 0) > 0,
          );
          return part ? [part.id] : [];
        }),
      );
      if ((state.inventory[discovery] ?? 0) > 0) {
        const slot = this.content.component(discovery).slot;
        for (const id of this.selected)
          if (this.content.component(id).slot === slot) this.selected.delete(id);
        this.selected.add(discovery);
      }
      this.nav.go('workshop');
    }
    if (action === 'new-test') {
      this.reward = undefined;
      this.render();
    }
  }
  private async change(input: HTMLInputElement): Promise<void> {
    if (this.saveChanged || this.sessionEnded) return;
    if (input.dataset.socialCreature) {
      this.socialCreature = input.value;
      this.render();
    }
    if (input.dataset.shareImport) {
      const file = input.files?.[0];
      if (file) {
        if (file.size > MAX_SHARE_BYTES) throw new Error('Shared file is too large');
        const raw = await file.text();
        if (this.saveChanged || this.sessionEnded) return;
        this.workshop.importShare(raw);
        this.notify('Shared design imported.');
        this.render();
      }
    }
    if (input.dataset.marketOffer) {
      this.marketOffer = input.value;
      this.render();
    }
    if (input.dataset.marketRecipe) {
      this.marketRecipe = input.value;
      this.render();
    }
    if (input.dataset.marketCreature) {
      this.marketCreature = input.value;
      this.render();
    }
    if (input.dataset.challengeModifier)
      this.challengeModifier = input.value as Challenge['modifier'];
    if (input.dataset.parent !== undefined) {
      this.parents[Number(input.dataset.parent) as 0 | 1] = input.value || undefined;
      this.render();
    }
    if (input.dataset.scannerComponent) {
      this.scannerId = input.value;
      this.render();
    }
    if (input.dataset.controlledMutation) {
      this.controlledMutation = input.value || undefined;
      this.render();
    }
    if (input.dataset.explorer) {
      this.explorerId = input.value || undefined;
      this.render();
    }
    if (input.dataset.filter) {
      this.filter = input.value;
      this.render();
    }
    if (input.dataset.option) {
      const options = this.workshop.state.options,
        key = input.dataset.option;
      if (key === 'textScale') options.textScale = Number(input.value);
      else if (key === 'sound' || key === 'haptics' || key === 'reducedMotion')
        options[key] = input.checked;
      this.workshop.updateOptions(options);
      this.render();
      this.feedback.play('select');
    }
    if (input.dataset.import) {
      const file = input.files?.[0];
      if (!file) return;
      if (file.size > MAX_SAVE_BYTES) throw new SaveError(SAVE_SIZE_ERROR);
      const raw = await file.text();
      if (this.saveChanged || this.sessionEnded) return;
      this.workshop.importSave(raw);
      this.resetSession();
      this.notify('Workshop imported.');
      this.render();
    }
  }
}
