# GitHub Pages example

This is the user-facing Staff Space sample at the GitHub Pages `/example/` route.
A fixed floating button shows the You.Ge Assistant icon with React Bits' ElectricLogo
and opens quick actions for network help, installation, and the workspace. The
check-in and checklist remain local to the visitor's browser.

The page also includes a read-only **Platform foundation** preview: three React
Bits `SpotlightCard` cards, a `LatticeLoader` capability-check state, a
`GlareHover` install CTA that still uses `data-pwa-install`, an accessible
empty state and connection-status notifications. It is a design reference for
the future Assistant dashboard — it registers no projects and publishes no
configuration. A static HTML fallback keeps the same information readable
without React.

## Develop and build

```sh
npm ci
npm run dev
npm run typecheck
npm run build
```

Vite serves the shared PWA runtime and icons from the repository root during
local development. The Pages workflow builds this directory and assembles its
output with the manifest, service worker, offline page and icons under the
same `/example/` scope. `base: './'` keeps the assets working beneath the
GitHub Pages project path.

React, React DOM, TypeScript types, Vite and `ogl` are isolated to this example.
They are not runtime dependencies of the You.Ge Assistant PWA toolkit. The
React Bits sources and their license notice are in [`src/`](src/) and
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md). `src/assistant-mark.png` is
a transparent white silhouette derived from the app icon so the logo remains
visible while the electric strands animate around it.

`npm run typecheck` runs `tsc --noEmit` over the TypeScript React Bits sources
and `FoundationPreview.tsx`; it is also a CI gate. The core toolkit remains
dependency-free and has no build step.
