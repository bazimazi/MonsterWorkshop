# Phase evidence

## Phase 0 — Technical foundation

Implemented strict TypeScript build, static server/shell, typed navigation, JSON loading, Web Audio/haptic feedback, bounded local analytics, logging, versioned persistence with validation, export/import and backup recovery. Architecture, content schema, save schema, domain diagram and algorithms were recorded before domain implementation.

Validation: `npm test` compiles the project and runs platform tests; `npm start` serves the compiled shell. Subsequent phases extend the same architecture.

## Phase 1 — Creature domain

Implemented typed components/slots, genes/genome, traits, effects/abilities, mutations, quality, phenotype, creature source/history and serialization. Six data-defined components include the five initial parts and the later battle discovery. Catalog decoding validates references, probability bounds, effect types, anatomy, visual ranges and balance configuration. Creature imports preserve source provenance and reject unsupported versions. No UI dependence in domain rules.

Validation: domain tests cover valid catalog and serialization, every gene, invalid anatomy, duplicate IDs, bad references/costs/visuals, future versions and corrupt history. Desktop/mobile shell loads the validated catalog.

## Phase 2 — Creature generator

Implemented normalized slot validation, symmetric compatibility with explanations, seeded genome variation, component/trait/mutation stats, finite quality capacities, functional roles, elemental names and phenotype. FNV-1a and Mulberry32 arithmetic are documented. Creatures retain source seeds and generator versions; derived properties are reconstructed. Tag-driven Electrical Overgrowth changes genes, traits, power and visible features. The developer force option rejects ineligible mutations; player predictions do not reveal seeded outcomes.

Validation: same seed/anatomy gives identical results, input order is normalized, all 16 anatomies across 120 seeds retain valid stats and roundtrip, and 4,000 manufacturing rolls match forecast within two percentage points. Browser shell displays a generated specimen.

## Phase 3 — Creature visuals

Implemented original modular SVG anatomy for the wolf chassis, dragon head, spider limbs, lightning organ, crystal plating, storm wings and electrical spines. Shared skeleton anchors, bounded scale/rotation and inherited palettes keep attachments coherent; spider limbs replace the default paws. Preview updates immediately, with idle breathing and an OS reduced-motion fallback. The renderer is separate from domain generation and verifies asset coverage.

Validation: 18 unit tests pass. Renderer tests cover every part/anchor, mutation features, escaping and palette blending. Four desktop/mobile browser scenarios pass. Both screenshots were visually inspected: the head, torso, armor, organ and wings remain attached and readable at phone and desktop sizes, with no horizontal overflow.

## Phase 4 — Workshop

Implemented transactional inventory/currency spending, distinct specimen identities, locked discoveries, habitat, immediate anatomy selection/compatibility forecasts, skippable manufacturing and mutation reveal. Creatures can be named, filtered and inspected with genome, abilities, traits and origin. Every manufacture writes an experiment and codex discovery. Settings support sound/haptics, reduced motion, scalable text, validated file import/export and backup recovery; corrupt saves are preserved visibly.

Validation: 23 unit tests and 10 desktop/mobile browser scenarios pass. Tests cover exact spending, deterministic provenance, exhausted/locked inventory, imports, rename/settings, failed-write rollback, full creation/rename/reload/journal flow, invalid anatomy, accessibility options and corrupted-save recovery. Workshop screenshots were visually inspected at both sizes. Touch targets and icon-plus-text labels stay readable, including the larger-text setting.

## Phase 5 — Basic combat and closed discovery loop

Implemented pure 3v3 turn resolution, data-defined actions/AI, armor/resistance/critical damage, shields/healing, burn/poison/shock/slow/weakness/regeneration, energy and exact cooldown timing. Battles persist at each player action and resume deterministically. Victory/defeat/retreat retain creatures. Reward claims are transactional and unique, grant experience/history, restock materials and discover Storm Wings. Players can immediately manufacture a winged specimen. A revisioned service worker enables offline reload and play. CLI tools inspect content, generate/validate creatures, edit genes, force/test mutations, simulate combat/economy and profile generation/visuals.

Validation: 40 unit tests plus 16 desktop/mobile browser scenarios pass, including the full three-creature manufacture → combat → reload → reward → new component → fourth manufacture loop, shield targeting, offline manufacture and actual exported-file reimport. The property sweep covers 1,920 creations; mutation testing covers 4,000 rolls; combat tests cover 100 seeded deterministic battles and developer simulations cover another 1,000 battles. Economy simulations cover six profiles at 1/7/30/90 days. Screenshots were inspected. [Milestone review](review.md) records the findings and limits; [playtest guide](playtest.md) makes the result reviewable.

## Phase 6 - Exploration

Implemented Green Meadow gathering, Crystal Caves mining and Storm Valley scouting as data-defined regions. Region prerequisites, anatomy tags and minimum stats determine eligibility; affinity tags, adaptation genes and speed determine yields. Each region guarantees its first component discovery, then uses deterministic seeded drop chances. Herbal Organ, Crystal Chassis and Gale Wings are usable alternatives with original anchored visuals. Resource storage, starter restocking, experience, safe recall, assignment exclusion and immutable reward reports close the exploration/manufacturing loop.

Progress uses bounded foreground monotonic intervals and is persisted transactionally. Hidden or closed games pause; wall-clock jumps and timestamps cannot generate elapsed rewards. Earlier schema-1 saves migrate empty expedition fields without changing genomes or experiment records. Local save editing remains possible, as with all single-player persistence.

Validation: 50 unit tests and 18 desktop/mobile browser scenarios pass. Coverage includes the route through all three regions from a fresh workshop, specialist yield, unmet requirements, battle/expedition exclusion, exact resume, wall-clock changes, unique claims, forged snapshots, failed-write rollback and real UI discovery/manufacturing with same-slot replacement. Both expedition screenshots were visually inspected; phone navigation and content stay within the viewport.

## Phase 7 - Research

Implemented six data-defined research nodes across Genetics, Anatomy, Elements and Mutation. Costs consume biomass and expedition resources; prerequisites require region completions, experiments, scans and observed mutations. Basic scanning reveals primary tags; Resonance scanning reveals full biology tags, gene biases, affinities/conflicts, inherited traits and mutation potential. The scanner returns progressively scoped projections rather than exposing hidden values in the UI. Scan upgrades retain one record per component and do not consume specimens.

Botanical and Crystalline Anatomy unlock Verdant Dragon Head and Prism Organ samples plus renewable cultivation recipes. Mutation Atlas reveals conditions of observed mutations and enables precise recipe forecasts. Controlled Mutation allows paid, eligible manufacturing of a discovered mutation; the preview shows its known phenotype and the experiment records the guided origin. Natural mutation generation is unchanged. All spending, discoveries and analyses are transactional, and older saves receive empty research fields and natural-experiment defaults without changing creature sources.

Validation: 57 unit tests and 22 desktop/mobile browser scenarios pass. A fresh-save domain progression completes all six nodes through actual manufacture, battle, gathering and scanning actions, then creates a guided mutant and cultivates additional samples. Tests cover exact spending, unmet objectives, duplicate research/scans, hidden-data projections, migration, forged capabilities, source preservation, and failed-write rollback. Browser scenarios verify basic-to-advanced scans, reload, new head manufacturing, and guided mutation via a gameplay-derived imported save. Research, scanner and new creature screenshots were visually inspected on phone and desktop.

## Phase 8 - Breeding

The user's continuation instruction authorizes proceeding past the earlier playtest gate. Implemented two-parent selection, seeded anatomy and gene inheritance, dominant/recessive weighting, bounded variation, eligible mutation inheritance, offspring creation, persistent foreground cooldowns and a family album. Parent snapshots and per-gene origin preserve lineage; save decoding recomputes offspring provenance and rejects cyclic families or forged genes. Breeding consumes biomass/fiber, retains parents and consumes no component stock. Older source records remain unchanged.

Validation: 60 unit tests and 24 phone/desktop browser scenarios. Tests cover dominance distribution, deterministic inheritance, exact spending, unchanged parents/stock, cooldown resume, invalid lineage and failed-write rollback. Nursery screenshots were inspected. Phase 8 is separately committed; phases 9 through 12 follow.

## Phase 9 - Advanced combat

Implemented data-defined elemental reactions, wet/conductive/frozen/armor-break/haste statuses, tag-based team bonuses, Storm Hydra's health-triggered shield/regeneration/power phase, optional armored/volatile challenges, and a saved endless tower. Challenge rules affect advanced battles; beginner fights retain their existing behavior. Victory claims grant unique boss discoveries, resources and tower progression; retreat/defeat retain the floor. Challenge arena shows selected team synergy and all rules.

Validation: 62 unit tests and 26 phone/desktop browser scenarios pass. Tests fight and resume the Hydra through its phase, collect Tidal Organ once, advance tower floors, verify reactions and synergy stats, reject corrupt challenges and retain floors after retreat. Browser tests select a modifier, resume and retreat a six-unit tower battle. Challenge screenshots were visually inspected.

## Phase 10 - Economy

Implemented discovered-component/material purchases, resource crafting, creature selling, exact price previews, rotating biology/genetics/stat-based NPC requests, bonuses and an immutable commerce ledger. Sold sources remain in the journal/lineage but release habitat capacity and cannot participate in gameplay. At least one companion is retained. All credits/spending are transactional and duplicate deliveries or sales are rejected. Earlier saves migrate an empty ledger.

Validation: 66 unit tests and 28 phone/desktop browser scenarios pass. Tests verify exact purchase/crafting spending, discovery locks, sales provenance, request sequence/rewards, assignment exclusion, reload, corrupt sale rejection and failed-write rollback. A 16-anatomy comparison rejects immediate manufacture/resale and purchase/manufacture/resale profit. The developer economy simulation now exercises sales and requests across six profiles at 1/7/30/90 days. Marketplace screenshots were inspected.

Simulation result: all 24 profile/day scenarios completed without blocked manufacture. Selling kept the active habitat at six while the archive retained up to 453 experiments. Collector/experimenter profiles fulfilled 177/267 requests by day 90; basic-only profiles stopped at the flying request, giving advanced anatomy a purpose. Biomass remains deliberately generous (3,461 casual / 17,117 hardcore at day 90); free repeatable battles remain the primary source. This is an experimentation economy, not a scarcity or multiplayer currency model.

## Phase 11 - Social

Implemented editable engineer profiles, three-specimen showcases, creature/blueprint/showcase exports, clipboard blueprint copying, file/pasted-JSON imports, a visiting gallery with genome/recipe/traits/ability inspection, recipe libraries and paid blueprint manufacturing. Visiting specimens can supply recipes without becoming owned inventory. Exports carry a bounded, explicit sharing format/version separate from saves. Duplicate imports, invalid anatomy, unsupported versions and library limits fail before mutation. Sales remove departed specimens from the active showcase.

Validation: 70 unit tests and all 30 phone/desktop browser scenarios pass (the new pair was rerun after correcting the biography label and gallery layout). Tests exchange profiles and exact biology, check recipe recreation with a fresh seed and exact spending, retain discovery locks, grant no resources/ownership on import, verify additive migration and failed-write rollback. Actual downloaded showcase files reimport in the browser; a saved blueprint creates a second owned creature while the visiting specimen remains separate. Screenshots were inspected and the visiting genome layout was expanded for phone readability.

## Phase 12 - Live content

Implemented a data-defined weekly UTC calendar with Aurora/Cinder/Bloom experiments, enrollment baselines, observed manufacture/expedition objectives, unique reward claims, upcoming rotations and seasonal discoveries. Seasonal market/crafting supply returns with its event. Three limited mutations affect genes, stats and visible phenotype; natural/guided manufacture is event-bound while existing specimens and parental inheritance retain their biology. Aurora Organ, Cinder Heart and Spring Blossom Crown have original modular visuals. Frozen Peaks and Ashen Grove provide two new expedition anatomies and unlock Frost Matriarch/Cinder Chimera, each with its own anatomy, phase and reward. Boss discovery actions select the actual recovered part.

Validation: 76 unit tests and 32 phone/desktop browser scenarios pass. Gameplay tests complete all three events, explore both new regions and defeat both new bosses through actual actions. Coverage includes UTC boundaries, enrollment without retrospective credit, unique claims, replay/forged reward rejection, season availability, mutation behavior and off-season inheritance, additive migration, broken content/visual references and failed-write rollback. Browser tests enroll, manufacture twice, claim/reload, build an icy flyer, survey Frozen Peaks and enter the Matriarch fight. Changing the calendar alone yields no biomass. Event, seasonal anatomy and boss screenshots were visually inspected. Calendar and shared-blueprint inspection are available in the developer CLI.

All implementation phases 0 through 12 are complete and individually committed. The shipped target is the offline browser game. Optional future trading/guilds/competitions, account services and native-store packaging are outside these phase deliverables. Human playtesting, physical-device performance and long-term balance remain release acceptance work; automated completion does not certify enjoyment.

## Post-plan verification — Recovery and live UI

Reproduced five defects with browser regressions before applying fixes: a failed timer write stayed paused after importing a valid save; restoring a backup retained selections from the newer workshop; an open calendar/marketplace retained the previous week's availability; direct challenge navigation showed an empty squad while starting with an implicit team; and successful form/file submissions retained an earlier error announcement.

Imported and restored saves now share a reset of transient selections, battle controls, manufacture dialogs and timer state. A visible recovery message provides an explicit save retry; progress resumes only after the write succeeds, with no catch-up for paused time. Calendar, marketplace and manufacture forecasts refresh at weekly boundaries and when returning to a visible game. Challenge navigation initializes the same eligible squad as Battle, displays its actual synergy and disables entry with an incomplete selection. Successful notices consistently clear the previous error state. Departed parents are removed from nursery selection.

Validation: all 76 unit tests and 42 phone/desktop browser scenarios pass, with strict TypeScript and formatting checks. The five new scenarios failed against the previous implementation and pass at both viewport sizes. Recovery coverage includes persistent storage failure, failed and successful retries, import recovery, unchanged reward/progress while paused and a 130% text-size overflow check. The recovery screenshots were visually inspected on phone and desktop; the retry control remains readable. These fixes are committed separately from the completed phase plan.

## Post-plan verification — Keyboard navigation

Reproduced focus loss after setting changes, biology selections, combat actions and form submissions. Closing blueprint/offspring reveals also used the workshop manufacture control as a return target, leaving no useful focus on other screens. Same-screen rendering now retains the focused control and text selection through stable, escaped element/form identities. Expanded genetic interactions, battle logs and visiting-genome/paste disclosures retain their state during updates.

Creation dialogs cycle Tab and Shift+Tab within their controls, support Escape and return focus to the actual opener. If that opener is disabled or absent after the action, the page heading receives visible focus instead. A first-tab skip link moves directly to the current page content without changing hash navigation. Normal route changes continue to focus the new heading. No game rules or save formats changed.

Validation: 76 unit tests and 50 phone/desktop browser scenarios pass, with strict TypeScript and formatting checks. Four new keyboard scenarios initially failed against the previous implementation; they now cover skip navigation, consecutive parent selections, settings/region/scanner/market/habitat controls, combat targeting/execution, modal focus cycling and return, resting parents, profile submission and expanded visiting panels. Tests exercise larger text and preservation of text selection. Skip-link and dialog focus screenshots were inspected. These browser checks improve keyboard operation; physical devices and actual screen-reader sessions remain acceptance work.
