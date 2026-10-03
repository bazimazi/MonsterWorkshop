# Play Monster Workshop

Requires Node 24+. Install development tools with `npm ci`. Install the test browser once with `npx playwright install chromium`.

```
npm test
npm run test:browser
npm start
```

Open http://127.0.0.1:4173. Builds are static; after editing source run `npm run build` and reload. If an installed service worker still serves a previous development build, close and reopen the tab or unregister it in browser developer tools. For a hosted mobile preview, serve `dist/` on HTTPS. Native Android/iOS packaging is not included.

1. In Workshop, select Lightning Organ and optionally Spider Legs or Crystal Armor. Required head/body slots start selected; removing either disables manufacture.
2. Manufacture. Watch or skip the short sequence. A genome and optional Electrical Overgrowth mutation are generated from a reproducible seed. Meet the creature, inspect its genes/abilities and give it a name.
3. Return to Workshop and create two more specimens. Try leaving off the armor or legs and compare the forecasts and actual results.
4. In Battle, choose three of your inventions. Select an ability, tap a valid target and execute. Armor, shields, energy, cooldowns, statuses and speed affect outcomes. Basic attack always remains available. Reload mid-battle to confirm resume.
5. Win and collect rewards. Storm Wings are discovered and all starter parts are restocked. Use the new component to manufacture another creature. Check Journal for the recipe, seed and mutation history.
6. In Explore, send a creature to Green Meadow. Keep the game visible for 20 seconds, then collect fiber, biomass, starter stock and the first Herbal Organ. Manufacture a gatherer with the organ and compare fitness.
7. Send a spider-legged or crystal-armored creature into Crystal Caves (40 seconds). Recover the Crystal Chassis. After completing the caves, a winged creature can scout Storm Valley (60 seconds) for Storm Essence and Gale Wings. Try recalling a creature; it returns safely without rewards. Assigned creatures cannot fight until they return.
8. In Research, spend meadow fiber on Basic Biological Scanner, then scan three recovered components. Biology tags appear while four deeper properties remain hidden. Combine three experiments and more fiber to unlock Botanical Anatomy, then manufacture a Verdant Dragon Head specimen.
9. Gather cave crystals and research Resonance Scanner. Upgrade an existing scan to reveal gene biases, affinities, traits and mutation potential. Crystalline Anatomy unlocks Prism Organ. Both researched components can be cultivated repeatedly with gathered resources.
10. Observe a natural mutation and complete Mutation Atlas to reveal its conditions and exact recipe forecasts. After scouting Storm Valley, completing eight experiments and three advanced scans, research Controlled Mutation. In Workshop, choose an observed mutation in Mutation guidance, supply eligible biology, and manufacture it for the stated extra biomass/crystal cost. Invalid biology disables manufacturing; natural experiments remain available.
11. In Settings, export the workshop. Import the file to verify portability. Toggle reduced animation and larger text. After the first cache finishes, disconnect the network and reload: creation and combat still work.

Defeated creatures are retained and reset for the next simulator attempt. There is no entry cost or permanent injury in this slice. Habitat storage is capped at 60; recycling/selling and expandable storage belong to later phases. Currency balance is intentionally generous for experiments.

## Developer tools

```
npm run lab -- catalog
npm run lab -- generate 1742 dragon-head wolf-body lightning-organ
npm run lab -- generate 1742 --mutation=electrical-overgrowth
npm run lab -- validate 1742 dragon-head wolf-body spider-legs
npm run lab -- edit-genome specimen.json strength=72 stability=29
npm run lab -- mutations 10000
npm run lab -- combat 1000
npm run lab -- economy
npm run lab -- profile
```

Generate emits a full JSON specimen. Genome editing accepts that JSON and emits validated source data. Force-mutation is a developer-only CLI option. Combat simulations use tactical action selection, while browser loop tests also prove a basic-attack strategy can complete the beginner simulator. Economy runs model activity rates for six profiles at 1/7/30/90 days, not real player behavior or future progression.

## Gate before later phases

Specification sections 117 and 120 require this slice before expansion. Automated tests establish that the loop works; they cannot establish that it is fun. Observe new players without guiding every recipe: do they understand manufacture, notice a mutation, compare builds, and voluntarily create another combination after finding wings? Record confusion, preferred/ignored parts, repeat experiments and whether players want further discovery. The user requested expeditions/research after first-slice delivery; breeding remains gated on an enjoyable creation loop. Later social/economy systems need their own architecture and validation.

Expeditions progress only while the game is visible, including offline play. Progress is saved each second and resumes on reload. Changing the device clock or leaving the game closed does not grant rewards. Resources fund scanning, anatomy research, sample cultivation and controlled mutation.
