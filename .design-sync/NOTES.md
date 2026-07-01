# design-sync notes — DP Travaux

## Shape: this is a Next.js APP, not a component library
- No package `dist`/`exports`; there is **no library build**. The sync bundles a hand-written
  barrel `.design-sync/ds-entry.tsx` (re-exports the 3 reusable components as named exports) via
  `--entry ./.design-sync/ds-entry.tsx`. The barrel's walk-up gives the converter a valid PKG_DIR
  (repo root) — without `--entry` it looks for `node_modules/dp-travaux` and dies.
- Only 3 components are genuinely portable: **SealIcon, AuthForm, AddressAutocomplete**
  (`cfg.componentSrcMap`). Everything else in the app is route/page code coupled to Next
  (App Router, server actions, internal `/api` fetches) — not design-system material.

## Next-runtime coupling → shims (critical)
- `AuthForm` imports `next/navigation` + `next/link`. Bundled standalone they throw
  `ReferenceError: process is not defined` at IIFE eval, which fails **every** export (even
  SealIcon) with `[BUNDLE_EXPORT]`.
- Fix: static shims in `.design-sync/shims/{next-navigation,next-link}.tsx`, aliased via
  `.design-sync/tsconfig.sync.json` (set as `cfg.tsconfig`; esbuild honours its `paths`).
  If the components add new app-only imports (more `next/*`, `process.env.*`, server actions),
  add a shim + alias the same way.

## CSS: Tailwind MUST be compiled
- `src/app/globals.css` has `@tailwind` directives + `@layer components { .dp-* }`. Shipping it raw
  omits generated utilities AND purges the `@layer` `dp-*` classes.
- `cfg.buildCmd` compiles it to `.design-sync/compiled.css` (gitignored — regenerated each sync),
  and `cfg.cssEntry` points there. **Do NOT** add `--content` with brace globs (`{ts,tsx}`) — it
  broke the scan and silently purged `.dp-btn-primary`/`.dp-card` (symptom: forms/buttons render
  unstyled in capture). Rely on `tailwind.config.js`'s own `content` globs (no `--content`).
- Fonts (Spectral, IBM Plex Sans/Mono) load via a remote `@import` → `[FONT_REMOTE]`, runtime. Fine.

## Props
- The barrel default→named re-export loses inline prop types, so auto-extraction yields
  `[key: string]: unknown`. Real contracts are hand-written in `cfg.dtsPropsFor` for all 3 — keep
  them in sync with the component signatures.

## Known render warns
- None currently. (SealIcon's earlier `[RENDER_THIN]` was the pre-authoring floor render; the
  authored `previews/SealIcon.tsx` resolves it.)

## Re-sync risks (watch-list)
- **`compiled.css` is gitignored** — a re-sync MUST run `cfg.buildCmd` (the Tailwind compile) before
  the converter, or `cssEntry` is missing/stale. The driver runs `buildCmd` when source changed;
  when in doubt, run it.
- **playwright is pinned to 1.60.0** in `.ds-sync/` to match the cached chromium build **1223**
  (`$LOCALAPPDATA/ms-playwright`). If that cache upgrades, install the matching playwright or the
  render check fails to launch. Validate/capture were run with `PLAYWRIGHT_BROWSERS_PATH` set to
  that cache.
- **Shims are frozen snapshots** of Next's API surface — if a component starts using a Next hook not
  in `shims/next-navigation.tsx`, its preview will error; extend the shim.
- **Adding components**: extend `ds-entry.tsx` + `componentSrcMap` + `dtsPropsFor` together, and
  expect app-coupled ones to need shims. Prefer genuinely reusable pieces.
