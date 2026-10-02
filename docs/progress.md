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

Phase 5 is pending. Phases 6–12 are explicitly deferred under the specification's first-slice gate.
