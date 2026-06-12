# ADR-443 — Permanent «Δομικά» (Structural) Ribbon Tab (Revit-grade)

**Status:** 🟢 v1 implemented — pending browser-verify + commit (2026-06-12)
**Discipline:** DXF Viewer · Ribbon UI
**Related:** ADR-345 (Ribbon data model & contextual-tab framework), ADR-419 (Revit-style launcher hierarchy / `draw.bim.group` split), ADR-442 (Guides contextual tab — sibling Revit-grade ribbon work), ADR-362 Phase E3 (Dimensions contextual tab — sibling)

---

## 1. Context / Problem

The load-bearing (φέροντα) BIM toolset lived in `home-tab-draw.ts` as a single
**nested cascading split-button `draw.bim.group`** (~24 tools across 7 hover-expandable
submenus: Τοίχος / Άνοιγμα / Πλάκα / Κολώνες / Τοιχία / Δοκάρι / Θεμελίωση + Σκάλα /
Κιγκλίδωμα). Tiny icons, deep multi-level dropdown, hard to scan — the same problem the
Guides (ADR-442) and Dimensions (ADR-362 E3) tabs just solved.

Giorgio asked for the **same Revit-grade treatment**: large, flat, grouped buttons.

### ⚠️ The conflict that makes structural different from guides/dimensions

Guides and dimensions had **no per-tool property tab**, so a single contextual picker
keyed on `guide-*` / `dim-*` could own the contextual slot with zero collision.

**Every structural tool, by contrast, ALREADY opens its own per-entity PROPERTY
contextual tab on tool-active** (`useActiveContextualTrigger`: `activeTool === 'wall'`
→ `WALL_CONTEXTUAL_TRIGGER`, and likewise column / beam / slab / foundation / roof /
stair — ~10 property tabs that set type / height / … before drawing). The hook returns
**one** trigger. A contextual «Δομικά picker» keyed on the same `activeTool` would fight
those property tabs for that single slot — only one can win, and either outcome breaks a
real workflow.

## 2. Decision

Add a **PERMANENT ribbon tab `structural`** (`STRUCTURAL_TAB`, `structural-tab.ts`) —
NOT a contextual tab — exactly mirroring Revit's permanent **"Structure"** tab.

- A permanent tab is always present in the tab bar and **does not occupy the single
  contextual slot**. Clicking a tool activates it, and the EXISTING property contextual
  tab then surfaces on top for parameters. The two never collide — this is precisely the
  Revit "Structure tab + Modify | Place Wall" model (permanent launcher + contextual
  Options/property tab coexist).
- The legacy nested `draw.bim.group` dropdown is **removed** from `home-tab-draw.ts`.
  Its leaves become LARGE flat buttons in the new tab. The sibling «Αρχιτεκτονικά»
  (`draw.arch.group`) and «ΗΛΜ» (`draw.mep.group`) launchers stay in Home → Draw for
  now; they become sibling permanent tabs in a later pass (same pattern → Revit
  "Architecture" / "Systems").

Chosen over the contextual-picker road (which would need a synthetic neutral "pre-tool"
state or a merged picker+property tab with `visibilityKey`-gated panels — more work, less
clean, fights 40+ existing property tabs). Giorgio chose the permanent tab 2026-06-12.

### Tab placement

Inserted right after `home` in `DEFAULT_RIBBON_TAB_ORDER` →
`['home', 'structural', 'insert', 'analyze', 'view', 'annotate', 'settings']` (Revit puts
Structure near the front).

### Panels (Revit grouping)

| Panel | i18n key | Tools (commandKey) |
|-------|----------|--------------------|
| Τοίχοι | `ribbon.panels.structuralWalls` | wall / wall-on-entity / wall-region-lines / wall-region-inside / wall-region-box / wall-from-perimeter |
| Κολώνες & Τοιχία | `ribbon.panels.structuralColumns` | column / column-region-lines / column-region-inside / column-region-box / column-discrete-from-perimeter / column-from-perimeter / column-discrete-from-perimeter-walls |
| Δοκοί | `ribbon.panels.structuralBeams` | beam / beam-from-wall |
| Πλάκες & Ανοίγματα | `ribbon.panels.structuralFloors` | slab / slab-opening / opening |
| Θεμελίωση | `ribbon.panels.structuralFoundation` | foundation-pad / foundation-strip / foundation-tie-beam / foundation-strip-from-wall **+ `foundation.actions.fromGrid` action** |
| Σκάλες & Κιγκλιδώματα | `ribbon.panels.structuralCirculation` | stair / railing |

### Layout — all-large, no flyout (consistent with ADR-442)

EVERY command is a **LARGE icon-button**; NOTHING is hidden behind a flyout. All rows
`isInFlyout: false`, all buttons `size: 'large'`. Horizontal scroll absorbs overflow.

## 3. SSoT guarantees

- **Zero new command labels / dispatch paths.** Every button reuses the exact
  `commandKey` / `action` / `icon` / `labelKey` already wired by `home-tab-draw.ts`
  (`ribbon.commands.bim.*`, `ribbon.commands.stair`). Behaviour byte-identical; keyboard
  chords (W/OP/SL/SO/CL/BM/ST/RL/FP/FS) preserved on the new buttons.
- **Only 7 new container i18n keys** (`ribbon.tabs.structural` + 6 `ribbon.panels.structural*`),
  added to `el` + `en` `dxf-viewer-shell.json` (N.11).
- Registered once in `DEFAULT_RIBBON_TABS` + `DEFAULT_RIBBON_TAB_ORDER`
  (`ribbon-default-tabs.ts`); consumed by the existing `useDxfViewerRibbon` → `RibbonRoot`
  pipeline (no new wiring). No `ribbon-contextual-config.ts` change — permanent, not contextual.

## 4. Files

**NEW**
- `src/subapps/dxf-viewer/ui/ribbon/data/structural-tab.ts`
- `src/subapps/dxf-viewer/ui/ribbon/data/__tests__/structural-tab.test.ts` (9 tests)
- `src/subapps/dxf-viewer/ui/ribbon/components/buttons/structural-icon-bases.tsx` (icon-distinction pass — 5 base fragments, data)
- `src/subapps/dxf-viewer/ui/ribbon/components/buttons/structural-icon-methods.tsx` (icon-distinction pass — 10 method-badge fragments, data)
- `src/subapps/dxf-viewer/ui/ribbon/components/buttons/StructuralToolIcon.tsx` (icon-distinction pass — base×method composer)
- `src/subapps/dxf-viewer/ui/ribbon/components/buttons/__tests__/StructuralToolIcon.test.tsx` (6 tests)

**MOD**
- `src/subapps/dxf-viewer/ui/ribbon/data/ribbon-default-tabs.ts` (import + register + tab order)
- `src/subapps/dxf-viewer/ui/ribbon/data/home-tab-draw.ts` (removed nested `draw.bim.group` dropdown)
- `src/subapps/dxf-viewer/ui/ribbon/components/buttons/RibbonButtonIcon.tsx` (icon-distinction pass — additive 22 `struct-*` cases)
- `src/i18n/locales/el/dxf-viewer-shell.json` (1 tab + 6 panel keys)
- `src/i18n/locales/en/dxf-viewer-shell.json` (1 tab + 6 panel keys)

## 5. Google-level checklist (N.7.2)

- Proactive — permanent entry point at the right altitude (a top-level discipline tab) ✅
- No race — pure data declaration, no runtime trigger contention (the whole point: avoids
  the contextual-slot race with property tabs) ✅
- Idempotent — static tab definition ✅
- SSoT — one owner per command (reused), one tab registration ✅
- Lifecycle owner — `DEFAULT_RIBBON_TABS` (explicit) ✅

✅ **Google-level: YES** — data-driven, reuses existing dispatch/SSoT, zero
performance-pipeline impact, resolves the property-tab conflict cleanly via the proven
permanent-tab vs contextual-tab separation. 38/38 ribbon-data tests green.

## 6. Out of scope / DEFER

- «Αρχιτεκτονικά» (`draw.arch.group`) + «ΗΛΜ» (`draw.mep.group`) → sibling permanent tabs
  (Revit "Architecture" / "Systems"), same pattern, after Giorgio verifies this one.
- Per-panel `visibilityKey` gating (e.g. hide region-tools until a region exists).

## Changelog

- **2026-06-12** — Icon-distinction pass (Opus 4.8). Root bug: every variant of a family
  shared ONE glyph token (`bim-wall`×7, `bim-column`×9, `bim-beam`×6 incl. borrowed
  foundation icons) → users could not tell the creation methods apart. Fix = a Revit-grade
  **base × method composition** icon system (SSoT, no per-icon duplication):
  - NEW `structural-icon-bases.tsx` (5 plan-view base fragments: wall / column / beam /
    foundation-pad / foundation-strip), `structural-icon-methods.tsx` (10 bottom-right
    creation-method badge fragments: single / on-entity / region-lines / region-inside /
    region-box / from-perimeter / discrete-from-perimeter / discrete-from-perimeter-walls /
    from-grid / **tie**), `StructuralToolIcon.tsx` (composes base + badge, sizing via
    caller className like `CircleIcon`), `__tests__/StructuralToolIcon.test.tsx` (6 tests).
  - **5 bases + 10 methods = 22 distinct icons from 15 fragment defs** (a new base or
    method is +1 fragment, never N×M). `tie` method keeps the foundation tie-beam distinct
    from strip-from-wall (`on-entity`), resolving the only would-be re-collision.
  - MOD `RibbonButtonIcon.tsx` (additive: 22 new `struct-*` cases, zero change to existing
    cases), `structural-tab.ts` (only the 22 `icon:` tokens → `struct-<family>-<method>`;
    labels/commandKey/action/shortcut unchanged → zero behaviour change), `structural-tab.test.ts`
    (+2 tests: unique-icon-token anti-collision + composed-token assertions). Slab / opening /
    stair / railing tokens untouched (already distinct). Pending browser-verify + commit.
- **2026-06-12** — v1 created (Opus 4.8). New permanent `STRUCTURAL_TAB` (6 panels, 24
  tools + 1 action, all large) replacing the nested `draw.bim.group` dropdown in
  `home-tab-draw.ts`. 7 new i18n container keys (el+en). 7 unit tests. Permanent-tab road
  chosen (over contextual picker) to avoid the per-entity property-tab conflict. Pending
  browser-verify + commit.
