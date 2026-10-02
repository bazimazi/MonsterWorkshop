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

The completed slice includes five starter components, deterministic genetics and mutations, modular creature visuals, transactional manufacturing, collection/journal, 3v3 tactical combat, rewards, a discoverable sixth component, save import/export/recovery and offline reload after the first visit. All phases 0–5 have individual commits. Native Android/iOS packages and phases 6–12 await core-loop playtesting, as required by specification section 120.

See [playtest instructions and developer tools](docs/playtest.md), [architecture and phase plan](docs/architecture.md), [phase evidence](docs/progress.md), [milestone review](docs/review.md) and [original specification](docs/specification.md).
