
# Monster Workshop

## AI-Agent Implementation Specification

**Genre:** Creature Manufacturing + Collection + Crafting + RPG + Combat + Exploration + Simulation

**Platform:** Mobile-first, Android + iOS

**Primary fantasy:**

> Build creatures that could never exist naturally.

The player operates a mysterious **Monster Workshop**, collecting biological components, discovering blueprints, combining genetics, manufacturing creatures, training them, sending them on expeditions, selling them, breeding them, fighting with them, and eventually becoming the world's greatest creature engineer.

---

# 1. CORE DESIGN PRINCIPLE

Do NOT make this another Pokémon-like game where:

> Find monster → catch monster → level monster → fight monster.

The defining loop must instead be:

> **Discover → Design → Manufacture → Test → Improve → Specialize → Deploy → Discover more**

The creature itself is the player's creation.

A creature should feel like something the player **built**, not something the game handed them.

For example:

```text
Dragon Head
+
Spider Body
+
Electric Organ
+
Crystal Armor
+
Scorpion Tail
+
Wing Module
=
Thunderfang Arachnodrake
```

Another player could create:

```text
Frog Head
+
Plant Body
+
Fire Organ
+
Slime Armor
+
Bat Wings
=
Inferno Bogwing
```

Both are valid creatures.

---

# 2. THE FIVE CORE PILLARS

The entire game should be built around five interconnected systems.

## Pillar 1 — Creature Creation

The player assembles creatures from biological components.

## Pillar 2 — Genetic Discovery

Components have hidden properties, mutations, compatibility rules, and genetic traits.

## Pillar 3 — Creature Utility

Creatures aren't only combat units.

They can:

- fight
- explore
- gather
- hunt
- defend
- transport
- manufacture
- research
- breed
- scout
- excavate
- farm
- specialize

## Pillar 4 — Strategic Combat

Creature construction directly affects combat strategy.

## Pillar 5 — Endless Discovery

The player should always have something new to discover:

- components
- combinations
- mutations
- abilities
- habitats
- bosses
- recipes
- creature archetypes
- genetic traits
- secret combinations

---

# 3. GAME LOOP

The fundamental loop:

```text
Explore
   ↓
Collect Materials
   ↓
Discover Biological Components
   ↓
Research Components
   ↓
Design Creature
   ↓
Manufacture Creature
   ↓
Test Creature
   ↓
Train / Mutate / Upgrade
   ↓
Deploy
   ├── Combat
   ├── Expedition
   ├── Gathering
   ├── Research
   └── Workshop Jobs
   ↓
Obtain Better Materials
   ↓
Unlock Better Components
   ↓
Build Better Creatures
   ↓
Repeat
```

Secondary loop:

```text
Create Creature
      ↓
Discover unexpected mutation
      ↓
Research mutation
      ↓
Create improved version
      ↓
Create rare variant
      ↓
Register discovery
      ↓
Unlock new technology
```

---

# 4. THE WORKSHOP

The Workshop is the player's primary home.

It should visually evolve over the game.

## Starting Workshop

Contains:

- Creation Chamber
- Component Storage
- Research Desk
- Creature Habitat
- Training Area

## Mid-game Workshop

Unlock:

- Genetic Laboratory
- Mutation Chamber
- Advanced Incubator
- Combat Simulator
- Expedition Center
- Component Extractor
- Breeding Chamber
- Marketplace
- Automated Production

## End-game Workshop

Unlock:

- Quantum Genetics Lab
- Mythic Creation Chamber
- Dimensional Habitat
- Ancient DNA Analyzer
- Legendary Mutation Lab
- World Expedition Center
- Creature Archive
- Experimental Laboratory

The Workshop itself should become a visible representation of player progression.

---

# 5. CREATURE ARCHITECTURE

Do NOT represent a creature simply as:

```text
Creature = Species + Level + Stats
```

Instead:

```text
Creature
 ├── Genome
 ├── Anatomy
 ├── Phenotype
 ├── Stats
 ├── Abilities
 ├── Traits
 ├── Mutations
 ├── Equipment
 ├── Experience
 ├── Personality
 ├── Quality
 └── History
```

---

# 6. ANATOMY SYSTEM

Every creature is assembled from slots.

Initial slots:

```text
Head
Body
Legs
Arms
Tail
Eyes
Mouth
Wings
Armor
Core
Organ
Ability Module
```

Not every creature needs every slot.

Example:

```text
Dragon:

Head
Body
Legs
Wings
Tail
Eyes
Mouth
Core
Elemental Organ
```

Spider:

```text
Head
Body
Legs
Eyes
Mouth
Spinneret
Venom Organ
```

Advanced creatures can unlock additional anatomical slots.

---

# 7. COMPONENT SYSTEM

Every component should have data such as:

```text
ComponentId
Name
Category
Rarity
Element
BaseStats
GrantedAbilities
GrantedTraits
EnergyCost
Weight
Size
GeneticTags
CompatibilityTags
MutationChance
VisualPrefab
AnimationSet
Lore
DiscoveryRequirement
```

Example:

```text
Component:

Thunder Organ

Category:
Elemental Organ

Element:
Lightning

Effects:
+Lightning Damage
+Shock Chance
+Energy Generation

Traits:
Conductive

Tags:
Electrical
Organ
Dragon
Experimental
```

---

# 8. COMPONENT CATEGORIES

Create a large expandable taxonomy.

## Anatomical

- head
- body
- legs
- arms
- claws
- teeth
- tail
- wings
- eyes
- ears
- horns

## Defensive

- scales
- shell
- armor
- crystal skin
- bark
- slime
- bone plating

## Offensive

- claws
- fangs
- blades
- spikes
- stingers
- tentacles

## Elemental

- fire organ
- water gland
- ice core
- lightning organ
- poison gland
- shadow core
- light core
- earth core
- wind organ

## Mobility

- wings
- fins
- spider legs
- jet organs
- teleport organs
- burrowing limbs

## Utility

- mining organ
- harvesting organ
- tracking organ
- sensing organ
- carrying organ
- healing organ

## Exotic

Later-game components:

- gravity organ
- time organ
- dimensional core
- void heart
- crystal brain
- cosmic eye
- entropy gland

---

# 9. GENETIC TAG SYSTEM

Tags are extremely important.

Examples:

```text
Dragon
Reptile
Insect
Aquatic
Avian
Mammalian
Plant
Undead
Elemental
Mechanical
Crystal
Void
Ancient
Mutant
```

Components also possess tags.

This allows compatibility rules.

Example:

```text
Dragon Head
Tags:
Dragon
Reptile
Fire
Predator
```

Combined with:

```text
Fire Organ
Tags:
Elemental
Fire
Dragon-compatible
```

Produces:

```text
Fire Affinity
```

But:

```text
Fire Organ
+
Water Core
```

might produce:

```text
Steam Mutation
```

---

# 10. THE GENETIC COMPATIBILITY SYSTEM

Do not make every combination equally effective.

Each component combination should produce a compatibility score.

Example:

```text
Compatibility =

Base Compatibility
+ Genetic Synergy
+ Element Synergy
+ Anatomy Compatibility
+ Research Bonus
- Conflict Penalties
```

Result:

```text
0-29    Unstable
30-49   Poor
50-69   Stable
70-89   Compatible
90-100  Perfect
```

However:

**low compatibility must sometimes be desirable.**

A dangerous combination could produce:

```text
Mutation:
Volatile

Effect:
+80% damage
-25% stability
10% chance of self-damage
```

This makes experimentation exciting.

---

# 11. CREATURE QUALITY

Each creature receives a manufacturing quality.

```text
Broken
Poor
Common
Uncommon
Rare
Superior
Epic
Legendary
Mythic
Experimental
```

Quality should not simply mean "bigger numbers."

Higher-quality creatures can have:

- better genetic stability
- additional trait slots
- better mutation potential
- improved growth
- unique visual effects
- additional ability slots

---

# 12. GENOME SYSTEM

Each creature has a genome.

Example:

```text
Genome
├── Strength Gene
├── Vitality Gene
├── Speed Gene
├── Intelligence Gene
├── Element Gene
├── Stability Gene
├── Mutation Gene
└── Adaptation Gene
```

Each gene has a value.

Example:

```text
Strength: 72
Vitality: 61
Speed: 83
Intelligence: 44
Stability: 29
Mutation: 91
```

This creates creatures that are genuinely different.

---

# 13. PHENOTYPE

The genome should determine visible characteristics.

For example:

```text
High Wing Gene
→ larger wings

High Armor Gene
→ thicker armor

High Fire Gene
→ glowing cracks

High Mutation Gene
→ unusual anatomy
```

The visual model should therefore reflect the creature's construction.

---

# 14. PROCEDURAL CREATURE ASSEMBLY

The game should use modular creature assembly rather than creating thousands of completely hand-made models.

A creature consists of:

```text
Base Skeleton
+
Head Mesh
+
Body Mesh
+
Leg Mesh
+
Tail Mesh
+
Wing Mesh
+
Armor Mesh
+
Effects
+
Materials
```

This enables thousands of combinations from a manageable asset library.

---

# 15. VISUAL COHERENCE

Procedural assembly must NOT look like random body parts glued together.

Create:

- attachment points
- anatomical anchors
- scale rules
- rotation rules
- clipping prevention
- silhouette rules
- color inheritance
- material blending

Each component should define:

```text
AttachmentPoint
AllowedScale
AllowedRotation
ParentBone
VisualLayer
ColorProfile
MaterialProfile
```

---

# 16. CREATURE NAMING

Automatically generate descriptive names.

Examples:

```text
Thunderfang
Emberclaw
Frostwing
Venomdrake
Ironjaw
Shadowspine
Crystalbeast
Stormmaw
```

For highly unusual creations:

```text
"Experimental Creature #A-1742"
```

Players should also be able to rename creatures.

---

# 17. CREATURE PERSONALITY

Introduce personality later.

Examples:

```text
Aggressive
Curious
Loyal
Lazy
Fearful
Brave
Intelligent
Chaotic
Playful
Protective
```

Personality can affect:

- training
- expedition behavior
- idle animations
- combat behavior
- breeding
- workshop interactions

Do not make personality frustrating.

It should create character rather than punish the player.

---

# 18. ABILITY SYSTEM

Abilities are derived from components and genes.

Examples:

### Fire Breath

```text
Damage:
Fire

Cooldown:
4 sec

Effect:
Burn
```

### Web Trap

```text
Slows target
Chance to immobilize
```

### Thunder Pulse

```text
Area lightning attack
Applies Shock
```

### Regeneration

```text
Restores HP over time
```

### Gravity Crush

Late-game:

```text
Pull enemies together
Deal massive area damage
```

---

# 19. ABILITY TAGS

Every ability should have tags:

```text
Fire
Attack
AoE
Control
Defense
Healing
Mobility
Debuff
Buff
Summon
Passive
Ultimate
```

This enables synergy.

Example:

```text
Fire creature
+
Burn passive
+
Fire vulnerability ability
+
Fire damage amplifier
```

creates a coherent build.

---

# 20. CREATURE CLASSES

Avoid rigid classes.

Instead calculate functional roles.

A creature can become:

```text
Tank
Bruiser
Assassin
Mage
Healer
Support
Controller
Summoner
DoT Specialist
Speedster
Gatherer
Explorer
Defender
Hybrid
```

A player should be able to create:

```text
Tank + Fire + Support
```

or:

```text
Assassin + Poison + Mobility
```

or:

```text
Healer + Water + Summoner
```

---

# 21. COMBAT SYSTEM

For the initial version, use **small-team tactical combat**.

Recommended:

```text
3 creatures vs 3 creatures
```

This keeps combat understandable on mobile while leaving significant room for synergy.

Monster Sanctuary demonstrates how small-team combat can derive depth from team combinations, skills, and sequencing rather than simply increasing monster counts.

---

# 22. COMBAT FORMAT

Use turn-based combat initially.

Each creature has:

```text
Basic Attack
Ability 1
Ability 2
Ability 3
Ultimate
Passive
```

Combat flow:

```text
Battle Start
↓
Determine Speed Order
↓
Player chooses action
↓
Execute
↓
Status Effects
↓
Enemy action
↓
Repeat
```

Later, an optional faster combat mode can be added.

---

# 23. COMBAT DEPTH

Important systems:

- elemental advantages
- status effects
- shields
- armor
- penetration
- critical hits
- speed
- cooldowns
- energy
- buffs
- debuffs
- combo effects
- reactions

---

# 24. ELEMENT SYSTEM

Initial elements:

```text
Fire
Water
Earth
Air
Lightning
Ice
Nature
Poison
Light
Shadow
```

Later:

```text
Metal
Crystal
Void
Gravity
Arcane
Time
Cosmic
```

Avoid a simple rock-paper-scissors system only.

Use multiple interactions.

Example:

```text
Water + Lightning
→ Conductive

Fire + Oil
→ Burning

Ice + Water
→ Frozen

Fire + Ice
→ Thermal Shock

Poison + Nature
→ Toxic Growth
```

This makes creature construction affect combat.

---

# 25. STATUS EFFECTS

Initial:

```text
Burn
Poison
Bleed
Freeze
Shock
Slow
Stun
Blind
Silence
Weakness
Armor Break
Regeneration
Shield
Haste
```

Advanced:

```text
Conductive
Frozen Solid
Corrupted
Gravity Locked
Temporal
Void Marked
```

---

# 26. REACTION SYSTEM

This should become one of the game's major systems.

Abilities can interact.

Example:

```text
Water attack
+
Lightning attack
=
Chain Lightning
```

Another:

```text
Oil enemy
+
Fire attack
=
Inferno
```

Another:

```text
Frozen enemy
+
Heavy physical attack
=
Shatter
```

Another:

```text
Poison
+
Nature
=
Toxic Bloom
```

This rewards experimentation.

---

# 27. CREATURE TRAINING

A manufactured creature is not finished.

Players can train it.

Training categories:

```text
Strength
Defense
Speed
Vitality
Intelligence
Elemental Power
Control
Endurance
```

Training consumes:

- time
- food
- materials
- energy

---

# 28. LEVEL SYSTEM

Creature levels:

```text
1 → 100
```

But avoid making level the primary progression.

A level-100 creature should not automatically defeat everything.

Power should come from:

```text
Level
+
Genome
+
Components
+
Traits
+
Abilities
+
Training
+
Equipment
+
Synergy
```

---

# 29. MUTATION SYSTEM

This should be one of the game's signature mechanics.

Whenever creatures are manufactured, there is a possibility of mutation.

Examples:

```text
Extra Eye
Extra Tail
Split Head
Crystal Growth
Fire Horn
Venom Wings
Electric Fur
Regeneration Organ
Miniature Wings
Giant Claws
```

Mutations can be:

```text
Cosmetic
Functional
Statistical
Ability-granting
Behavioral
Rare
Legendary
```

---

# 30. MUTATION DISCOVERY

Do not reveal every mutation immediately.

Example:

```text
Mutation:
???

Condition:
Unknown
```

The player discovers it through experimentation.

Once discovered:

```text
Mutation unlocked:
Storm Mutation
```

This creates a research/collection layer.

---

# 31. THE CREATURE CODEX

Every discovered creature should be recorded.

The Codex contains:

```text
Creature
Components
Genome
Mutations
Abilities
Origin
First Discovery
Creator
Combat Statistics
Expedition Statistics
```

Completion should be a major long-term goal.

---

# 32. THE EXPERIMENT LOG

This is even more important than the Codex.

Record:

```text
Experiments
Failed combinations
Successful combinations
Discovered mutations
Unknown reactions
Rare outcomes
```

Example:

```text
Experiment #142

Dragon Head
+
Ice Core
+
Spider Body

Result:
Frost Arachnodrake

Mutation:
Cryogenic Venom
```

This makes the player feel like a scientist.

---

# 33. DISCOVERY SYSTEM

Components should not simply be unlocked in a linear menu.

Players should discover them through:

- exploration
- boss drops
- research
- expeditions
- experiments
- crafting
- quests
- merchants
- events
- achievements
- special conditions

---

# 34. EXPEDITIONS

Players can send creatures away.

Example:

```text
Crystal Caverns

Duration:
30 minutes

Recommended:
Mining creatures

Possible rewards:
Crystal
Rare Ore
Ancient DNA
Crystal Component
Unknown Artifact
```

Different creatures have different expedition capabilities.

---

# 35. EXPEDITION SPECIALIZATIONS

Examples:

```text
Tracker
Miner
Swimmer
Flyer
Climber
Burrower
Scavenger
Hunter
Medic
Researcher
Protector
Carrier
```

A creature built for exploration should therefore have a purpose beyond combat.

---

# 36. OPEN WORLD / BIOMES

Do not build a massive open world initially.

Use biome-based expedition zones.

Examples:

```text
Green Meadow
Crystal Caves
Volcanic Wastes
Frozen Peaks
Toxic Swamp
Storm Valley
Ancient Ruins
Shadow Forest
Floating Islands
Void Rift
```

Each biome introduces new components and mechanics.

---

# 37. BOSSES

Bosses should be component-discovery opportunities.

Example:

```text
Volcanic Titan

Drops:
Titan Heart

Rare:
Molten Core

Ultra Rare:
Titan Armor Gene
```

Bosses should require specialized creature builds.

---

# 38. CRAFTING

Crafting should have multiple layers.

## Layer 1

Basic materials:

```text
Wood
Stone
Fiber
Bone
Ore
Herbs
```

## Layer 2

Refined materials:

```text
Steel
Crystal
Toxic Extract
Dragon Scale
Elemental Essence
```

## Layer 3

Biological materials:

```text
Ancient DNA
Mutagen
Monster Stem Cells
Elemental Tissue
```

## Layer 4

Experimental materials:

```text
Void Matter
Quantum Tissue
Temporal Essence
Cosmic DNA
```

---

# 39. RESEARCH TREE

Research should unlock mechanics rather than merely +5% stats.

Branches:

```text
Anatomy
Genetics
Elements
Mutation
Combat
Expedition
Breeding
Automation
Ancient Biology
Experimental Biology
```

Example:

```text
Genetic Research I
↓
Basic Gene Analysis

Genetic Research II
↓
Genome Editing

Genetic Research III
↓
Controlled Mutation

Genetic Research IV
↓
Advanced Hybridization

Genetic Research V
↓
Artificial Evolution
```

---

# 40. BREEDING

Breeding should be introduced after the player understands manufacturing.

Two creatures can produce offspring.

Inheritance can include:

- genes
- traits
- abilities
- mutations
- components
- visual features

Example:

```text
Parent A:
High Speed
Fire Gene
Wings

Parent B:
High Defense
Crystal Gene
Armor

Offspring:
Crystal Firewing
```

Breeding should introduce genetic inheritance rather than simply creating a random third creature.

---

# 41. GENETIC DOMINANCE

Genes can have:

```text
Dominant
Recessive
Hybrid
Unstable
```

This creates long-term breeding projects.

Example:

```text
Rare Mutation:
Four Wings

Parent A:
Carrier

Parent B:
Carrier

Offspring:
7% chance of Four Wings
```

This creates meaningful experimentation.

---

# 42. CREATURE SPECIALIZATION

A creature can eventually specialize.

Example:

```text
Combat Specialist
Expedition Specialist
Research Specialist
Gathering Specialist
Breeding Specialist
Workshop Specialist
```

This gives players reasons to keep multiple creatures.

---

# 43. CREATURE EQUIPMENT

Add equipment later.

Slots:

```text
Amulet
Armor
Core
Module
Accessory
```

Equipment should enhance builds without replacing genetics.

Example:

```text
Lightning Amplifier
+25% Shock Damage
```

---

# 44. CREATURE MANAGEMENT

The player needs powerful filters.

Allow sorting by:

```text
Name
Level
Power
Rarity
Element
Role
Mutation
Genome
Expedition Skill
Combat Rating
Creation Date
```

Filtering:

```text
Show Fire
Show Rare+
Show Mutated
Show Expedition Specialists
Show Unassigned
Show Duplicate
```

---

# 45. CREATURE STORAGE

Use a laboratory-style collection interface.

Each creature card should show:

```text
Portrait
Name
Level
Quality
Element
Role
Power
Mutation Indicator
Assignment
```

Clicking opens the full creature.

---

# 46. CREATION UI

This is the most important screen in the game.

Recommended layout:

```text
┌─────────────────────────────┐
│        CREATURE PREVIEW     │
│                             │
│        [3D/2D MODEL]        │
│                             │
├─────────────────────────────┤
│ HEAD   BODY   CORE          │
│ [ ]    [ ]    [ ]           │
│                             │
│ WINGS  TAIL   ARMOR         │
│ [ ]    [ ]    [ ]           │
├─────────────────────────────┤
│ Compatibility: 82%          │
│ Stability:     74%          │
│ Mutation:      18%          │
│                             │
│       [ MANUFACTURE ]       │
└─────────────────────────────┘
```

The creature preview must update immediately.

---

# 47. CREATION FEEDBACK

When adding components:

```text
Dragon Head
+18 Fire
+8 Attack
+3 Mutation
```

When conflicting:

```text
⚠ Genetic Conflict

Water Core conflicts with Fire Organ.

Possible outcome:
Unstable mutation.
```

When synergistic:

```text
✨ Perfect Synergy

Dragon Head + Fire Organ

Unlocked:
Inferno Breath
```

---

# 48. MANUFACTURING SEQUENCE

Do not make manufacturing instant and visually boring.

Create a short cinematic sequence:

```text
Components inserted
↓
DNA scanning
↓
Energy chamber activates
↓
Genome assembly
↓
Mutation check
↓
Creature emerges
```

Keep it skippable.

The first few creations should feel special.

---

# 49. FAILED CREATIONS

Failure should be fun rather than punishing.

Possible outcomes:

```text
Unstable Creature
Mutated Creature
Unexpected Hybrid
Weak Creature
Experimental Creature
Rare Mutation
```

Avoid simply saying:

> Craft failed. Materials lost.

Instead:

> **Something went wrong...**

Then reveal an unexpected result.

---

# 50. MARKETPLACE

Players can sell creatures.

Initially NPC marketplace:

```text
Sell Creature
Buy Component
Buy Materials
Special Requests
```

Later optional player marketplace:

```text
Player creates creature
↓
Lists creature
↓
Other player purchases it
```

If multiplayer economy is implemented, all transactions must be server-authoritative.

---

# 51. CREATURE ORDERS

NPCs can request creatures.

Example:

```text
Researcher:

"I need a creature capable of surviving extreme heat."

Requirements:

Fire affinity
Heat resistance
Minimum 70 vitality
```

Reward:

```text
Gold
Research Points
Rare Component
Reputation
```

Another:

```text
Explorer:

I need a creature that can fly and carry heavy objects.
```

This makes creature construction meaningful.

---

# 52. QUEST SYSTEM

Quest types:

### Research

Discover a component.

### Engineering

Build a creature with certain properties.

### Combat

Defeat a boss.

### Expedition

Retrieve an item.

### Breeding

Produce a creature with specific genetics.

### Discovery

Find an unknown mutation.

---

# 53. DAILY / WEEKLY SYSTEM

Do not rely entirely on generic login rewards.

Create rotating experiments.

Example:

```text
Weekly Experiment

Create a creature containing:

Ice
+
Lightning
+
Wing

Possible discovery:
Storm Frost Mutation
```

Another:

```text
Weekly Boss:
Ancient Hydra

Special drop:
Hydra Regeneration Organ
```

---

# 54. COLLECTION ACHIEVEMENTS

Examples:

```text
Create 10 creatures
Discover 25 components
Discover first mutation
Create Legendary creature
Discover all Fire components
Create creature with 5 elements
Create 100 experiments
Defeat Ancient Hydra
```

---

# 55. MASTER ENGINEER PROGRESSION

The player also has an account-level progression.

Player attributes:

```text
Engineering
Genetics
Combat
Exploration
Research
Breeding
Commerce
```

These unlock new mechanics.

Example:

```text
Engineering Level 10
→ Additional component slot

Genetics Level 20
→ Advanced mutation detection

Research Level 30
→ Hidden component scanning

Breeding Level 40
→ Genetic inheritance control
```

---

# 56. MULTIPLE CURRENCIES

Avoid excessive currencies early.

Start with:

```text
Coins
Research Points
Biomass
Energy
```

Later:

```text
Ancient DNA
Mutation Essence
Void Matter
```

Every currency needs a clear purpose.

---

# 57. ECONOMY

Main currency sources:

```text
Expeditions
Creature sales
Quests
Combat
Orders
Achievements
Events
```

Main sinks:

```text
Manufacturing
Research
Training
Crafting
Workshop upgrades
Breeding
Equipment
```

Economy must be simulation-tested.

---

# 58. MONETIZATION

The game should NOT require spending to create competitive creatures.

Possible monetization:

### Cosmetic

- laboratory themes
- creature skins
- effects
- animations
- workshop decorations
- profile cosmetics

### Convenience

- additional expedition queue
- additional creature storage
- additional research queue

### Optional content

- cosmetic passes
- themed expansion packs

Avoid selling:

> "Pay $9.99 for a guaranteed strongest creature."

That destroys the experimental fantasy.

---

# 59. SOCIAL SYSTEM

Eventually allow players to:

- showcase creatures
- share creature designs
- inspect other creations
- exchange blueprints
- trade components
- participate in competitions

A creature-sharing system is especially valuable.

Example:

```text
Share Creature

[Copy Genetic Blueprint]
```

Another player can inspect:

```text
Genome
Components
Traits
Abilities
Creation recipe
```

---

# 60. CREATURE BLUEPRINTS

Allow players to save designs.

Example:

```text
Blueprint:

"Thunder Spider Dragon"

Components:
Dragon Head
Spider Body
Lightning Organ
Crystal Armor
Scorpion Tail

Requirements:
Level 20 Genetics
Lightning Organ
Crystal Armor
```

Blueprints can become collectible.

---

# 61. BLUEPRINT DISCOVERY

Some blueprints can be:

```text
Player-created
NPC
Quest
Boss
Ancient
Legendary
Secret
```

---

# 62. RARITY SHOULD APPLY TO DISCOVERY, NOT JUST STATS

Examples:

```text
Common Component
Rare Component
Ancient Component
Mythic Component
Unknown Component
```

But the most exciting rarity is:

> **Unknown combination**

Players should be excited because they don't know what will happen.

---

# 63. "WHAT IF?" SYSTEM

The UI should encourage experimentation.

When hovering/selecting components:

```text
Potential Interactions

Fire + Water
???

Fire + Crystal
High synergy

Dragon + Lightning
Potential mutation
```

Initially reveal only partial information.

Research improves prediction.

---

# 64. RESEARCH SCANNER

A scanner can analyze components.

Basic:

```text
Element:
Fire

Tags:
Dragon

Unknown:
3 properties
```

Advanced:

```text
Element:
Fire

Tags:
Dragon / Ancient / Predator

Traits:
Heat Resistant
Combustion

Hidden:
Mutation Potential
```

This gives Research progression meaningful value.

---

# 65. ENDGAME

The game must not end when the main research tree is completed.

Endgame layers:

## Endless Genetic Research

Generate new combinations.

## Procedural Expeditions

Increasing difficulty.

## Mythic Creatures

Extremely rare components.

## Infinite Workshop Levels

Continuous upgrades with diminishing returns.

## Seasonal Discoveries

New components and mutations.

## Boss Laboratory

Repeatable high-level bosses.

## Creature Challenges

Special rules.

Example:

```text
Win using:
3 creatures
No fire
At least one aquatic creature
```

---

# 66. INFINITE PROGRESSION

Avoid simple:

```text
Level 100 → Level 101 → bigger number
```

Use horizontal progression.

Players continually discover:

```text
New combinations
New builds
New mutations
New roles
New strategies
New components
```

This is much healthier for a game centered around experimentation.

---

# 67. PROCEDURAL DISCOVERY ENGINE

Eventually the game should support algorithmically generated combinations.

For example:

```text
Component A
+
Component B
+
Component C
```

generates:

```text
Combination Profile
```

based on:

```text
Tags
Elements
Stats
Compatibility
Mutation rules
Ability interactions
```

The content team can define rules rather than manually defining every possible creature.

---

# 68. IMPORTANT: DO NOT GENERATE EVERYTHING RANDOMLY

Use:

```text
Rules
+
Hand-authored combinations
+
Procedural combinations
```

Hand-author the most important discoveries.

Procedurally generate the long tail.

---

# 69. CREATURE GENERATION ALGORITHM

Conceptual pipeline:

```text
Input Components
       ↓
Validate Anatomy
       ↓
Resolve Compatibility
       ↓
Resolve Genetics
       ↓
Calculate Base Stats
       ↓
Resolve Element
       ↓
Resolve Traits
       ↓
Resolve Ability Pool
       ↓
Roll Mutation
       ↓
Calculate Quality
       ↓
Generate Phenotype
       ↓
Generate Animation Configuration
       ↓
Generate Creature ID
```

---

# 70. DETERMINISTIC CREATION

Every creature should have a reproducible seed.

Example:

```text
CreatureSeed
Genome
Component IDs
Mutation IDs
```

This allows the same creature to be reconstructed exactly.

Very important for:

- multiplayer
- trading
- blueprints
- debugging
- save games
- leaderboards

---

# 71. DATA-DRIVEN ARCHITECTURE

Do NOT hard-code individual creatures.

Use data assets/configuration.

Example:

```json
{
  "id": "organ_lightning_01",
  "category": "elemental-organ",
  "element": "lightning",
  "tags": ["electric", "organ"],
  "stats": {
    "power": 20,
    "speed": 5
  },
  "traits": [
    "conductive"
  ]
}
```

All major game content should be data-driven.

---

# 72. CORE DOMAIN MODELS

Implement models similar to:

```text
Player
Creature
Genome
Gene
Component
ComponentSlot
Trait
Mutation
Ability
AbilityEffect
Blueprint
Recipe
Experiment
ResearchNode
Expedition
Biome
Enemy
Boss
Quest
Order
Inventory
Equipment
Currency
Workshop
```

---

# 73. SYSTEM ARCHITECTURE

Separate:

```text
Presentation
↓
Application/Game Systems
↓
Domain
↓
Persistence
```

Domain should contain the rules.

Example:

```text
CreatureCreationService
GeneticCalculationService
MutationService
CombatService
BreedingService
ExpeditionService
CraftingService
ResearchService
```

This allows systems to be tested independently.

---

# 74. SAVE ARCHITECTURE

Never save only the final creature stats.

Save the source information.

Example:

```text
CreatureId
Seed
ComponentIds
Genome
MutationIds
Experience
Training
Equipment
CreationTimestamp
```

Then derived properties can be recalculated.

---

# 75. SERVER AUTHORITY

If multiplayer is introduced:

Server must own:

```text
Inventory
Currencies
Creature creation
Trading
Marketplace
Combat results
Rewards
Expeditions
Breeding
Purchases
```

Client should never be trusted for:

```text
Currency amount
Damage
Loot
Creature ownership
Creation result
```

---

# 76. OFFLINE PLAY

Mobile players should be able to make progress offline where practical.

Offline-capable:

- creature viewing
- collection management
- some crafting
- local planning
- single-player combat
- local experiments

Server reconciliation occurs on reconnect.

Never blindly trust client elapsed time.

---

# 77. MOBILE UX

The game must be designed for:

- one-handed interaction
- short sessions
- readable text
- large touch targets
- minimal menus
- fast transitions

Primary navigation:

```text
Workshop
Creatures
Explore
Research
Market
```

Avoid 15+ top-level buttons.

---

# 78. SESSION DESIGN

The player should be able to have:

### 30-second session

Collect rewards.

### 2-minute session

Start experiment.

### 5-minute session

Create and test a creature.

### 10-minute session

Complete an expedition/combat sequence.

### 30-minute session

Deeply optimize creatures and research.

---

# 79. FIRST-TIME USER EXPERIENCE

The first 10 minutes are critical.

Do NOT start with 50 components.

Start with:

```text
Dragon Head
Wolf Body
Fire Organ
Claw
Basic Armor
```

Guide the player:

```text
Build Creature
↓
Manufacture
↓
Name it
↓
Test it
↓
Send it on expedition
↓
Discover new component
↓
Build second creature
```

The player should understand the fantasy immediately.

---

# 80. TUTORIAL PHILOSOPHY

Teach through experimentation.

Instead of:

> "Here are 15 paragraphs explaining genetics."

Do:

```text
Put Fire Organ here.
```

Player does it.

```text
Something happened!

Fire Affinity discovered.
```

Then:

```text
Try another component.
```

---

# 81. VISUAL STYLE

Recommended direction:

**Stylized scientific fantasy.**

Think:

```text
Cute
+
Strange
+
Mysterious
+
Slightly grotesque
+
Colorful
+
Experimental
```

Avoid realistic horror.

The game should appeal to:

- children
- teenagers
- adults
- collectors
- optimization players

without becoming childish.

---

# 82. CREATURE DESIGN PRINCIPLE

Every creature should have a strong silhouette.

Bad:

```text
Random parts attached together
```

Good:

```text
Clear visual identity
+
Interesting silhouette
+
Readable element
+
Recognizable anatomy
+
Memorable face
```

---

# 83. ANIMATION

Creature animation is a major quality multiplier.

Each creature should have:

```text
Idle
Walk
Attack
Ability
Hit
Hurt
Victory
Defeat
Spawn
Sleep
Interact
```

Use modular animation layers wherever possible.

---

# 84. CREATURE SHOWCASE

Give players a beautiful full-screen creature viewer.

Features:

```text
Rotate
Zoom
Idle animation
Inspect anatomy
Inspect genome
Inspect abilities
View creation history
```

This is important because the player's creature is their creation.

---

# 85. CREATION HISTORY

Every creature should remember:

```text
Created:
October 2

Creator:
Player

Components:
...

Mutations:
...

First battle:
...

Victories:
...

Expeditions:
...

Kills:
...

Discoveries:
...
```

This makes creatures emotionally meaningful.

---

# 86. CREATURE AGE / LEGACY

Optional later system.

A creature can become a veteran.

Example:

```text
Veteran
Elite
Champion
Legend
```

Based on achievements rather than age alone.

---

# 87. CREATURE DEATH

Do NOT permanently destroy creatures in the main game.

Use:

```text
Defeated
Injured
Recovering
```

Permadeath can exist as an optional challenge mode later.

---

# 88. COMBAT GAME MODES

Initial:

```text
Story Battles
Expeditions
Bosses
Training
```

Later:

```text
Arena
Tower
Endless Dungeon
Weekly Challenge
Tournament
Guild Battles
```

---

# 89. ENDLESS TOWER

Procedurally generated combat.

Floor:

```text
Enemy composition
Special modifier
Reward
```

Examples:

```text
Floor 42

Modifier:
Enemies regenerate 3% HP every turn.

Reward:
Ancient DNA
```

---

# 90. CREATURE CHALLENGE MODE

Generate unusual objectives.

Examples:

```text
Win without Fire damage.

Win using three different elements.

Win with one creature.

Win using only mutated creatures.

Win without healing.

Win using a creature with less than 50% stability.
```

---

# 91. GUILD SYSTEM

Later:

Players join workshops/guilds.

Guild features:

- shared research
- guild expeditions
- cooperative bosses
- creature showcases
- guild projects
- weekly challenges

Avoid making guild membership mandatory for progression.

---

# 92. GLOBAL DISCOVERY

An exciting long-term system:

```text
Global Creature Archive
```

When players discover unusual combinations, discoveries can enter a global catalog.

Example:

```text
Community Discovery:

"Voidwing"

First discovered by:
Player123

Discovery date:
...
```

This creates a sense of a living scientific world.

---

# 93. DISCOVERY LEADERBOARDS

Do not rank raw spending.

Rank achievements:

```text
Most discoveries
Rare mutations discovered
Most experiments
Most unique components
Highest expedition distance
Boss records
```

---

# 94. LIVE CONTENT

Each update should add content in modular layers.

Example update:

## "Deep Sea Update"

Adds:

```text
12 aquatic components
8 mutations
3 new organs
2 bosses
1 biome
15 research nodes
new expedition region
new creature archetypes
```

Then:

## "Ancient Dragons"

Adds:

```text
dragon genetics
ancient components
dragon boss
dragon mutations
dragon research tree
```

---

# 95. CONTENT PIPELINE

The game must make adding content cheap.

Adding a new component should ideally require:

```text
1 data asset
1 visual asset
optional animation
optional effects
tags
stats
rules
```

Not modifications throughout the codebase.

---

# 96. DEBUG / DEVELOPER TOOLS

Build internal tools from the beginning.

Required:

### Creature Generator

Generate arbitrary creature.

### Component Browser

Inspect all components.

### Genome Editor

Modify genes.

### Mutation Tester

Force mutation.

### Combat Simulator

Run battles.

### Economy Simulator

Generate thousands of player simulations.

### Expedition Simulator

Test reward probabilities.

### Blueprint Validator

Check invalid combinations.

---

# 97. ADMIN TOOLS

If online:

```text
Search player
Inspect creature
Grant component
Grant currency
Reset quest
Inspect transactions
Inspect combat
Ban exploit
```

All administrative actions must be logged.

---

# 98. ANALYTICS

Track:

```text
Tutorial completion
First creature creation
First mutation
First expedition
First combat
Session length
Creature creation count
Experiment count
Failure rate
Component discovery
Research progression
Creature abandonment
```

Especially track:

```text
Which combinations do players attempt?
Which combinations produce frustration?
Which components are ignored?
Which systems are never used?
```

---

# 99. BALANCE TELEMETRY

Track:

```text
Average creature power
Average player level
Component usage rate
Mutation discovery rate
Win rate
Loss rate
Average experiment cost
Currency generation
Currency spending
Expedition success
Boss completion
```

Use this to balance the game instead of guessing.

---

# 100. ANTI-EXPLOIT

Test:

- offline clock manipulation
- duplicate item generation
- duplicate creature generation
- marketplace exploits
- trade duplication
- currency manipulation
- combat result manipulation
- save rollback

For online systems, authoritative validation is mandatory.

---

# 101. ACCESSIBILITY

Support:

- scalable text
- colorblind-safe element indicators
- icon + text labels
- haptic toggle
- reduced animation mode
- reduced flashing
- readable contrast
- large touch targets
- screen-reader-compatible menus where practical

---

# 102. PERFORMANCE

Target:

```text
60 FPS
```

on supported mid-range mobile devices.

Avoid:

- generating thousands of GameObjects/entities
- unnecessary allocations
- rebuilding UI every frame
- excessive particle effects
- expensive procedural mesh generation at runtime

Cache creature visuals.

---

# 103. CONTENT SCALE TARGET

Do not attempt 10,000 components at launch.

Initial target:

```text
50–80 components
20–30 abilities
30–50 traits
20–30 mutations
8–10 elements
10–15 biomes
20–30 enemy archetypes
5–10 bosses
```

But design the architecture to eventually support:

```text
500+ components
100+ mutations
hundreds of abilities
thousands of possible creature combinations
```

---

# 104. MVP

The first playable version should contain only:

## Workshop

- basic workshop
- inventory
- creature storage

## Components

Approximately:

```text
20 components
```

## Creature Creation

- 5–6 slots
- compatibility
- stats
- simple mutations
- visual assembly

## Combat

```text
3v3
```

## Exploration

```text
3 regions
```

## Research

```text
20 nodes
```

## Progression

```text
Player level
Creature level
Basic research
```

## Expeditions

```text
3 expedition types
```

## Codex

Basic discovery tracking.

---

# 105. MVP SUCCESS CRITERIA

Do NOT measure MVP success by number of features.

A player should be able to:

```text
Discover component
↓
Think of combination
↓
Create creature
↓
See unexpected result
↓
Use creature
↓
Earn new material
↓
Create another creature
```

If this loop is addictive with 20 components, the game has potential.

If it is boring with 20 components, adding 500 components will not fix it.

---

# 106. DEVELOPMENT PHASES

## Phase 0 — Technical Foundation

Implement:

- project architecture
- save system
- data system
- scene/navigation framework
- input
- audio
- UI framework
- logging
- analytics abstraction

Deliverable:

> Empty but architecturally sound game shell.

---

# Phase 1 — Creature Domain

Implement:

- Component
- Genome
- Gene
- Trait
- Ability
- Mutation
- Creature
- Creature serialization

Unit-test everything.

---

# Phase 2 — Creature Generator

Implement:

- slot validation
- compatibility
- genome generation
- stats
- mutation rolls
- quality calculation
- deterministic seed

Deliverable:

> Given a set of components, the game can deterministically create a creature.

---

# Phase 3 — Creature Visuals

Implement:

- modular anatomy
- attachment points
- scaling
- material inheritance
- creature preview
- idle animation

Deliverable:

> A generated creature looks like a coherent creature.

---

# Phase 4 — Workshop

Implement:

- component inventory
- creature storage
- creation UI
- component selection
- compatibility visualization
- manufacture sequence

Deliverable:

> Player can manufacture creatures end-to-end.

---

# Phase 5 — Basic Combat

Implement:

- 3v3 battle
- turns
- abilities
- damage
- status effects
- victory
- defeat
- rewards

Deliverable:

> Manufactured creatures have meaningful combat value.

---

# Phase 6 — Exploration

Implement:

- regions
- expeditions
- rewards
- resource gathering
- expedition requirements

Deliverable:

> Creatures are useful outside combat.

---

# Phase 7 — Research

Implement:

- research tree
- component discovery
- scanners
- hidden properties
- mutation research

Deliverable:

> Player has a long-term reason to experiment.

---

# Phase 8 — Breeding

Implement:

- parent selection
- gene inheritance
- dominant/recessive genes
- offspring generation
- breeding cooldown
- lineage

Only begin this phase after the basic creation loop is fun.

---

# Phase 9 — Advanced Combat

Add:

- reactions
- advanced status effects
- boss mechanics
- team synergy
- challenge modifiers
- endless tower

---

# Phase 10 — Economy

Implement:

- marketplace
- NPC orders
- selling
- crafting
- economy balancing
- rewards

---

# Phase 11 — Social

Implement:

- creature sharing
- blueprints
- showcases
- player profiles

Later:

- trading
- guilds
- competitions

---

# Phase 12 — Live Content

Implement:

- events
- rotating experiments
- seasonal components
- limited mutations
- new regions
- new bosses

---

# 107. TESTING STRATEGY

Every major system needs automated tests.

## Creature tests

Test:

```text
Same seed = same creature

Valid combination = valid creature

Invalid anatomy = rejected

Mutation probability = statistically correct

Genome inheritance = correct

Stats = deterministic
```

## Combat tests

Test:

```text
Damage
Armor
Critical
Status
Resistance
Healing
Death
Turn order
Reactions
```

## Economy tests

Simulate:

```text
1 day
7 days
30 days
90 days
```

Check:

```text
Currency inflation
Progression speed
Resource bottlenecks
```

---

# 108. PROPERTY-BASED TESTING

Creature generation is particularly suitable for property tests.

Guarantees:

```text
Creature must always have valid anatomy.

Creature must never have negative invalid stats.

Every component must belong to a valid slot.

Every ability must reference valid effects.

Every generated creature must serialize/deserialize correctly.
```

---

# 109. BALANCE SIMULATION

Create simulated players:

```text
Casual
Regular
Hardcore
Optimizer
Collector
Experimenter
```

Simulate progression.

Find:

```text
Where players get stuck
Where resources become excessive
Where progression becomes trivial
```

---

# 110. AI AGENT IMPLEMENTATION RULES

The coding agent MUST:

1. Read the entire repository before making architectural decisions.
2. Do not rewrite working systems unnecessarily.
3. Implement one vertical slice at a time.
4. Keep domain logic independent from UI.
5. Use automated tests.
6. Avoid magic numbers.
7. Make all content data-driven.
8. Keep systems extensible.
9. Never hard-code individual creature combinations into core logic.
10. Document important algorithms.
11. Keep save compatibility in mind.
12. Profile before optimizing.
13. Do not add external dependencies without justification.
14. Never implement placeholder systems as if they were production systems.
15. Finish each phase before starting unrelated features.

---

# 111. AI AGENT DEVELOPMENT LOOP

For every phase:

```text
Inspect
↓
Plan
↓
Implement
↓
Compile
↓
Run Tests
↓
Run Game
↓
Inspect Output
↓
Fix
↓
Refactor
↓
Document
```

The agent should not simply write code and move on.

---

# 112. ITERATIVE REVIEW LOOP

After every major milestone:

### Review 1 — Architecture

Look for:

- coupling
- duplication
- invalid dependencies
- poor abstractions

### Review 2 — Gameplay

Look for:

- boring loops
- meaningless progression
- excessive grind
- unclear decisions

### Review 3 — UX

Look for:

- confusing screens
- too many taps
- unclear feedback
- poor hierarchy

### Review 4 — Performance

Look for:

- allocations
- excessive rendering
- expensive UI
- memory leaks

### Review 5 — Content

Look for:

- repetitive components
- useless combinations
- dominant strategies

Repeat until no significant issues remain or 10 iterations are completed.

---

# 113. IMPORTANT DESIGN RULE

Never make the player think:

> "I am collecting monsters."

The dominant feeling should be:

> **"I wonder what I can create."**

That distinction defines the entire game.

---

# 114. THE IDEAL PLAYER EXPERIENCE

The player sees:

```text
NEW COMPONENT DISCOVERED

⚡ THUNDER ORGAN
```

They think:

> What happens if I put this into my dragon?

They create:

```text
Dragon
+
Thunder Organ
```

The game says:

```text
⚡ GENETIC SYNERGY DETECTED
```

The creature develops:

```text
Storm Breath
```

The player thinks:

> What happens if I add wings?

They add:

```text
Storm Wings
```

The game produces:

```text
🌩️ STORM DRAKE
```

The player sends it into an expedition.

It discovers:

```text
Unknown Crystal
```

The player wonders:

> What does the crystal do?

They research it.

Then:

```text
Crystal
+
Thunder Organ
=
????
```

And the cycle continues.

---

# 115. LONG-TERM PLAYER JOURNEY

### Stage 1 — Apprentice

Learn to manufacture basic creatures.

### Stage 2 — Engineer

Optimize components and stats.

### Stage 3 — Geneticist

Discover genes and mutations.

### Stage 4 — Researcher

Unlock hidden biology.

### Stage 5 — Master Breeder

Develop genetic lineages.

### Stage 6 — Monster Architect

Create highly specialized creatures.

### Stage 7 — Legendary Scientist

Discover ancient and exotic biology.

### Stage 8 — Experimentalist

Create creatures nobody else has seen.

---

# 116. THE ULTIMATE ENDGAME FANTASY

Eventually the player should be able to create something like:

```text
VOID DRAGON

Head:
Ancient Dragon

Body:
Crystal Titan

Wings:
Storm Seraph

Armor:
Void Shell

Core:
Cosmic Heart

Organ:
Gravity Engine

Tail:
Hydra Tail

Mutations:
Regeneration
Four Wings
Temporal Instability

Abilities:
Gravity Crush
Void Breath
Storm Chain
Regeneration
Temporal Shift
```

And the player should be able to say:

> **"I made this."**

That is the emotional payoff of the entire game.

---

# 117. FIRST IMPLEMENTATION TARGET

Do NOT begin by implementing the entire game.

Build this exact vertical slice:

```text
5 Components
      ↓
Creature Builder
      ↓
Procedural Creature
      ↓
Mutation
      ↓
Creature Preview
      ↓
3v3 Combat
      ↓
Reward
      ↓
New Component
      ↓
Build Another Creature
```

Use:

```text
Dragon Head
Wolf Body
Spider Legs
Lightning Organ
Crystal Armor
```

Possible outputs:

```text
Lightning Wolf
Thunder Spider
Crystal Dragon
Storm Arachnid
```

Then add one unexpected mutation:

```text
Electrical Overgrowth
```

If this tiny loop is genuinely fun, expand the system.

---

# 118. FINAL PRIORITY ORDER

When deciding what to build next, prioritize:

```text
1. Creature creation
2. Visual creature assembly
3. Discovery
4. Experimentation
5. Combat
6. Progression
7. Expeditions
8. Research
9. Mutation
10. Breeding
11. Economy
12. Social
13. Live content
```

Do not reverse this order.

A beautiful marketplace cannot save an uninteresting creature creator.

---

# 119. DEFINITION OF DONE

The game is ready for an initial public test when a new player can:

```text
Start game
↓
Understand the Workshop
↓
Collect components
↓
Create first creature
↓
See the creature physically assembled
↓
Discover an unexpected property
↓
Use it in combat
↓
Send it on an expedition
↓
Get a new component
↓
Want to experiment again
```

And, critically:

> **The player should voluntarily create creatures that the game never explicitly told them to create.**

That is the strongest validation that Monster Workshop's central mechanic is working.

---

# 120. AGENT'S FIRST TASK

Before implementing anything substantial, the AI coding agent must produce:

1. Architecture proposal
2. Technology choice
3. Project structure
4. Domain model diagram
5. Creature-generation algorithm
6. Save-data schema
7. Component data schema
8. Mutation architecture
9. Combat architecture
10. First vertical-slice implementation plan

Then implement **only the first vertical slice**.

Do not implement breeding, multiplayer, marketplace, guilds, live events, or advanced progression until the core creature-creation loop has been demonstrated and tested.

# END OF SPECIFICATION