# Monster Workshop

Build creatures that could never exist naturally. A mobile-first, offline-capable browser game following the supplied AI-agent implementation specification.

Requires Node.js 24+. No runtime dependencies.

```sh
npm ci
npm test
npm start
```

Open http://127.0.0.1:4173. After changing source, run `npm run build` and reload. `npm run check` performs strict type checking.

See [architecture and phase plan](docs/architecture.md), [phase evidence](docs/progress.md) and [original specification](docs/specification.md). The initial implementation intentionally covers only the first creation → combat → discovery vertical slice, as required by specification section 120.
