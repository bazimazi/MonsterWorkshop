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
export function downloadSave(raw: string): void {
  const url=URL.createObjectURL(new Blob([raw],{type:'application/json'})),link=document.createElement('a');
  link.href=url;link.download='monster-workshop-save.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),0);
}
const sequenceSteps=['Inserting components','Scanning biological signatures','Assembling the genome','Checking for mutations','Opening the chamber'];
const statNames={hp:'Health',attack:'Attack',defense:'Armor',speed:'Speed',power:'Power',energy:'Energy'};
export class GameUI {
  private nav: Navigation;
  private selected = new Set<string>();
  private inspectedId: string | undefined;
  private filter='all';
  private notice='';
  private isError=false;
  private sequence: {id:string;step:number} | undefined;
  private revealId: string | undefined;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private feedback=new Feedback();
  constructor(private root: HTMLElement, private workshop: Workshop, private content: ContentIndex) {
    for(const part of content.components.values())if(part.slot==='head'||part.slot==='body')this.selected.add(part.id);
    this.nav=new Navigation(()=>{this.render();this.root.querySelector<HTMLElement>('h1')?.focus();});
    root.addEventListener('click',event=>{
      const button=(event.target as HTMLElement).closest<HTMLElement>('[data-action]');
      if(button)void this.act(button.dataset.action!,button).catch(error=>this.fail(error));
    });
    root.addEventListener('submit',event=>{
      const form=event.target as HTMLFormElement;
      if(form.dataset.rename){event.preventDefault();try{this.workshop.rename(form.dataset.rename,new FormData(form).get('name') as string);this.notice='Name saved.';this.render();}catch(error){this.fail(error);}}
    });
    root.addEventListener('change',event=>void this.change(event.target as HTMLInputElement).catch(error=>this.fail(error)));
    this.render();
  }
  private animated(): boolean { return !this.workshop.state.options.reducedMotion&&!matchMedia('(prefers-reduced-motion: reduce)').matches; }
  private fail(error: unknown): void { logger.error(error);this.notice=error instanceof Error?error.message:'Something went wrong';this.isError=true;this.render(); }
  private applyOptions(state: PlayerState): void {
    document.documentElement.style.fontSize=`${16*state.options.textScale}px`;
    document.body.classList.toggle('reduced-motion',state.options.reducedMotion);
    this.feedback.enabled=state.options.sound;this.feedback.haptics=state.options.haptics;
  }
  private render(focusPart?: string): void {
    const state=this.workshop.state;this.applyOptions(state);
    const screen=this.nav.current;
    const body=screen==='creatures'?this.creaturesView(state):screen==='journal'?this.journalView(state):screen==='settings'?this.settingsView(state):this.workshopView(state);
    const tabs: [Screen,string,string][]=[['workshop','Workshop','⚗'],['creatures','Creatures','◈'],['journal','Journal','≡'],['settings','Settings','⚙']];
    this.root.innerHTML=`<header class="topbar"><a class="brand" href="#workshop"><img src="./icon.svg" alt="" width="36" height="36"><span>MONSTER<span class="brand-light">WORKSHOP</span></span></a><div class="resource"><span class="resource-dot" aria-hidden="true"></span><strong>${state.biomass}</strong><span>biomass</span></div></header><nav class="navigation" aria-label="Main navigation">${tabs.map(([key,label,symbol])=>`<a href="#${key}" ${screen===key?'aria-current="page"':''}><span aria-hidden="true">${symbol}</span>${label}${key==='creatures'?`<small>${state.creatures.length}</small>`:''}</a>`).join('')}</nav><main class="shell game-shell">${this.notice?`<div class="notice ${this.isError?'error':''}" role="${this.isError?'alert':'status'}">${escape(this.notice)}<button class="quiet" data-action="dismiss" aria-label="Dismiss message">×</button></div>`:''}${body}</main><footer class="footer">A little science. A little strange. <span>Saved on this device</span></footer>${this.modal()}`;
    const dialog=this.root.querySelector<HTMLDialogElement>('dialog');
    if(dialog){dialog.showModal();dialog.addEventListener('cancel',event=>{event.preventDefault();this.closeReveal();});}
    if(focusPart)Array.from(this.root.querySelectorAll<HTMLButtonElement>('[data-part]')).find(b=>b.dataset.part===focusPart)?.focus();
  }
  private preview(): Creature | undefined {
    try{return generateCreature([...this.selected],this.content,{seed:0,createdAt:'2026-10-02T00:00:00Z',creator:'Preview',skipMutations:true});}catch{return undefined;}
  }
  private stats(creature: Creature): string {
    return `<dl class="stats">${STAT_KEYS.map(k=>`<div><dt>${statNames[k]}</dt><dd>${creature.stats[k]}</dd></div>`).join('')}</dl>`;
  }
  private workshopView(state: PlayerState): string {
    const creature=this.preview(),cost=creature?this.workshop.cost([...this.selected]):0;
    const enough=creature&&cost<=state.biomass&&[...this.selected].every(id=>(state.inventory[id]??0)>0)&&state.creatures.length<this.content.catalog.rules.workshop.maxCreatures;
    const guidance=state.creatures.length===0?'Start with a head and body. Add an organ, then bring your idea to life.':state.creatures.length<3?`Your habitat has ${state.creatures.length} creature${state.creatures.length===1?'':'s'}. Try a different combination next.`:'Your habitat is growing. Compare your experiments in the journal.';
    return `<div class="page-heading"><div><p class="eyebrow">WORKSHOP 01 / APPRENTICE ENGINEER</p><h1 tabindex="-1">What will you create?</h1><p class="muted">Impossible anatomy. Unexpected possibilities.</p></div><span class="tag mint">● SYSTEMS ONLINE</span></div><div class="guide"><span class="guide-icon" aria-hidden="true">✦</span><div><strong>Your next experiment</strong><p>${guidance}</p></div></div><div class="preview-grid"><section class="panel stage"><div class="stage-label"><span class="tag">CREATION CHAMBER</span><span class="tag">${String(state.nextSerial).padStart(3,'0')} / PROTOTYPE</span></div><div class="preview-art">${creature?renderCreature(creature,this.content,this.animated()):'<div class="empty-chamber"><span aria-hidden="true">⚗</span><p>Select a head and body</p></div>'}</div><h2>${creature?escape(creature.name):'An idea takes shape'}</h2><p>${creature?`${title(creature.element)} · predicted ${creature.quality}`:'Every creature starts with a question.'}</p>${creature?this.stats(creature):''}<p class="micro">Live anatomy preview · final genes vary at manufacture</p></section><section class="panel bench"><div class="section-title"><h2>Anatomy bench</h2><span class="tag">${this.selected.size} PARTS</span></div><p class="muted">Tap a component to add or remove it.</p><div class="part-grid">${this.content.catalog.components.map(p=>{
      const discovered=state.discoveredComponents.includes(p.id),selected=this.selected.has(p.id),quantity=state.inventory[p.id]??0;
      return `<button class="part ${selected?'selected':''} ${!discovered?'locked':''}" data-action="part" data-part="${p.id}" aria-pressed="${selected}" ${!discovered||(!selected&&quantity===0)?'disabled':''}><span class="part-icon" aria-hidden="true">${discovered?({head:'♜',body:'◆',legs:'╳',organ:'ϟ',armor:'⬡',wings:'⋈'}[p.slot]):'?'}</span><span class="part-copy"><strong>${discovered?escape(p.name):'Unknown component'}</strong><small>${title(p.slot)} · ${discovered?title(p.element):'Win a battle to discover'}</small></span><span class="quantity">${discovered?'×'+quantity:'LOCKED'}</span></button>`;
    }).join('')}</div><div class="forecast"><div><span>Compatibility</span><strong>${creature?creature.compatibility.score+'%':'—'}</strong></div><div class="meter"><span style="width:${creature?.compatibility.score??0}%"></span></div><div><span>${creature?.compatibility.tier??'Incomplete anatomy'}</span><span class="mutation-hint">Mutation potential ${creature?Math.round(creature.compatibility.mutationChance*100)+'%':'—'}</span></div></div>${creature?.compatibility.reasons.length?`<details class="interactions"><summary>Genetic interactions · ${creature.compatibility.reasons.length}</summary><ul>${creature.compatibility.reasons.map(r=>`<li>${escape(r)}</li>`).join('')}</ul></details>`:''}<button class="primary manufacture" data-action="manufacture" ${!enough?'disabled':''}><span>✦ Manufacture creature</span><span>${cost} biomass</span></button>${!enough?'<p class="micro">Choose a head and body with available parts and biomass.</p>':'<p class="micro">Consumes one of each selected part. No two genomes are quite alike.</p>'}</section></div>`;
  }
  private creaturesView(state: PlayerState): string {
    const all=this.workshop.creatures,creatures=all.filter(c=>this.filter!=='mutated'||c.mutationIds.length>0);
    const selected=all.find(c=>c.id===this.inspectedId);
    return `<div class="page-heading"><div><p class="eyebrow">YOUR LIVING INVENTIONS</p><h1 tabindex="-1">The habitat</h1><p class="muted">${state.creatures.length} / ${this.content.catalog.rules.workshop.maxCreatures} specimens · Made by you.</p></div><label class="filter-label">Show <select data-filter="true" aria-label="Filter creatures"><option value="all" ${this.filter==='all'?'selected':''}>All creatures</option><option value="mutated" ${this.filter==='mutated'?'selected':''}>Mutated creatures</option></select></label></div>${!all.length?'<section class="panel empty"><h2>Your first invention belongs here.</h2><p class="muted">Build something curious in the creation chamber.</p><a class="primary" href="#workshop">Start an experiment</a></section>':`<div class="creature-grid">${creatures.map(c=>`<button class="panel creature-card" data-action="inspect" data-id="${escape(c.id)}">${renderCreature(c,this.content,false)}<strong>${escape(c.name)}</strong><span class="card-meta">${title(c.element)} · ${title(c.quality)} · Lv ${c.level}</span><span class="tag ${c.mutationIds.length?'gold':''}">${c.mutationIds.length?'✦ MUTATED':c.roles.map(title).join(' / ')}</span></button>`).join('')}</div>${!creatures.length?'<p class="muted">No mutations discovered yet. Try an electric component.</p>':''}`}${selected?`<section class="panel specimen-detail" id="specimen-detail"><div class="section-title"><h2>${escape(selected.name)}</h2><span class="tag">SPECIMEN ${escape(selected.id)}</span></div>${this.stats(selected)}<form data-rename="${escape(selected.id)}" class="rename-form"><label>Name your creation<input name="name" maxlength="40" required value="${escape(selected.name)}"></label><button class="secondary" type="submit">Save name</button></form><div class="detail-grid"><div><h3>Genome</h3>${GENES.map(id=>`<div class="gene-row"><span>${title(id)}</span><meter min="0" max="100" value="${selected.genome[id].value}" aria-label="${id}"></meter><strong>${selected.genome[id].value}</strong></div>`).join('')}</div><div><h3>Abilities</h3>${selected.abilityIds.map(id=>{const a=this.content.ability(id);return `<div class="ability-detail"><strong>${escape(a.name)}</strong><p>${escape(a.description)}</p></div>`;}).join('')}</div><div><h3>Origin & traits</h3><p class="muted">Created by ${escape(selected.creator)}<br>${escape(new Date(selected.createdAt).toLocaleDateString())}<br>Seed ${selected.seed} · ${selected.history.victories} victories</p>${selected.componentIds.map(id=>`<span class="tag">${escape(this.content.component(id).name)}</span>`).join('')}<p>${selected.traitIds.map(id=>escape(this.content.traits.get(id)!.name)).join(' · ')}</p>${selected.mutationIds.map(id=>`<p class="gold-text">✦ ${escape(this.content.mutations.get(id)!.name)}</p>`).join('')}</div></div></section>`:''}`;
  }
  private journalView(state: PlayerState): string {
    return `<div class="page-heading"><div><p class="eyebrow">SCIENCE BEGINS WITH A QUESTION</p><h1 tabindex="-1">Experiment journal</h1><p class="muted">Every combination tells you something.</p></div><span class="tag">${state.experiments.length} EXPERIMENTS</span></div><div class="journal-layout"><section class="panel"><h2>Discovery codex</h2><p class="muted">${state.discoveredComponents.length} / ${this.content.components.size} components</p><div class="codex-list">${this.content.catalog.components.map(p=>`<div><span>${state.discoveredComponents.includes(p.id)?escape(p.name):'???'}</span><span class="tag">${state.discoveredComponents.includes(p.id)?title(p.rarity):'UNDISCOVERED'}</span></div>`).join('')}</div><h3>Mutations</h3>${this.content.catalog.mutations.map(m=>`<div class="discovery"><strong>${state.discoveredMutations.includes(m.id)?escape(m.name):'??? / Unknown mutation'}</strong><p class="muted">${state.discoveredMutations.includes(m.id)?escape(m.description):'Experiment with unstable or energetic biology.'}</p></div>`).join('')}</section><section class="experiment-list">${state.experiments.length?[...state.experiments].reverse().map(e=>`<article class="panel experiment"><p class="eyebrow">EXPERIMENT #${String(e.serial).padStart(3,'0')}</p><h2>${escape(state.creatures.find(c=>c.id===e.creatureId)!.name)}</h2><p class="recipe">${e.componentIds.map(id=>escape(this.content.component(id).name)).join(' + ')}</p><div class="section-title"><span class="tag">${e.compatibility}% COMPATIBLE</span><span class="tag ${e.mutationIds.length?'gold':''}">${e.mutationIds.length?e.mutationIds.map(id=>escape(this.content.mutations.get(id)!.name)).join(', '):'STABLE MANUFACTURE'}</span></div><p class="micro">Seed ${e.seed} · ${escape(new Date(e.createdAt).toLocaleString())}</p></article>`).join(''):'<section class="panel empty"><h2>A blank page. Infinite possibilities.</h2><p class="muted">Your first manufacture will be recorded here.</p></section>'}</section></div>`;
  }
  private settingsView(state: PlayerState): string {
    return `<div class="page-heading"><div><p class="eyebrow">MAKE YOURSELF AT HOME</p><h1 tabindex="-1">Workshop settings</h1></div></div><div class="settings-grid"><section class="panel"><h2>Comfort & feedback</h2>${(['sound','haptics','reducedMotion'] as const).map(k=>`<label class="option"><span>${{sound:'Sound effects',haptics:'Haptic feedback',reducedMotion:'Reduce animation'}[k]}</span><input type="checkbox" data-option="${k}" ${state.options[k]?'checked':''}></label>`).join('')}<label class="option"><span>Text size</span><select data-option="textScale" aria-label="Text size">${[1,1.15,1.3].map(v=>`<option value="${v}" ${state.options.textScale===v?'selected':''}>${Math.round(v*100)}%</option>`).join('')}</select></label></section><section class="panel"><h2>Keep your discoveries</h2><p class="muted">Your workshop lives in this browser. Export a copy to keep it safe or move it to another device.</p><div class="save-actions"><button class="secondary" data-action="export">Export save</button><label class="secondary file-button">Import save<input type="file" accept=".json,application/json" data-import="true" aria-label="Import save"></label><button class="quiet" data-action="backup">Restore previous save</button></div><p class="micro">Imports replace this workshop after validation. A backup of the previous save is retained. Diagnostics stay on this device.</p></section></div>`;
  }
  private modal(): string {
    const id=this.sequence?.id??this.revealId;if(!id)return '';
    const creature=this.workshop.creatures.find(c=>c.id===id)!;
    if(this.sequence)return `<dialog class="creation-dialog" aria-labelledby="sequence-title"><p class="eyebrow">MANUFACTURING IN PROGRESS</p><h2 id="sequence-title">${sequenceSteps[this.sequence.step]}</h2><div class="scan-orb" aria-hidden="true">ϟ</div><div class="sequence-dots" aria-hidden="true">${sequenceSteps.map((_,i)=>`<span class="${i<=this.sequence!.step?'active':''}"></span>`).join('')}</div><p class="muted">Something impossible is waking up.</p><button class="secondary" data-action="skip">Skip sequence</button></dialog>`;
    return `<dialog class="creation-dialog reveal" aria-labelledby="reveal-title"><p class="eyebrow">${creature.mutationIds.length?'✦ UNEXPECTED MUTATION':'MANUFACTURE COMPLETE'}</p><h2 id="reveal-title">${escape(creature.name)}</h2>${renderCreature(creature,this.content,this.animated())}<span class="tag">${title(creature.quality)} · ${title(creature.element)}</span>${creature.mutationIds.map(id=>`<div class="discovery"><strong>${escape(this.content.mutations.get(id)!.name)}</strong><p>${escape(this.content.mutations.get(id)!.description)}</p></div>`).join('')}<p class="muted">You made this. Now see what it can do.</p><div class="dialog-actions"><button class="primary" data-action="view-created">Meet your creature</button><button class="quiet" data-action="close">Keep experimenting</button></div></dialog>`;
  }
  private closeReveal(): void {if(this.timer)clearTimeout(this.timer);this.sequence=undefined;this.revealId=undefined;this.render();this.root.querySelector<HTMLButtonElement>('[data-action="manufacture"]')?.focus();}
  private finishSequence(): void {if(this.timer)clearTimeout(this.timer);this.revealId=this.sequence?.id??this.revealId;this.sequence=undefined;this.render();}
  private advanceSequence(): void {
    this.timer=setTimeout(()=>{if(!this.sequence)return;if(this.sequence.step>=sequenceSteps.length-1)this.finishSequence();else{this.sequence.step++;this.render();this.advanceSequence();}},450);
  }
  private async act(action: string, button: HTMLElement): Promise<void> {
    this.isError=false;
    if(action==='part') {const id=button.dataset.part!;if(this.selected.has(id))this.selected.delete(id);else this.selected.add(id);this.feedback.play('select');this.notice='';this.render(id);}
    if(action==='manufacture'&&!this.sequence&&!this.revealId) {
      const creature=this.workshop.manufacture([...this.selected],new Date().toISOString());this.inspectedId=creature.id;this.feedback.play('create');this.notice='';
      if(this.animated()){this.sequence={id:creature.id,step:0};this.render();this.advanceSequence();}else{this.revealId=creature.id;this.render();}
    }
    if(action==='skip')this.finishSequence();
    if(action==='close')this.closeReveal();
    if(action==='view-created'){this.closeReveal();this.nav.go('creatures');}
    if(action==='inspect'){this.inspectedId=button.dataset.id;this.render();this.root.querySelector('#specimen-detail')?.scrollIntoView({behavior:this.animated()?'smooth':'instant',block:'start'});}
    if(action==='export')downloadSave(this.workshop.exportSave());
    if(action==='backup'){this.workshop.restoreBackup();this.notice='Previous save restored.';this.render();}
    if(action==='dismiss'){this.notice='';this.render();}
  }
  private async change(input: HTMLInputElement): Promise<void> {
    if(input.dataset.filter){this.filter=input.value;this.render();}
    if(input.dataset.option){const options=this.workshop.state.options,key=input.dataset.option;if(key==='textScale')options.textScale=Number(input.value);else if(key==='sound'||key==='haptics'||key==='reducedMotion')options[key]=input.checked;this.workshop.updateOptions(options);this.render();this.feedback.play('select');}
    if(input.dataset.import){const file=input.files?.[0];if(!file)return;if(file.size>1_000_000)throw new Error('Save file is too large');this.workshop.importSave(await file.text());this.selected=new Set(this.content.catalog.rules.generation.requiredSlots.map(slot=>this.content.catalog.components.find(p=>p.slot===slot)!.id));this.inspectedId=undefined;this.notice='Workshop imported.';this.isError=false;this.render();}
  }
}
