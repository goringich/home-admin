# Project Atlas — Architecture Universe

Architecture is a native read-only Atlas workspace at `#/architecture`.

It replaces the standalone Architecture Observatory as the normal human UI. The old standalone server remains useful only for source/debug verification.

## Data flow

```text
__home_organized tracked contracts/censuses
              +
Atlas local snapshot/project inventory
              |
              v
scripts/build-architecture-universe.mjs
              |
              v
public/architecture-universe.json
              |
              v
Project Atlas #/architecture
```

The builder consumes the core architecture graph, Technology Census, Satellite Census, owner repository census, Product Registry and the normal Atlas project snapshot. It performs no network access or shell execution.

## Views

- **System Universe** — radial mental model centered on authorities and critical control components, with products/projects, technologies, satellites and repositories arranged on progressively wider orbits.
- **Layer Map** — deterministic 11-layer engineering view over the same complete composed model.

## Filters

Everything, Core, Products, Projects, Technology, Repositories, Satellites, Live gaps and Archive.

## Safety

Architecture is visualization only. It cannot mutate runtime, approve work, execute commands, read secrets or become a second mission authority. Project Atlas remains Mission Control; Mission Ledger and codex-orchestrator retain their existing authority roles.
