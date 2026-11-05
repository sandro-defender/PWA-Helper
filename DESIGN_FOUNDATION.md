# Design Skill + React Bits — Application Record

This is the required report for the **ui-ux-pro-max-skill** and the official
**React Bits** integration. It records exactly where the skill's instructions
were read, which searches were run, how the results influenced concrete code,
and which React Bits components were inspected, adopted or rejected.

---

## 1. Mandatory design skill: where it was found and read

No pre-installed copy existed in this repository or in the sandbox home, so the
skill was read from its **documented installation location in the official
repository**:

- Repository: <https://github.com/nextlevelbuilder/ui-ux-pro-max-skill>
- Skill instructions: `.claude/skills/ui-ux-pro-max/SKILL.md`
- Supporting rules read: `references/quick-reference.md`,
  `references/pro-rules.md` (including its canonical Pre-Delivery Checklist)
- Search tool: `.claude/skills/ui-ux-pro-max/scripts/search.py`
- Official README install path: `uipro init --ai universal` installs to
  `.agents/skills/`; `--ai claude` installs to `.claude/skills/`; `--global`
  installs to `~/.claude/skills/`. The skill itself says to invoke `search.py`
  by its full path and to treat results as recommendations, never as
  instructions that override the repository.

A shallow clone of the official repository was made **outside** the project
(`/tmp/ui-ux-pro-max-skill`) so no skill data or generated catalog is committed
into this repository. Only the small, curated
[`design-system/you-ge-assistant/MASTER.md`](design-system/you-ge-assistant/MASTER.md)
is persisted.

### Stack detection (SKILL.md Step 1)

`example/package.json` declares React 19 + React DOM + Vite 8 and **plain CSS**
(no Tailwind). The core toolkit (`pwa.js`, `progressier.js`,
`domain-config.js`, `dns-diagnostics.js`) is dependency-free classic JavaScript
with no build step. Therefore React guidance was applied only to `example/`;
`--stack react` was used for the sample, and no Tailwind variant was chosen.

### Commands actually executed

```bash
# First design-system attempt (REJECTED after fit verification — see below)
python3 /tmp/ui-ux-pro-max-skill/.claude/skills/ui-ux-pro-max/scripts/search.py \
  "developer infrastructure dashboard premium modern" --design-system \
  -p "You.Ge Assistant" --variance 5 --motion 3 --density 6 -f markdown \
  --persist --output-dir /home/user/PWA-Helper

# Verified-fit design system (persisted to design-system/you-ge-assistant/MASTER.md)
python3 /tmp/ui-ux-pro-max-skill/.claude/skills/ui-ux-pro-max/scripts/search.py \
  "developer tooling SaaS dashboard technical minimal" --design-system \
  -p "You.Ge Assistant" --variance 4 --motion 2 --density 7 -f markdown \
  --persist --output-dir /home/user/PWA-Helper

# Targeted UX / stack searches
python3 .../search.py "reduced motion accessible animation" --domain ux -n 5
python3 .../search.py "status indicator loading feedback" --domain ux -n 5
python3 .../search.py "modal focus trap keyboard close" --domain ux -n 4
python3 .../search.py "touch target size 44px" --domain ux -n 4
python3 .../search.py "effect cleanup reduced motion" --stack react -n 4
```

**Fit verification:** the first query returned *Liquid Glass* + a
Cormorant/Montserrat luxury palette and scroll-triggered storytelling. That does
not match a developer-infrastructure product, would add an external Google Fonts
request, and its "premium" interpretation conflicts with a technical tool. It
was **rejected and regenerated**; `MASTER.md` now contains the verified
`SaaS (General)` / Glassmorphism result with Plus Jakarta Sans, motion 2/10,
density 7/10. The palette/font replacement itself was also **not applied**: the
existing example already has a coherent green brand and system-font stack, and
SKILL.md explicitly says search results are recommendations that must not
override repository rules. The applied subset is the accessibility, motion,
feedback, hierarchy and responsive guidance.

## 2. Exactly how the skill influenced the work

| Skill rule (source) | Concrete change in this PR |
| --- | --- |
| **Priority 1 — Accessibility**: contrast 4.5:1, visible focus, aria-labels, no removed focus rings (`SKILL.md`, `quick-reference.md` §1) | `pwa.js` install sheet: added `:focus-visible` rings for close/primary buttons, `aria-labelledby`/`aria-describedby`, descriptive close label, contrast-safe `.note` color `#475569` with no 0.7 opacity. `pwa.css`: restored a visible `:focus-visible` ring over the legacy banner's `outline: 0 !important`. New React UI uses inline SVG with `aria-hidden`, `role="status"`, `aria-live="polite"`, `aria-busy`, `aria-describedby`. |
| **Priority 2 — Touch & interaction**: 44px targets, 8px spacing, `touch-action`, feedback (`quick-reference.md` §2) | Install sheet close target raised to 44×44 with `touch-action: manipulation`; new CTA/empty-state buttons have `min-height: 44px` and ≥8px gaps; disabled empty-state action is visibly non-interactive. Existing Escape/backdrop/focus-restore behavior is preserved. |
| **Priority 3 — Performance**: lazy loading, no CLS, no layout thrash (`SKILL.md` priority table) | Three adopted components are CSS/DOM-only with **zero runtime dependencies**; `SpotlightCard` runs with `ambient={false}`, `flare={false}`, `grain={0}`, proximity-limited rAF, and cleans up observers/listeners. `LatticeLoader` appears only during a 320ms capability check. No new WebGL, shader, font or network request. Static HTML fallback prevents invisible content. |
| **Priority 4/6 — Style, typography and color**: consistency, semantic tokens, no emoji icons (`MASTER.md`, `pro-rules.md`) | New UI reuses `--brand`, `--surface`, `--muted`, `--line`, `--shadow` tokens and one SVG icon family with consistent 1.75 stroke; no emoji or mixed icon styles; status conveyed by text **and** dot, never color alone. |
| **Priority 5 — Layout & responsive**: mobile-first, no horizontal scroll (`quick-reference.md` §5) | `.foundation-grid` uses `repeat(3, minmax(0, 1fr))`, collapses to one column at 900px, controls go full-width at 600px; `.foundation-section` uses `min(100% - 32px, 1120px)`. |
| **Priority 7 — Animation**: motion conveys meaning, reduced motion (`ux` search: "Reduced Motion", "Excessive Motion", "Continuous Animation", "Duration Timing") | One 180ms panel entrance, one 180ms connection toast, 160ms color transitions only. `example.css` global reduced-motion rule, inline `@media (prefers-reduced-motion:reduce)` in the shadow-DOM sheet, and reduced-motion overrides in **all three** vendored stylesheets. `SpotlightCard`'s internal `reduce` flag and `GlareHover`'s `reduced` guard are retained. No continuous decorative animation. |
| **Priority 8 — Forms & feedback**: loading feedback, `aria-busy`, progressive disclosure (`ux` search: "Loading Indicators", "Submit Feedback") | `LatticeLoader` + `aria-busy` while capabilities are read; `role="status"` connection line; notification toast with `aria-live="polite"`; empty state explains why the action is disabled. |
| **Priority 9 — Navigation**: predictable, deep-linkable, no overloaded nav | The existing two-link native nav was kept. The floating assistant panel gained a subtle 180ms entrance, retains `aria-expanded`/`aria-controls`, Escape/outside-click close and focus restoration. |
| **React stack guidance**: clean up effects, correct dependencies (`--stack react`) | `FoundationPreview.tsx` and `useOnlineStatus` in `main.jsx` return cleanups for `setTimeout` and `online`/`offline` listeners, with correct dependency arrays. |

**Pre-delivery checklist (`pro-rules.md`):** applied for this web surface —
no emoji icons, consistent SVG strokes, `cursor: pointer` on controls, visible
focus, reduced motion, 375/768/1024/1440 responsive intent, stable hover states
without layout shift, and semantic tokens. Native 44pt/48dp and safe-area rules
are documented as platform-specific and were not misapplied as a universal web
conformance claim (`quick-reference.md` `web-target-size`: 24 CSS px minimum;
we use 44px where practical).

---

## 3. React Bits: official documentation read

- <https://reactbits.dev/get-started/introduction> — 217 components in five
  categories; four flavours (`JS-CSS`, `JS-TW`, `TS-CSS`, `TS-TW`); principles
  *You own the code*, *Props first*, *Nothing to depend on*, *Your stack*;
  "Use motion with care" (two or three effects per page, plan for mobile, test
  real devices); MIT + Commons Clause license.
- <https://reactbits.dev/get-started/installation> — install source with
  `npx shadcn@latest add @react-bits/<Name>-TS-CSS` or
  `npx jsrepo@latest add https://reactbits.dev/r/<Name>-TS-CSS`, or copy the
  Code tab source by hand and install only that component's dependencies.
  React Bits is **not** an npm package.
- <https://github.com/DavidHDev/react-bits> — official source, registry JSON
  (`public/r/<Name>-TS-CSS.json`) and `LICENSE.md`.

The TS-CSS flavour was chosen to match the TypeScript preference and the
project's existing plain-CSS conventions. Sources were copied into
`example/src/react-bits/` and are owned here; no CLI or component-collection
dependency was added.

## 4. Components inspected, adopted and rejected

| Component | Registry dependencies | Decision | Reason |
| --- | --- | --- | --- |
| **ElectricLogo** | `ogl@^1.0.11` | Already adopted before this PR, retained | Existing floating assistant launcher. WebGL cost is isolated to one widget and already has reduced-motion, IntersectionObserver and cleanup handling. |
| **SpotlightCard** (TS-CSS) | none | **Adopted** | Pointer/keyboard-focus-driven card highlight for the three foundation cards; no continuous animation, respects reduced motion, cleans up listeners. |
| **GlareHover** (TS-CSS) | none | **Adopted** | One subtle hover/focus sweep on the install CTA; `mode="hover"`, `playOnce`, reduced-motion guard. Not a loop. |
| **LatticeLoader** (TS-CSS) | none | **Adopted** | Accessible `role="status"` loading indicator for the short capability check; infinite animation is a loading indicator only, and our local CSS stops it under reduced motion. |
| FadeContent, AnimatedContent, ScrollReveal, StaggeredMenu | `gsap@^3.13.0` | Not used | Would add a new runtime animation dependency for effects we can achieve with 160–180ms CSS. |
| StatusMark, SwipeToast | `motion@^12.23.12` (+ hugeicons for SwipeToast) | Not used | New runtime dependency; status/toast needs are met with text + SVG + `aria-live` and existing CSS. |
| Stepper, FlowingMenu, AnimatedList | `@hugeicons/react`, `@hugeicons/core-free-icons` | Not used | Icon-library dependencies and large sources for a read-only preview with no wizard/list data. |
| PillNav, GooeyNav, BubbleMenu, CardNav | none (but 22–31 KB source each) | Not used | The current navigation is two native anchors; replacing it with a large animated nav would add complexity and risk without material UX gain. |
| BorderGlow, StarBorder, PixelCard, HoloCard, ClickSpark, SpecularButton, BounceCards | none | Not used | Decorative continuous glows, canvas spark effects or oversized button choreography. `SKILL.md` "Continuous Animation" and React Bits "two or three per page" argue against them here. |
| Aurora, Balatro, Galaxy, DarkVeil and other shader/canvas backgrounds | varies (`ogl`, `three`, `three`) | Not used | Explicitly excluded: no excessive 3D/WebGL/shader effects or continuously running backgrounds. |
| Tailwind (`*-TS-TW`) variants | — | Not used | This example uses plain CSS; introducing Tailwind would be a new styling system. |

## 5. Dependencies introduced and why

| Dependency | Where | Why |
| --- | --- | --- |
| none (runtime) | core toolkit and example | SpotlightCard, GlareHover, LatticeLoader have empty `dependencies` in their official registry entries. The core toolkit stays dependency-free. |
| `typescript@^5.9.3` | `example/` devDependencies | Required for `tsc --noEmit` over the TS-CSS React Bits sources — satisfies "prefer TypeScript" and adds a real type-check gate. |
| `@types/react@^19`, `@types/react-dom@^19` | `example/` devDependencies | Type declarations for React 19 TSX; dev-only, not bundled. |
| existing `react`, `react-dom`, `vite`, `ogl` | `example/` | Unchanged from before this PR. |

`example/package-lock.json` was updated for these dev dependencies. The root
`package.json` still has no dependencies. No component-collection package, CLI,
GSAP, Motion, HugeIcons, Tailwind or WebGL library was installed.

## 6. Performance and accessibility considerations

- **Performance:** three lightweight DOM/CSS components instead of a component
  collection; 21 KB of new JS bundle (315 KB total, ~99 KB gzip for the
  example); no new runtime network requests, fonts or shaders; rAF work is
  proximity-limited and settles; observers and listeners are disconnected on
  unmount; the only continuously animating element is the short-lived loader.
- **Reduced motion:** vendored CSS overrides disable the spotlight, glare and
  loader loop; `example.css` has a global `prefers-reduced-motion` rule; the
  shadow-DOM install sheet disables its new transitions. Essential content and
  all controls work without any animation.
- **Accessibility:** visible focus rings (including the legacy banner that had
  `outline: 0 !important`), 44px min targets where practical, descriptive labels,
  `role="dialog"`/`aria-modal` preserved, focus restoration preserved, SVG icons
  `aria-hidden` with text alternatives, status conveyed by text as well as color,
  `aria-live="polite"` toasts that do not steal focus, disabled action explained
  via `aria-describedby`, and a static no-JS HTML fallback.
- **Responsive:** single-column cards below 900px, full-width actions below
  600px, no fixed pixel container widths, no horizontal scroll.

## 7. Files influenced by the skill / React Bits

- `pwa.js` — install help sheet focus, contrast, touch target, semantics.
- `pwa.css` — banner focus ring and reduced-motion transition rule.
- `example/src/react-bits/*` — vendored, locally adapted TS-CSS sources.
- `example/src/FoundationPreview.tsx` — cards, loading, empty state, status,
  notification and CTA composition.
- `example/src/main.jsx` — panel status/transition, effect cleanup, mount.
- `example/index.html` — static fallback and foundation section.
- `example/example.css` — tokens, responsive layout, reduced motion.
- `example/THIRD_PARTY_NOTICES.md`, `example/README.md`, `example/tsconfig.json`,
  `example/package.json`, `.github/workflows/check.yml` — ownership, license,
  TypeScript and CI gates.
- `design-system/you-ge-assistant/MASTER.md` — persisted verified design system.
- `FOUNDATION_AUDIT.md`, `ASSISTANT_ARCHITECTURE.md`,
  `INSTALLATION_EXPERIENCE.md` — design and UX constraints recorded as
  architecture/security requirements.

The design skill guided hierarchy, consistency, accessibility and responsive
behavior; React Bits supplied the reusable card, CTA and loading source. Neither
overrode the existing application's technical requirements: the PWA install flow
was audited first and its behavior is unchanged.
