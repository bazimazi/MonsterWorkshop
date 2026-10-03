export const SLOTS = ['head', 'body', 'legs', 'organ', 'armor', 'wings'] as const;
export type Slot = (typeof SLOTS)[number];
export const GENES = [
  'strength',
  'vitality',
  'speed',
  'intelligence',
  'element',
  'stability',
  'mutation',
  'adaptation',
] as const;
export type GeneId = (typeof GENES)[number];
export interface Gene {
  value: number;
  dominance: 'dominant' | 'recessive' | 'hybrid' | 'unstable';
}
export type Genome = Record<GeneId, Gene>;
export const ELEMENTS = [
  'neutral',
  'fire',
  'water',
  'earth',
  'air',
  'lightning',
  'ice',
  'nature',
  'poison',
  'light',
  'shadow',
  'crystal',
] as const;
export type Element = (typeof ELEMENTS)[number];
export const STAT_KEYS = ['hp', 'attack', 'defense', 'speed', 'power', 'energy'] as const;
export type Stats = Record<(typeof STAT_KEYS)[number], number>;
export type StatModifiers = Partial<Stats>;
export const QUALITY = [
  'broken',
  'poor',
  'common',
  'uncommon',
  'rare',
  'superior',
  'epic',
  'legendary',
  'mythic',
  'experimental',
] as const;
export type Quality = (typeof QUALITY)[number];
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export interface VisualDefinition {
  mesh: string;
  anchor: string;
  scale: number;
  allowedScale: [number, number];
  rotation: number;
  allowedRotation: [number, number];
  layer: number;
  color: string;
  inheritColor: number;
}
export interface Component {
  id: string;
  name: string;
  slot: Slot;
  category: string;
  rarity: Rarity;
  element: Element;
  stats: StatModifiers;
  genes: Partial<Record<GeneId, number>>;
  abilities: string[];
  traits: string[];
  tags: string[];
  compatibleTags: string[];
  conflictTags: string[];
  energyCost: number;
  weight: number;
  size: number;
  mutationChance: number;
  visual: VisualDefinition;
  lore: string;
  discovery: 'starter' | 'battle' | 'expedition' | 'research';
}
export interface Trait {
  id: string;
  name: string;
  description: string;
  stats: StatModifiers;
  tags: string[];
}
export const STATUS_IDS = ['burn', 'poison', 'shock', 'slow', 'regeneration', 'weakness'] as const;
export type StatusId = (typeof STATUS_IDS)[number];
export type AbilityEffect =
  | { type: 'damage'; power: number; scaling: 'attack' | 'power'; element: Element }
  | { type: 'heal'; power: number }
  | { type: 'shield'; power: number }
  | { type: 'status'; status: StatusId; duration: number; chance: number; potency: number };
export interface Ability {
  id: string;
  name: string;
  description: string;
  tags: string[];
  cost: number;
  cooldown: number;
  target: 'enemy' | 'self' | 'ally';
  effects: AbilityEffect[];
}
export interface Mutation {
  id: string;
  name: string;
  description: string;
  requiredTags: string[];
  excludedTags: string[];
  chance: number;
  stats: StatModifiers;
  genes: Partial<Record<GeneId, number>>;
  abilities: string[];
  traits: string[];
  feature: string;
}
export interface History {
  battles: number;
  victories: number;
  discoveries: number;
  firstBattleAt: string | null;
}
export interface CreatureSource {
  id: string;
  signature: string;
  generationVersion: number;
  seed: number;
  componentIds: string[];
  genome: Genome;
  mutationIds: string[];
  name: string;
  experience: number;
  level: number;
  training: StatModifiers;
  equipment: string[];
  createdAt: string;
  creator: string;
  history: History;
}
export interface Phenotype {
  bodyScale: number;
  headScale: number;
  primaryColor: string;
  glowColor: string;
  features: string[];
}
export interface Compatibility {
  score: number;
  tier: 'Unstable' | 'Poor' | 'Stable' | 'Compatible' | 'Perfect';
  reasons: string[];
  mutationChance: number;
}
export interface Creature extends CreatureSource {
  anatomy: Partial<Record<Slot, string>>;
  stats: Stats;
  element: Element;
  quality: Quality;
  traitIds: string[];
  abilityIds: string[];
  roles: string[];
  phenotype: Phenotype;
  compatibility: Compatibility;
}
export interface QualityBand {
  quality: Quality;
  minimum: number;
  abilitySlots: number;
  traitSlots: number;
  growth: number;
}
export interface Resource {
  id: string;
  name: string;
  description: string;
}
export interface Region {
  id: string;
  name: string;
  description: string;
  activity: string;
  durationMs: number;
  prerequisites: string[];
  requiredTags: string[];
  minimumStats: StatModifiers;
  affinityTags: string[];
  biomass: number;
  resource: string;
  quantity: number;
  restock: string[];
  discovery: string;
  discoveryChance: number;
}
export interface Catalog {
  version: number;
  components: Component[];
  traits: Trait[];
  abilities: Ability[];
  mutations: Mutation[];
  resources: Resource[];
  regions: Region[];
  rules: {
    generation: {
      version: number;
      requiredSlots: Slot[];
      baseCompatibility: number;
      sharedTagBonus: number;
      affinityBonus: number;
      elementBonus: number;
      conflictPenalty: number;
      energyCapacity: number;
      overloadPenalty: number;
      baseMutationChance: number;
      instabilityMutationBonus: number;
      geneBase: number;
      geneVariance: number;
      geneStatFactor: number;
      qualityCompatibilityWeight: number;
      perLevelGrowth: number;
      abilityPriority: Slot[];
      baseStats: Stats;
      qualityBands: QualityBand[];
      elementColors: Record<Element, string>;
      namePrefixes: Record<Element, string>;
      nameSuffixTags: Record<string, string>;
    };
    workshop: {
      startingBiomass: number;
      starterQuantity: number;
      baseCost: number;
      maxCreatures: number;
    };
    combat: {
      armorFactor: number;
      criticalChance: number;
      criticalMultiplier: number;
      energyPerTurn: number;
      maxRounds: number;
      enemyScale: number;
      victoryBiomass: number;
      defeatBiomass: number;
      rewardQuantity: number;
      rewardComponent: string;
      experience: number;
      experiencePerLevel: number;
      resistances: { attack: Element; defense: Element; multiplier: number }[];
      opponents: { name: string; components: string[]; seed: number }[];
    };
    exploration: {
      maxAssignments: number;
      affinityWeight: number;
      adaptationWeight: number;
      speedWeight: number;
      yieldBonus: number;
      discoveryBonus: number;
      restockQuantity: number;
      experience: number;
    };
  };
}
