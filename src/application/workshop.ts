import type { ContentIndex } from '../domain/catalog.js';
import type { Creature } from '../domain/model.js';
import { deriveCreature, generateCreature, validateAnatomy } from '../domain/generator.js';
import { decodeCreature } from '../domain/serialization.js';
import { DomainError, date, string } from '../domain/validation.js';
import { hash } from '../domain/random.js';
import type { SaveRepository } from '../platform/save.js';
import type { Analytics } from '../platform/services.js';
import { decodeOptions, initialState } from './state.js';
import type { Options, PlayerState } from './state.js';
export class Workshop {
  private value: PlayerState;
  constructor(readonly content: ContentIndex, private saves: SaveRepository<PlayerState>, private analytics: Analytics, seed: number) {
    const loaded=saves.load();
    this.value=loaded??initialState(content,seed);
    if(!loaded)saves.write(this.value);
  }
  get state(): PlayerState { return structuredClone(this.value); }
  get creatures(): Creature[] { return this.value.creatures.map(c=>deriveCreature(c,this.content)); }
  cost(ids: string[]): number { return this.content.catalog.rules.workshop.baseCost+validateAnatomy(ids,this.content).reduce((sum,p)=>sum+p.energyCost,0); }
  protected transact(change: (state: PlayerState)=>void): void {
    const next=structuredClone(this.value);change(next);this.saves.write(next);this.value=next;
  }
  manufacture(ids: string[], at: string): Creature {
    date(at,'creation time');const cost=this.cost(ids), state=this.value;
    if(state.creatures.length>=this.content.catalog.rules.workshop.maxCreatures)throw new DomainError('Your habitat is full');
    if(cost>state.biomass)throw new DomainError('Not enough biomass. Complete a simulator battle to replenish it.');
    for(const id of ids)if(!state.discoveredComponents.includes(id)||(state.inventory[id]??0)<1)throw new DomainError(`No ${this.content.component(id).name} in storage`);
    const serial=state.nextSerial, seed=hash(`${state.seedBase}:${serial}`);
    const creature=generateCreature(ids,this.content,{seed,createdAt:at,creator:state.playerName,id:`creature-${serial}`});
    this.transact(next=>{
      next.biomass-=cost;next.nextSerial++;
      for(const id of ids)next.inventory[id]=next.inventory[id]!-1;
      const fresh=creature.mutationIds.filter(id=>!next.discoveredMutations.includes(id));
      creature.history.discoveries=fresh.length;
      next.discoveredMutations=[...new Set([...next.discoveredMutations,...creature.mutationIds])];
      next.creatures.push(decodeCreature(creature,this.content));
      next.experiments.push({serial,creatureId:creature.id,componentIds:creature.componentIds,seed,compatibility:creature.compatibility.score,mutationIds:creature.mutationIds,createdAt:at});
    });
    this.analytics.track('creature_created',{serial,compatibility:creature.compatibility.score,mutation:creature.mutationIds.length>0,cost});
    if(serial===1)this.analytics.track('first_creature_created');
    if(creature.history.discoveries)this.analytics.track('mutation_discovered');
    return creature;
  }
  rename(id: string, name: string): void {
    const trimmed=string(name.trim(),'name',40);
    this.transact(next=>{const c=next.creatures.find(c=>c.id===id);if(!c)throw new DomainError('Creature not found');c.name=trimmed;});
  }
  updateOptions(options: Options): void { const valid=decodeOptions(options);this.transact(next=>{next.options=valid;}); }
  exportSave(): string { return this.saves.export(); }
  importSave(raw: string): void { this.value=this.saves.import(raw); }
  restoreBackup(): void { this.value=this.saves.restoreBackup(); }
}
