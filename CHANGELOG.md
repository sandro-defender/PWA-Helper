# Changelog

## Unreleased

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
