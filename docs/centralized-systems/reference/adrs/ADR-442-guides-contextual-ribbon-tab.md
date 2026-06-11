# ADR-442 — Guides & Grid Contextual Ribbon Tab (Revit-grade)

**Status:** 🟢 v1 implemented — pending browser-verify + commit (2026-06-12)
**Discipline:** DXF Viewer · Ribbon UI
**Related:** ADR-345 (Ribbon data model & contextual-tab framework), ADR-189 (Construction Grid & Guide System), ADR-034 (guide-commands split), ADR-357 (line-tool contextual tab — sibling pattern)

---

## 1. Context / Problem

The guide-and-grid toolset in the DXF viewer had grown to **33 commands packed into a
single split-button dropdown** in the `Home → Guides` panel (`home-tab-guides.ts`).
Tiny icons, deep dropdown, hard to scan — the user "ταλαιπωρείται" hunting commands.
Meanwhile the canvas-grid toggle lived separately under `View → Display`
(`view-tab-display.ts`), disconnected from the guide tools it relates to.

Every other entity/tool family in the app (wall, column, beam, stair, MEP, line tools…)
already uses the **contextual ribbon tab** pattern (ADR-345 §5.4): a dedicated tab with
LARGE, grouped buttons that auto-appears when the relevant tool is active or entity
selected, and auto-hides otherwise. Guides were the only family left behind.

This is the AutoCAD/Revit industry pattern (Revit "Modify | Grids", AutoCAD contextual
ribbon tabs for array/hatch). Big players surface a context-specific tab the moment you
enter the context.

## 2. Decision

Add a **contextual ribbon tab `guides-editor`** (`CONTEXTUAL_GUIDES_TAB`,
`contextual-guides-tab.ts`) that surfaces all guide tools as large, grouped buttons.

### Trigger — single, state-free

```ts
if (activeTool.startsWith('guide-')) return GUIDES_CONTEXTUAL_TRIGGER;
```

Guides have **no persistent selection** — `selectedGuideIds` lives only while a guide
tool is active (`useGuideWorkflowState`) and clears on tool change. Therefore the
"tool active" check covers BOTH the tool-active and the guide-selected case with one
prefix test, no new state. (Sibling to ADR-357's `line-tool-active`.) Guide actions
(`guides-visibility`, `grid`) do not set `activeTool`, so toggling them keeps the tab open.

### Chicken-and-egg — persistent entry preserved

A contextual tab can only appear once a guide tool is active, so the `Home → Guides`
panel stays as the **persistent entry point** — but reduced (v1.2) to a SINGLE compact
split-button «Οδηγοί» (Revit "Architecture → Grid" pattern). Main click = `guide-x`
(opens the contextual tab); dropdown = 5 common starters + "open guide panel". The legacy
33-variant mega-dropdown is removed — every guide tool is a LARGE button in the contextual
tab. One door in, rich editing surface in context.

### Layout — all-large, no flyout (Giorgio 2026-06-12)

EVERY command is a **LARGE icon-button**; NOTHING is hidden behind a flyout/dropdown.
All rows are `isInFlyout: false`, all buttons `size: 'large'`. When the full set exceeds
the viewport the ribbon body scrolls horizontally (`.dxf-ribbon-body { overflow-x: auto }`).
Explicit product decision: maximum scannability over compactness. (The "(+ …)" tools in the
table below are NO LONGER in a flyout — they are large buttons in the same panel row.)

### Panels (Revit grouping)

| Panel | i18n key | Tools |
|-------|----------|-------|
| Σχεδίαση Οδηγών | `ribbon.panels.guidesDraw` | guide-x/z/parallel/perpendicular/xz (+ segments/distance/add-point/delete-point) |
| Τόξα & Σημεία | `ribbon.panels.guidesArcsPoints` | from-entity/offset-entity/arc-segments/arc-distance (+ from-selection/line-midpoint/circle-center/rect-center/arc-line-intersect/circle-intersect) |
| Επεξεργασία Οδηγών | `ribbon.panels.guidesModify` | move/rotate/mirror/scale/delete (+ select/rotate-all/rotate-group/equalize/angle/copy-pattern) |
| Κάναβοι & Διατάξεις | `ribbon.panels.guidesGridArrays` | guide-grid/preset-grid/polar-array **+ canvas `grid` toggle** |
| Εμφάνιση & Ανάλυση | `ribbon.panels.guidesDisplay` | guide-panel/visibility/analysis |

### Canvas grid — dual-homed temporarily

The `grid` toggle is mirrored into the new tab's "Κάναβοι & Διατάξεις" panel **and kept
in `View → Display`** unchanged. Giorgio evaluates which home he prefers; the loser is
removed in a follow-up. Both use the identical `grid` action/icon — zero behaviour fork.

## 3. SSoT guarantees

- **Zero new command labels / dispatch paths.** Every button reuses the exact
  `commandKey` / `action` / `icon` / `labelKey` already wired by `home-tab-guides.ts`
  and `view-tab-display.ts`. Behaviour is byte-identical to the legacy buttons.
- **Only 6 new container i18n keys** (`ribbon.tabs.guides` + 5 `ribbon.panels.guides*`),
  added to `el` + `en` `dxf-viewer-shell.json` (N.11).
- Trigger registered once in `RIBBON_CONTEXTUAL_TABS` + `useActiveContextualTrigger`
  (`ribbon-contextual-config.ts`); consumed by the existing
  `useDxfViewerRibbon` → `RibbonRoot` pipeline (no new wiring).

## 4. Files

**NEW**
- `src/subapps/dxf-viewer/ui/ribbon/data/contextual-guides-tab.ts`

**MOD**
- `src/subapps/dxf-viewer/app/ribbon-contextual-config.ts` (import + registry + `guide-` trigger)
- `src/i18n/locales/el/dxf-viewer-shell.json` (1 tab + 5 panel keys)
- `src/i18n/locales/en/dxf-viewer-shell.json` (1 tab + 5 panel keys)

## 5. Google-level checklist (N.7.2)

- Proactive — tab created at the right lifecycle moment (tool activation), not as a side effect ✅
- No race — pure derived trigger from `activeTool` ✅
- Idempotent — re-deriving the trigger yields the same tab ✅
- SSoT — one owner per command (reused), one trigger registration ✅
- Lifecycle owner — `useActiveContextualTrigger` (explicit) ✅

✅ **Google-level: YES** — data-driven, reuses existing dispatch/SSoT, zero performance-pipeline impact, mirrors the proven contextual-tab pattern used by 40+ other tabs.

## 6. Out of scope / DEFER

- Removing the duplicate `grid` toggle (View → Display **or** the new tab) per Giorgio's A/B choice.
- Per-panel `visibilityKey` gating (e.g. hide "Επεξεργασία" until ≥1 guide exists).

## Changelog

- **2026-06-12** — v1 created (Opus 4.8). New `CONTEXTUAL_GUIDES_TAB` + `guide-` trigger
  + 6 i18n keys. Canvas grid dual-homed for A/B evaluation. Pending browser-verify + commit.
- **2026-06-12** — v1.1 (Opus 4.8). Layout change per Giorgio: ALL commands are large
  icon-buttons, zero flyout/dropdown rows (was: secondary tools in `isInFlyout` rows).
  Added `toolBtn`/`actionBtn` helpers for terse, type-safe declarations. Horizontal
  scroll absorbs overflow.
- **2026-06-12** — v1.2 (Opus 4.8). Home → Guides panel reduced from 6 buttons to a SINGLE
  compact split-button launcher (Revit "Grid" entry pattern). Legacy 33-variant mega-dropdown
  removed; dropdown trimmed to 5 starters + open-panel. Resolves the "how do I reach guides
  if Home is cleaned" chicken-and-egg. `home-tab-guides.ts` MOD.
