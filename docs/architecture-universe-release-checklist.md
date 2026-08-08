# Architecture Universe release gates

Before merge:

- Node tests pass on exact PR head.
- TypeScript production build passes.
- Architecture builder remains network-free and shell-free.
- `#/architecture` renders inside the Project Atlas bundle.
- System Universe and Layer Map both render.
- Search, filters and node inspector work.
- Missing `__home_organized` architecture source fails soft to a partial projection rather than crashing Atlas.
- With the canonical source available, the projection includes core graph, Technology Census, Satellite Census, repository census, Product Registry and Atlas local project inventory.
- Architecture remains read-only.

After merge on CachyOS:

- run `npm run snapshot` from the Atlas repository;
- confirm `public/architecture-universe.json` reports broad coverage rather than the old 49-node skeleton;
- open `#/architecture` and verify both visual modes;
- compare live-gap counts against the bounded runtime census;
- keep the standalone Observatory server disabled unless debugging source composition.
