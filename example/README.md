# GitHub Pages example

This is the user-facing Staff Space sample at the GitHub Pages `/example/` route.
A fixed floating button shows the You.Ge Assistant icon with React Bits' ElectricLogo
and opens quick actions for network help, installation, and the workspace. The
check-in and checklist remain local to the visitor's browser.

## Develop and build

```sh
npm ci
npm run dev
npm run build
```

Vite serves the shared PWA runtime and icons from the repository root during
local development. The Pages workflow builds this directory and assembles its
output with the manifest, service worker, offline page and icons under the
same `/example/` scope. `base: './'` keeps the assets working beneath the
GitHub Pages project path.

React, React DOM, Vite and `ogl` are isolated to this example. They are not
runtime dependencies of the You.Ge Assistant PWA toolkit. The ElectricLogo
source and its applicable license notice are in [`src/`](src/) and
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md). `src/assistant-mark.png` is
a transparent white silhouette derived from the app icon so the logo remains
visible while the electric strands animate around it.
