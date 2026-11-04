# GitHub Pages example

This is the user-facing Staff Space sample at the GitHub Pages `/example/` route.
The header mark animates the You.Ge Assistant icon with React Bits' ElectricLogo;
the check-in and checklist remain local to the visitor's browser.

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
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).
