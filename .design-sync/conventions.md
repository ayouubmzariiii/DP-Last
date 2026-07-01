# DP Travaux — design system conventions

Warm-paper French administrative UI (the "Déclaration Préalable" tool). Three React
components ship on `window.DPTravaux`: **SealIcon**, **AuthForm**, **AddressAutocomplete**.
The design language is primarily a **CSS layer** — a `dp-*` component-class vocabulary + `t-*`
text-colour classes + `--*` CSS-variable tokens, layered on Tailwind utilities. Build screens
by composing these classes; reach for the three components where they fit.

## Setup — no provider needed
The components are self-contained (no context/theme provider). Styling comes entirely from the
bundled **`styles.css`** (it `@import`s the tokens, the Tailwind utilities, and `_ds_bundle.css`)
— it's already loaded for every design. Put page content on the paper background:

```jsx
<div style={{ minHeight: '100vh', background: 'var(--paper)', color: 'var(--ink)' }}>
  {/* build with dp-* classes + the components below */}
</div>
```

Fonts load at runtime via a remote `@import` in `styles.css`: **Spectral** (serif — headings/accents,
`var(--hf)`), **IBM Plex Sans** (body), **IBM Plex Mono** (`var(--mf)` — labels/eyebrows). Don't
restyle type with raw font stacks; use the classes below, which already bind these families.

## The styling idiom — real vocabulary

**Tokens** (`var(--*)`): surfaces `--paper` `--surface` `--surface-2` `--field` `--field-ro`;
text `--ink` `--ink-2` `--muted` `--faint`; lines `--line` `--line-2` `--line-3`; accent (green)
`--ac` `--acd` (dark) `--act` (tint bg) `--acb` (tint border); fonts `--hf` `--mf`.

**Component classes** (`dp-*`) — compose these, don't reinvent:
| Family | Classes |
|---|---|
| Surface / layout | `dp-card` · `dp-spec` (accent-edged card) · `dp-rule` (divider) · `dp-page-head` `dp-page-title` `dp-page-sub` `dp-eyebrow` |
| Buttons | `dp-btn-primary` (green) · `dp-btn-secondary` · `dp-btn-outline` |
| Forms | `dp-form-group` · `dp-label` · `dp-input` (`dp-input--ro` read-only) · `dp-select` · `dp-check-card` |
| Feedback | `dp-alert` + `is-error` / `is-warn` / `is-ok` / `is-info` · `dp-chip` + `is-ok` / `is-missing` · `dp-spinner` (`dp-spinner-sm` / `dp-spinner-lg`) |
| Text / meta | `dp-section-title` · `dp-meta` · `dp-metric` · nav `dp-stepper` `dp-substep` `dp-menu` `dp-menu-item` `dp-tool-btn` |

**Text-colour classes** (`t-*`): `t-ink` `t-ink2` `t-muted` `t-faint` `t-accent` `t-error` `t-warn`
`t-ok`; `accent` styles an inline word in the serif accent colour inside a heading.

State modifiers are the bare `is-*` classes above (`is-error`, `is-ok`, `is-current`, `is-done`, …),
always used alongside their base (`dp-alert is-warn`, `dp-chip is-missing`).

## Where the truth lives
Read the bundled **`styles.css`** and its imports (tokens + `_ds_bundle.css`) for the authoritative
class/token definitions, and each component's `components/general/<Name>/<Name>.prompt.md` +
`.d.ts` for its API. Source of record in the repo: `src/app/globals.css`.

## Idiomatic snippet
```jsx
import { AuthForm, AddressAutocomplete, SealIcon } from 'dp-travaux'

<div style={{ minHeight: '100vh', background: 'var(--paper)' }}>
  <div className="dp-card" style={{ maxWidth: 440, margin: '40px auto' }}>
    <div className="dp-page-head">
      <span className="dp-eyebrow"><SealIcon size={16} /> Déclaration préalable</span>
      <h2 className="dp-page-title">Votre <span className="accent">terrain</span></h2>
      <div className="dp-rule" />
    </div>
    <div className="dp-form-group">
      <label className="dp-label">Adresse du terrain</label>
      <AddressAutocomplete placeholder="Saisissez l'adresse…" onAddressSelected={() => {}} />
    </div>
    <button className="dp-btn-primary w-full justify-center">Continuer</button>
    <p className="dp-meta t-warn mt-3">Champ requis</p>
  </div>
</div>
```
