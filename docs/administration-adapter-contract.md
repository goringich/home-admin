# Project Atlas administration adapter contract

Project Atlas is a federated administration shell. It is not the source of truth for project-owned authorization, data or mutations.

## Integration modes

- `external` — open the stable non-secret project entry in a separate browser context.
- `embedded` — render the project surface inside Atlas only when the owner repository explicitly marks frame, CSP and authentication compatibility as supported.
- `proxied` — use a bounded same-origin adapter implemented and authorized by the owner repository.
- `native-projection` — show only sanitized fields from the declared projection allowlist.
- `local-source` — expose a local runbook or source path without copying project runtime state.

Embedding and proxying are denied by default. A listed mode does not mean it is currently enabled; the adapter capability and migration state remain authoritative.

## Required ownership fields

Every surface declares:

- owner repository;
- source-of-truth responsibility;
- mutation owner;
- authorization boundary;
- supported integration modes;
- embedding capability and reason;
- sanitized projection allowlist;
- secret policy;
- fallback mode;
- migration state;
- stable launch and runbook targets.

## Security boundary

The adapter manifest and Atlas snapshot must never contain:

- signed URLs or secret query parameters;
- Telegram init-data;
- passwords, API keys, cookies or sessions;
- device or enrollment secrets;
- camera image bytes;
- private command payloads;
- VPN configuration bodies;
- customer or payment PII.

A rejected iframe, missing project session, CSP denial or unsupported browser environment must fall back to the registered safe mode. Atlas does not weaken the project authorization flow to make embedding work.

## Canonical owners

- Telegram Proxy Stack owns practical Windows enrollment, agents, telemetry, cameras, remote access and commands.
- Project Atlas owns the cross-project shell, adapter rendering and sanitized projections.
- Elizabeth owns its product administration and authorization.
- Отличный улов remains an excluded external commissioned product and is not absorbed into the personal system.

## Build and verification

`npm run snapshot`, `npm run dev:ui` and `npm run build` generate `public/administration-adapters.json` from the canonical v2 registry when it is available. A committed sanitized fallback is used in isolated CI.

`npm test` validates:

- canonical and fallback normalization;
- required ownership modes;
- Telegram Proxy Stack ownership;
- owned-product and excluded-project examples;
- rejection of signed launch URLs and secret-like keys.
