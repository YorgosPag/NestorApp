# ADR-599: Store-backed Ribbon Toggle Widget SSoT (`RibbonToggleWidget` + `RibbonInlineToggleButton`)

## Status
✅ **ACTIVE — 2026-07-08** — De-duplication of the 13 store-backed inline ribbon toggles under `src/subapps/dxf-viewer/ui/ribbon/components/*Toggle.tsx` (View-tab combobox rows: HeatLoad / PipeSizing / Balancing / Utilization / AnalysisDiagrams / Reinforcement / FinishSkin / ColorBySystem / HideBim / DrainPipe / MepWire / DimRowHandles / DisciplineVisibility). Each was a ~55-line component repeating the identical `<span dxf-ribbon-combobox-row><label/><button aria-pressed …>{icon}{actionLabel}</button></span>` markup, differing only in the store flag it reads/writes, its on/off icons, and its i18n keys. Collapsed onto a shared presentational **atom** (`RibbonInlineToggleButton`) + a config-driven **shell** (`RibbonToggleWidget`) so a toggle is now a ~10-line config object.

**Related:**
- **ADR-585 / 586 / 588 / 590 / 591 / 592 / 593 / 594 / 595** — same 2026-07-08 de-duplication sweep, same archetype (**shared primitive + per-instance binding**), different buckets. ADR-599 is the ribbon-UI bucket (TIER B / B3).
- **ADR-584** (jscpd Clone Ratchet, CHECK 3.28) — the token-based detector that gates re-introduction (this ADR's chosen guard).
- **ADR-345 / ADR-547** (`RibbonToggleButton`) — the *command-context/dispatch-driven* ribbon toggle (`dxf-ribbon-btn` inside the command tables). **Distinct** from this SSoT: those are keyed by `commandKey` and read state via `useRibbonToggleState`, whereas the widgets here bind directly to a subapp store. No overlap, no collision.
- **ADR-408 / ADR-422 / ADR-449 / ADR-456 / ADR-483 / ADR-485 / ADR-375 / ADR-362 / ADR-405** — the individual toggles' behaviours, reproduced 1:1.

---

## Context

A real SSoT audit (grep for `dxf-ribbon-combobox-row` / `aria-pressed` / existing `RibbonToggle*`, then full reads of all 13 files) confirmed:

- No shared owner existed. The pre-existing `RibbonToggleButton` (ADR-345/547) is a *different* component — dispatch-driven, keyed by `commandKey`, rendered from the command tables — so it does **not** cover these store-backed inline chips.
- All 13 shared one button skeleton: `flex items-center gap-1 … {bg.backgroundSecondary} {color} … rounded {hover} {transition} select-none`, an `aria-pressed` button wrapping `{icon}<span>{label}</span>`, inside a `dxf-ribbon-combobox-row` with a `dxf-ribbon-combobox-label`.
- Variance was purely: (a) which store flag drives `value` + `toggle`, (b) the on/off icon glyphs, (c) the i18n keys, (d) — for `DisciplineVisibility` only — a different colour ramp + multi-chip layout.

Big-player practice for a family of near-identical UI controls (Figma's toggle chips, Revit's V/G row toggles, Radix/shadcn's headless-primitive + config) is a **shared presentational atom + per-instance binding**, not a copy-pasted component per flag.

---

## Decision

### New atom `ui/ribbon/components/RibbonInlineToggleButton.tsx`
The single `<button>` body. Owns the invariant shell (flex layout, `bg.backgroundSecondary`, `dxf-ribbon` typography/spacing, hover + colour-transition, `select-none`) and defers the three varying decisions to props:
- `pressed` → `aria-pressed`
- `colorClass` → the resolved semantic text colour (caller picks `info`/`secondary`/`muted`)
- `icon` → the already-resolved icon node (caller picks glyph + opacity)

Two consumers: `RibbonToggleWidget` and the per-discipline chips of `DisciplineVisibilityToggle`.

### New shell `ui/ribbon/components/RibbonToggleWidget.tsx` (+ exported `RibbonToggleConfig`)
Renders the `dxf-ribbon-combobox-row` + constant label + one `RibbonInlineToggleButton`, driven by a `RibbonToggleConfig`:

| Field | Role |
|---|---|
| `useToggleState()` | reactive read of `value` (on/active) + the `toggle` action — called **as a hook** (may subscribe to any store), unconditionally once per render (rules-of-hooks safe: config is a stable module constant per call-site) |
| `labelKey` | constant row label |
| `activeIcon` / `inactiveIcon` | glyph per state (rendered at opacity-80 / opacity-60) |
| `activeLabelKey` / `inactiveLabelKey` | inner button text (the "turn-off" / "turn-on" action) |
| `activeTooltipKey` / `inactiveTooltipKey` | accessible label / tooltip |

State convention: `value` = the "on / active / pressed" boolean → icon `activeIcon@80`/`inactiveIcon@60`, colour `info`/`secondary`, label + tooltip follow the active/inactive keys.

### 13 migrations
- **12 single toggles** become a ~10-line `RibbonToggleConfig` literal (store binding inside `useToggleState`, literal i18n keys) + a one-line `() => <RibbonToggleWidget config={…} />`. **Public API unchanged** — each keeps its named export (`ShowHeatLoadToggle`, …), so `RibbonPanel` is untouched.
- **`DisciplineVisibilityToggle`** (genuinely divergent — multi-chip row, `secondary`/`muted` ramp, reversed icon opacity) is **NOT** a `RibbonToggleWidget`; its `DisciplineChip` composes `RibbonInlineToggleButton` directly. This keeps it in the SSoT (shared button body) without God-shelling the widget.

**Visibility-style mapping** (`DrainPipe` / `MepWire`): `value` models "visible", so `aria-pressed = visible`, the active action is "hide", and the same `info`/`secondary` ramp holds. `HideBim` models "BIM hidden" with a constant outer label and state-dependent inner text — fits the same config (no exclusion needed).

### One behaviour-neutral normalisation vs the originals
`DimRowHandlesToggle` uses a single glyph (`MoveVertical`) in both states; its inactive icon now renders at opacity-60 (was a constant opacity-80). A weightless affordance-dimming aligned with every other toggle — no functional change.

---

## Exclusions (No God-shell)

None fully excluded. The only structurally-divergent member (`DisciplineVisibilityToggle`) is **partially** integrated — it reuses the atom but keeps its own multi-chip layout and colour ramp, rather than being forced through the single-toggle shell.

---

## Guard decision

**No `.ssot-registry.json` module / CHECK 3.7·3.18 forbidden-pattern** — consistent with every sibling of this sweep (ADR-585…595 added none). A regex on the `dxf-ribbon-combobox-row` markup would false-positive on the legitimately-divergent `DisciplineVisibilityToggle` row wrapper and any future bespoke row. Re-introduction of the button-body clone is caught by **jscpd CHECK 3.28 (ADR-584)** — the token-based, name-independent detector — plus code review.

**i18n reachability (CHECK 3.13 / ADR-279/280):** literal key strings stay inside each call-site's config object (mirroring the pre-existing `DISCIPLINE_LABEL_KEY` "literal keys → analyzer-reachable" pattern), so the runtime resolver still reaches them despite the dynamic `t(config.labelKey)` call.

---

## Consequences

- **13 files → 2 primitives + 13 thin call-sites.** Each toggle file dropped from ~55 to ~40 lines (config + one-liner), and the button markup — the actual duplicated token mass — exists exactly once.
- **A new toggle is a config object**, not a copy-pasted component. The atom guarantees a11y (`aria-pressed`, `aria-label`) and styling consistency by construction.
- **Verification: 7 jest GREEN / 2 suites** — `RibbonToggleWidget.test.tsx` (atom + shell: active/inactive branch selection, icon opacity, colour, click→toggle, visibility-inverted mapping) + `ribbon-toggle-widgets-smoke.test.ts` (all 13 migrated call-sites still export a function component). **jscpd CHECK 3.28 (diff) — no new clones across the 15 changed files.** No `tsc` (N.17).

---

## Changelog
- **2026-07-08** — Created. TIER B / B3 of the 2026-07-08 duplicate-audit sweep. NEW `RibbonInlineToggleButton.tsx` + `RibbonToggleWidget.tsx` + 2 test suites; 13 `*Toggle.tsx` migrated. 7 jest GREEN, jscpd-clean. Uncommitted (Giorgio commits).
