# Changelog

## Unreleased

- Added the You.Ge Assistant platform foundation: a Phase 0 re-audit
  (`FOUNDATION_AUDIT.md`), the future dashboard/SDK/multi-domain/configuration/
  security/failover architecture with a diagram and phased roadmap
  (`ASSISTANT_ARCHITECTURE.md`), and a frozen installation experience record plus
  future SDK install contract (`INSTALLATION_EXPERIENCE.md`). No dashboard, SDK
  package, central config service, failover, `staff.you.ge` integration, npm
  publish or production deployment was added.
- Applied the ui-ux-pro-max-skill design system and adopted three zero-dependency
  React Bits TypeScript + CSS components (`SpotlightCard`, `GlareHover`,
  `LatticeLoader`) in the isolated example; documented every adoption decision
  in `DESIGN_FOUNDATION.md`. Incremental install-sheet and banner accessibility
  improvements (visible focus, 44px close target, contrast-safe note,
  `aria-labelledby`/`aria-describedby`, reduced motion) preserve all behavior.
- Added `tests/install-experience.test.mjs` (DOM-harness verification of the
  existing install flow, platform detection, dismissal and worker registration)
  and `tests/foundation-contracts.test.mjs` (manifest, offline, identity,
  security and design contracts). Added an isolated `tsc --noEmit` type-check
  gate for the React example; extended `scripts/check.mjs` and CI accordingly.
  No existing tests were removed or weakened.

- Rebuilt the GitHub Pages user-facing example with an isolated React/Vite app and
  a fixed, interactive React Bits ElectricLogo assistant launcher, persistent
  logo mark, and quick actions; clarified local-storage failures in the sample
  check-in/checklist interactions and added UI regression tests. React, Vite and
  OGL remain out of the core toolkit dependencies.

## 1.0.5 — You.Ge Assistant multi-domain upgrade

- Rebranded the package and default application identity to You.Ge Assistant.
- Added centralized hostname/origin/subdomain/base-path detection and a validated,
  public domain/subdomain configuration registry with safe unknown-host defaults
  and per-domain installation/offline/sharing/push/badge/QR/diagnostic switches.
- Added a host-aware manifest response helper and Cloudflare Pages Functions
  adapter, retaining a static fallback and the existing legacy manifest ID.
- Kept the `/progressier.js` worker path, public PWA API, and legacy IndexedDB
  names. Added hostname/registered-scope/version cache namespaces and scoped
  cleanup; only explicitly public HTML is cached or migrated, and older
  shared-name caches are retained safely.
- Updated offline fallback branding/context, scoped retry URLs, and offline DNS
  recovery guidance.
- Added on-demand Cloudflare DoH A/AAAA diagnostics for the active hostname,
  response validation, bounded retries, deduplication, timeout handling and
  cautious classifications. Added Android Private DNS and iOS DNS-only recovery.
- Added Node unit tests for host resolution, manifest responses and mocked DNS
  outcomes; extended CI/static checks and refreshed multi-domain deployment docs.

### Validation status

The automated tests are mock/unit tests. They do not verify real ISP DNS
interference, deployed Cloudflare CORS behavior, production host routing, or
browser installation on physical Android/iOS devices. Those remain deployment
acceptance checks.
