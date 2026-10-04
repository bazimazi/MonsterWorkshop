# First-slice milestone review

## Architecture

Domain generation and combat have no UI, browser, storage or clock dependencies. Application actions validate and save a cloned next state before exposing it or emitting analytics. Imported creature and battle stats are reconstructed from source genetics/content. Content, save and algorithm versions are explicit. Earlier phase-4 saves migrate without dropping creatures. New content follows tagged rules and asset keys rather than edits to combination logic. The repository was empty before implementation, so there were no working systems to replace.

## Gameplay and content

The five starter components create 8 optional-anatomy designs; the discovered wing adds another 8. All 16 anatomies across 120 seeds pass property checks. Functional Electrical Overgrowth creates a visible discovery rather than an inventory-destroying craft failure. Every battle squad is manufactured by the player; prototype opponents are data-defined. Armor, power, speed, defensive abilities and control create different decisions. The beginner simulator is deliberately forgiving: 1,000 fully equipped seeded teams won all trials with tactical action selection, averaging 3.002 rounds. This is onboarding evidence, not proof of strategic balance or fun.

Economy simulations cover casual/regular/hardcore/optimizer/collector/experimenter activity at 1, 7, 30 and 90 days. They produced no blocked manufacture before capacity. Resources accumulate after storage fills (90-day biomass: 3,030 casual, 19,230 hardcore), demonstrating the need for the **later Phase 10 economy**, new sinks and storage progression. Those original results predate the now-completed Phase 10 economy; see the final review below.

## UX and accessibility

Desktop and Pixel 7 browser scenarios cover the entire loop, navigation, immediate preview, naming, persistence and recovery. Screenshots for workshop, battle and discovery were visually inspected. SVG anatomy preserves shared anchors and palette blending. Both target and acting unit have labeled visual cues; elements/statuses use text and icons, not color alone. Controls use semantic buttons, labels, focus outlines and native modal dialogs. Touch controls are at least 48px; motion can be reduced through OS or game preferences, and text scales to 130% in browser scenarios without horizontal overflow. Mobile battle cards were compressed after visual review to reduce scrolling. Physical Android/iOS devices and screen-reader behavior still need testing.

## Performance

Before visual caching, 2,000 local Node samples averaged 0.0344ms per generation and 0.0120ms per SVG assembly. These are development-host timings, not phone benchmarks. Creature visuals now use a bounded 128-entry cache per catalog. UI updates occur on actions, not every frame; CSS drives idle motion. Storage caps at 60 specimens, combat at six units, telemetry at 200 events and battle logs at 80 messages. Every build cleans only the verified project `dist/` directory, preventing stale files from entering the revisioned offline cache. Mid-range phone 60 FPS remains a device acceptance target.

## Verification and limits

Strict compilation and automated domain, property, transaction, browser and offline tests pass. Mutation frequencies are checked over 4,000 rolls. One-time reward claims, failed-write rollback, illegal battle actions, battle resumption, corrupted saves and malformed imports are tested. Save rollback/manual editing cannot be prevented by a local single-player client. Multiplayer, online transactions, payments and server authority are absent. The deliverable is a playable 2D browser slice, not a native-store release or the entire long-term game.

The architecture, gameplay, UX, performance and content reviews identified no remaining blocker to testing the first slice. The user subsequently requested continuation; the expansion review below covers phases 6 and 7.


## Exploration and research expansion review

The implementation now gives creatures gathering, mining and scouting uses, with tags, adaptation and speed determining fitness. A new player can reach all three biomes through existing manufacturing and combat rewards. First region visits guarantee component discoveries, while later visits replenish materials and roll seeded drops. Region requirements make new anatomy useful beyond combat. Active timers pause when hidden or closed and preserve bounded progress on reload; saved wall timestamps never generate rewards.

The six-node research tree is reachable using actual gameplay actions. It consumes expedition resources and requires experiments, scans, biome completions and an observed mutation. Scanning adds progressively revealed information, and cultivation makes research components renewable. Guided manufacturing has an explicit cost and eligibility rule. Existing creature sources and natural generation are unchanged. Research and exploration mutations remain transactional, including save failure. Browser coverage now contains 22 phone/desktop scenarios; unit coverage contains 57 tests.

Research screens, progressive scanner results and new creature anatomy were visually inspected. Main navigation remains five destinations, with Journal and Settings available in the header. Full-screen mobile research has substantial scrolling; the scanner shortcut provides direct access. Native device performance, screen-reader behavior and human enjoyment still require playtests. The user subsequently authorized continuation through phases 8-12. Their implementation and evidence follow; human playtest feedback remains outstanding.


## Completed phases 8-12 review

Breeding retains parent snapshots, deterministic weighted gene inheritance and source-level lineage. Every birth recomputes during save validation, and cooldowns share bounded foreground progress. Advanced fights add elemental reactions, status control, tag synergies, boss phases, optional modifiers and persistent tower advancement. Beginner battle behavior remains stable. New biome bosses require genuine regional completions and have distinct anatomy/rewards.

The NPC economy spends existing biomass/materials, keeps discovery gates and preserves sold sources outside the active habitat. Payouts and request progression validate against archived biology. All 24 profile/day simulations completed with no blocked manufacture, keeping six active specimens while preserving up to 453 experiment records. Collector/experimenter day-90 profiles completed 177/267 orders; basic-only recipes stopped at the flight requirement. Ordinary resale is below manufacture cost. Free battle grinding remains generous (day-90 biomass 3,461 casual / 17,117 hardcore), which suits experimentation but is not a validated competitive scarcity economy.

Profiles, visiting genomes, showcases and recipes use bounded portable files. Importing a visitor or recipe grants no owned specimen, currency, stock or discovery. Blueprint manufacture retains costs and prerequisites and gives a fresh seed. Clipboard copying and file exports occur only on player action; there is no automatic upload, account backend or verified player identity.

The weekly UTC calendar now rotates three experiments, three seasonal parts and three limited mutation rules. Objective claims require new work after enrollment and validate a closed serial/time snapshot. Date changes alone yield no reward or expedition progress. Old biology retains its phenotype, and limited parental biology can survive into later generations. Five expedition regions and three bosses are fully usable through actual actions. These are bundled offline content rotations; remote operations and competitive authority are not implied.

Final verification: strict TypeScript compilation, formatting, 76 unit tests and 32 phone/desktop browser scenarios pass. Screenshots for nursery, challenges, market, shared gallery, events, seasonal creatures and a new boss were visually inspected. Coverage includes exact costs, unique claims, failed writes, source preservation, full content progression, UTC boundaries and offline reload. Native packaging, physical-phone frame timing, screen-reader audits, human enjoyment and long-term player telemetry remain release acceptance work. The requested phase plan is complete; later optional trading/guilds/competitions remain future work.

## Post-plan recovery review

Five additional browser regressions reproduced and now verify timer recovery, backup selection reset, open-screen weekly refresh, challenge squad consistency and successful status announcements after errors. Import and restore clear transient UI state; an explicit retry verifies a successful save before resuming active timers. Paused time produces no catch-up progress. Calendar and seasonal supply changes refresh without navigation, while player-selected incomplete squads remain incomplete and cannot enter a challenge.

Current automated coverage is 76 unit tests and 42 phone/desktop browser scenarios, with strict compilation and formatting checks passing. Timer recovery screenshots at 130% text size were inspected at both sizes with no horizontal overflow. The physical-device and human-playtest acceptance limits above remain outstanding.

## Keyboard navigation review

Same-screen updates preserve keyboard focus and expanded disclosures. Settings and biology choices no longer restart the tab sequence at the header, and combat selections retain their control focus. Dialog focus cycles in both directions and returns to the opener, with a heading fallback for disabled/removed controls. The first-tab skip link reaches the current screen's content without altering its route.

Current verification passes 76 unit tests and 50 phone/desktop browser scenarios, strict compilation and formatting. The eight new keyboard runs cover settings, consecutive parent choices, regions, scanning, market/habitat selectors, combat, blueprint/offspring reveals, profile text selection and visiting disclosures. Focus screenshots were visually inspected. This is browser keyboard evidence; it does not complete the outstanding screen-reader, physical-device or human-enjoyment acceptance checks.

## Persistence boundary review

Recovery no longer copies damaged primary data over a usable backup. An interrupted restore preserves both records until a retry succeeds; repeated recovery and empty primary records retain the valid backup. Blocked storage reads produce a displayed error, including during recovery exports, and exporting after reads recover preserves the exact damaged bytes.

Assignment snapshots must match owned biology, origin and growth, with valid renames and reordered JSON retained. Battle/claim IDs must belong to the workshop and precede its next serial. Browser imports with changed snapshots leave the primary and backup unchanged. These are consistency checks for the offline save format, whose broader local-editing limits are described above.

Current verification passes 82 unit tests, 56 phone/desktop browser scenarios, strict compilation and formatting. Existing migration, deterministic resume, unique rewards, live content, recovery and keyboard paths remain green. Human and physical-device acceptance work remains outstanding.

## Multiple-tab save review

One active browser document owns gameplay and recovery; waiting tabs load the latest save after ownership is released. Leaving stops the game's timers and cancels pending ownership requests. Cached-page restoration reloads before using the previous session. Save conflicts reject changes before touching the primary or backup, preserving memory and telemetry across actions, timers, retries, imports and restores. Startup and recovery races lead to a focused reload action. Storage events pause stale sessions and asynchronous imports stop after a session becomes stale or leaves.

Current verification passes 86 unit tests and 74 phone/desktop browser scenarios, strict compilation, formatting and diff checks. Ownership handoff, denial/retry, unsupported APIs, timer conflicts without storage events, empty-save startup and recovery races are covered. Persisted page lifecycle events are simulated; these tests do not certify every browser's actual back/forward cache behavior. Waiting and reload screens were inspected at 130% text size on phone and desktop. Browsers without Web Locks use conflict detection but cannot guarantee atomic simultaneous writes; use one active tab there. Human and physical-device acceptance work remains outstanding.

## Portable import review

A 1,100-record archive exports a 1,112,305-byte file that now reimports through the actual browser download without losing records or changing its three active specimens. Saves use the same 64 MiB UTF-8 ceiling for inputs and serialized writes; shared files use 200,000 bytes. Oversized writes fail before backup changes, and oversized primary data remains exportable for recovery. Browser storage quota is still separate from the file limit.

Nested source data keeps only validated gene fields, history counters/time and lineage identity/inheritance. Unknown claims are removed from owned creatures, family snapshots and visitors; valid biology, cooldowns, materials and experiment provenance remain intact. Current verification passes 89 unit tests, 80 phone/desktop browser scenarios, strict compilation, formatting and diff checks. The actual byte boundary is tested with memory storage; browser pre-read rejection uses mocked file sizes. The test runner caps concurrency at four after an existing tab-handoff timeout in the twelve-worker run. Physical-device performance, screen-reader and human acceptance work remain outstanding.
