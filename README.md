# Monster Workshop

Build creatures that could never exist naturally. A mobile-first, offline-capable browser game following the supplied AI-agent implementation specification.

Requires Node.js 24+. No runtime dependencies.

```sh
npm ci
npm test
npm run test:browser
npm start
```

Open http://127.0.0.1:4173. After changing source, run `npm run build` and reload. `npm run check` performs strict type checking.

Install Chromium once for browser tests: `npx playwright install chromium`.

The game includes deterministic genetics and mutations, original modular creature visuals, manufacturing, collections, research/scanners, expeditions, inherited offspring, tactical 3v3 battles, boss phases, reactions, team synergies, an endless tower, NPC commerce/crafting, profiles, showcases and portable blueprint/creature sharing. Saves support import/export/recovery and offline reload after the first visit. Phases 0 through 11 have individual commits. Live content is the remaining planned phase. Native Android/iOS packages and online account/trading services are not included.

See [playtest instructions and developer tools](docs/playtest.md), [architecture and phase plan](docs/architecture.md), [phase evidence](docs/progress.md), [milestone review](docs/review.md) and [original specification](docs/specification.md).
