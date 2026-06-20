# ADR-107: UI Size Defaults Centralization (|| 10 / ?? 10 / || 8 / || 3)

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-01-01 |
| **Category** | Design System |
| **Canonical Location** | `UI_SIZE_DEFAULTS` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Canonical**: `UI_SIZE_DEFAULTS` from `config/text-rendering-config.ts`
- **Decision**: Centralize hardcoded `|| 10` / `?? 10` / `|| 8` / `|| 3` fallback patterns to named constants
- **Problem**: ~30 hardcoded fallback patterns across 7 files:
  - `systems/rulers-grid/utils.ts`: 9 occurrences (fontSize, unitsFontSize)
  - `canvas-v2/layer-canvas/LayerRenderer.ts`: 7 occurrences (fontSize, unitsFontSize, majorTickLength)
  - `hooks/useGripPreviewStyle.ts`: 3 occurrences (apertureSize, gripSize, pickBoxSize)
  - `systems/zoom/utils/bounds.ts`: 2 occurrences (text height fallback)
  - `rendering/grips/UnifiedGripRenderer.ts`: 2 occurrences (gripSize)
  - `ui/components/dxf-settings/settings/core/GripSettings.tsx`: 6 occurrences (gripSize, pickBoxSize)
- **Semantic Categories**:
  - `RULER_FONT_SIZE`: 10 - Default ruler number font size (px)
  - `RULER_UNITS_FONT_SIZE`: 10 - Default ruler units label font size (px)
  - `MAJOR_TICK_LENGTH`: 10 - Default major tick mark length (px)
  - `APERTURE_SIZE`: 10 - Grip selection aperture size (px, AutoCAD APERTURE)
  - `GRIP_SIZE`: `GRIP_SIZE_DEFAULT` (7) - Default grip point size (px, AutoCAD GRIPSIZE). Since 2026-06-20 references the SSoT leaf `config/grip-size-default.ts` (see Changelog).
  - `PICK_BOX_SIZE`: 3 - Default pick box size (px, AutoCAD PICKBOX)
  - `TEXT_HEIGHT_FALLBACK`: 10 - Default text height for bounds calculation (drawing units)
- **API**:
  ```typescript
  export const UI_SIZE_DEFAULTS = {
    RULER_FONT_SIZE: 10,
    RULER_UNITS_FONT_SIZE: 10,
    MAJOR_TICK_LENGTH: 10,
    APERTURE_SIZE: 10,
    GRIP_SIZE: GRIP_SIZE_DEFAULT, // 🏢 7 — SSoT leaf config/grip-size-default.ts
    PICK_BOX_SIZE: 3,
    TEXT_HEIGHT_FALLBACK: 10,
  } as const;
  ```
- **Industry Standard**: AutoCAD DIMSCALE / APERTURE / GRIPSIZE / PICKBOX system variables
- **Files Migrated** (7 files, 29 replacements):
  - `systems/rulers-grid/utils.ts` - 9 replacements
  - `canvas-v2/layer-canvas/LayerRenderer.ts` - 7 replacements
  - `hooks/useGripPreviewStyle.ts` - 3 replacements (apertureSize, gripSize, pickBoxSize)
  - `systems/zoom/utils/bounds.ts` - 2 replacements
  - `rendering/grips/UnifiedGripRenderer.ts` - 2 replacements (gripSize)
  - `ui/components/dxf-settings/settings/core/GripSettings.tsx` - 6 replacements (gripSize, pickBoxSize)
- **Pattern**: Single Source of Truth (SSOT)
- **Benefits**:
  - Zero magic numbers `10` and `8` for UI defaults
  - Semantic constant names (`GRIP_SIZE` vs `8`, `RULER_FONT_SIZE` vs `10`)
  - Single point of change for default sizes
  - Consistent fallback behavior across all UI systems
- **Companion**: ADR-042 (UI Fonts), ADR-044 (Canvas Line Widths), ADR-093 (Text Label Offsets)

---

## Changelog

### 2026-06-20 — Grip base size unified to ONE SSoT leaf (`GRIP_SIZE_DEFAULT = 7`)

**Problem (Giorgio): selection grips rendered "sometimes big, sometimes small" at the same zoom.**

Real root cause (grep audit, not the override path): the base grip pixel size was
declared in **~6 places that disagreed** — split between **14**, **7** and **5**:

| Source | Old value |
|--------|-----------|
| `config/text-rendering-config.ts` `UI_SIZE_DEFAULTS.GRIP_SIZE` | 14 |
| `types/gripSettings.ts` `DEFAULT_GRIP_SETTINGS` | 14 |
| `stores/GripStyleStore.ts` module default | 14 |
| `settings/FACTORY_DEFAULTS.ts` `GRIP_DEFAULTS` (initial state) | 14 (+ `size: 14`) |
| `settings-core/defaults.ts` `DEFAULT_GRIP_SETTINGS` | 7 |
| `settings-core/types/domain.ts` `validateGripSettings` defaults | 7 |
| `settings-core/types/domain.ts` `validateGripSize(undefined)` (effective default) | **5** |
| `ui/hooks/useUnifiedSpecificSettings.ts` mock fallback | 5 |

Three independent sync writers (`GripProvider` effect, `StyleManagerProvider.syncGripStore`,
`gripStyleAdapter`) push `getEffectiveGripSettings()` into `gripStyleStore`; whichever
default/validation path won at a given lifecycle moment determined the size → 7↔14↔5 flicker.
Grips are screen-constant (zoom-independent), which matched Giorgio's observation that the
variation was **not** zoom-related.

**Decision (Giorgio):** unify the base to **7** (AutoCAD GRIPSIZE).

**Fix (FULL SSoT):**
- **NEW** `config/grip-size-default.ts` — a dedicated **zero-import leaf** exporting
  `GRIP_SIZE_DEFAULT = 7`. A leaf (no deps) is the only cycle-proof home: the value is needed
  by both the very low-level `validation-bounds-config → geometry-utils` chain and higher-level
  settings, so hosting it in any module with its own imports causes a circular import
  (verified: hosting in `validation-bounds-config` produced a `geometry-utils → entity-bounds →
  text-rendering-config → validation-bounds-config` cycle).
- All 8 selection/general base-default surfaces above now **import** `GRIP_SIZE_DEFAULT`
  (incl. `validateGripSize` default `5 → 7` and `UI_SIZE_DEFAULTS.GRIP_SIZE`).
- **Preview-DRAW grips** (`PREVIEW_DEFAULTS` / `DEFAULT_PREVIEW_OPTIONS` = 6) are a **separate,
  internally-consistent domain** and intentionally NOT bound to this constant.
- **Dead-code removal (ADR-048 path):** the `draftGripSettingsStore` override machinery in
  `hooks/useGripPreviewStyle.ts` (`updateDraftGripSettingsStore` /
  `getGripPreviewStyleWithOverride`) was **never wired** (no caller anywhere) → removed;
  `GripPhaseRenderer` now reads `getGripPreviewStyle()` directly.
- **Tests:** NEW `config/__tests__/grip-size-default-ssot.test.ts` (regression guard — every
  default surface must equal `GRIP_SIZE_DEFAULT`); updated `settings-core` validation test
  expectation `5 → 7`.

**Follow-up (same session) — ONE writer for `gripStyleStore` (de-dup ×4):**
The full `gripStyleStore.set({ enabled, colors, gripSize, … })` mapping block was
copy-pasted in 4 places — `GripProvider` ×3 (mount effect + central + fallback update
paths) and `StyleManagerProvider.syncGripStore`. The StyleManager copy wrote only a
**7-field subset** (dropped `dpiScale`, `showMidpoints/Centers/Quadrants`, `showAperture`,
`multiGripEdit`, `snapToGrips`, `showGripTips`, `maxGripsPerEntity`, forced `opacity=1.0`),
a latent SSoT hazard that could silently stomp the advanced fields whenever it ran last.
- **NEW** `stores/grip-style-sync.ts` → `syncGripStyleStoreFromSettings(settings)`, the ONE
  writer doing the full mapping. All 4 sites delegate to it. StyleManager now writes the
  full state (and its `GripSettings` import was corrected `rendering/types/Types` →
  `types/gripSettings`, which is what `getEffectiveGripSettings()` already returns at runtime).
- Distinct from `settings/sync/storeSync.ts` (the hexagonal `GripSettings → GripStylePort`
  size+colors path) and from `gripStyleAdapter` (a genuine port adapter, not a duplicate).

**NOT touched:** `GripSizeCalculator` math + temperature multipliers (by-design hover/active
growth), preview-draw grips, `bim/structural/*`, `codes/*` (shared tree, other agent).

### 2026-06-20 — Settings → legacy style stores unified to ONE SSoT writer set (symmetric to grip)

**Problem (Giorgio): the grip de-dup above left the architecture ASYMMETRIC.** The same
"effective settings → full store state" mapping still lived inline for **line / text /
completion** in `StyleManagerProvider`, and — worse — a **second, diverging writer** existed:
`settings/sync/storeSync.ts` carried its OWN `mapLineToToolStyle` / `mapTextToTextStyle` /
`mapGripToGripStyle` that wrote a **lossy partial subset** through the hexagonal port adapters
(tool: only `stroke/fill/width/opacity`; text: `font/size/color/weight/style`; grip:
`size`+3 colors). Two writers into the same legacy stores (`toolStyleStore` /
`textStyleStore` / `completionStyleStore` / `gripStyleStore`) with different field coverage =
the **same last-writer-wins hazard** the grip fix removed, but for the rest. The port path is
**wired at runtime** (`EnterpriseDxfSettingsProvider` `createStoreSync` + `pushFromSettings`,
fed by `DxfViewerApp` `createSyncDependencies`) — so it was an active second writer, not dead.

**Decision (Giorgio): FULL ENTERPRISE + FULL SSoT, "like the big players (Revit)".** One
mapping, one set of full-state writers, every caller delegates — the exact pattern blessed for
grip (multi-caller, single idempotent writer, full write not partial).

**Fix:**
- **NEW** `stores/style-store-sync.ts` — THE single mapping source. Exports
  `syncToolStyleStoreFromSettings(LineSettings)`, `syncTextStyleStoreFromSettings(TextStyleSyncInput)`,
  `syncCompletionStyleStoreFromSettings(LineSettings)`, and **re-exports** the existing grip
  writer (`syncGripStyleStoreFromSettings`) so all four share one import surface — **no second
  grip writer** (`grip-style-sync.ts` stays the leaf; barrel re-exports the same function
  identity, asserted by test). Mapping bodies are byte-for-byte the prior authoritative
  StyleManager logic (zero behavioural change to the mapping itself).
- `StyleManagerProvider.tsx` — `syncLineStore` / `syncTextStore` / `syncGripStore` /
  `syncCompletionStore` are now **one-line delegations**; the duplicated local `TextSettings`
  interface is replaced by the SSoT `TextStyleSyncInput`. Per-entity effective modes preserved.
- `settings/sync/storeSync.ts` — the **lossy `mapXToY` mappers are deleted**; `start()` now
  pushes **FULL, non-lossy** state via the SSoT writers (tool/grip `'preview'` mode, completion
  `'completion'`, text default — modes preserved). The port `onChange → bus` subscriptions are
  kept as bidirectional scaffolding (`subscribePortToBus`); **grid/ruler ports remain dormant**
  (RulersGridSystem is their SSoT, unchanged — 2026-05-08 fix). Net effect: the runtime hydration
  path now writes the same FULL state the StyleManager full writers do — the dual-writer
  divergence is eliminated.
- **Behaviour delta (intended):** the runtime push now also sets the previously-dropped fields
  (tool `enabled`/`lineType`/`fillColor`; full text incl. `textDecoration`/super-sub/`opacity`;
  full completion) — strictly more-correct, mirroring the grip full-write rationale.
- **Tests:** NEW `stores/__tests__/style-store-sync-ssot.test.ts` (anti-partial-write guard —
  each writer must cover every mapped field, incl. derived `fillColor`/`textDecoration`/
  `opacity÷100`, + grip re-export identity). `settings/sync/storeSync.test.ts` rewritten to
  assert outcomes on the real stores (the ports no longer receive `apply`). 14 green.
- Debug `debug/store-sync-test.qa.ts` introspection updated to the new SSoT writers.

**Open / deferred (separate decision):** retiring the hexagonal port layer (`ports.ts` /
adapters / `compositionRoot` / `createStoreSync` wiring) entirely is a larger, higher-risk
follow-up — the `apply` path is now bypassed but the `onChange/bus` scaffolding + the DI wiring
remain. Also pre-existing and out of scope: `toolStyleStore` is fed with `'preview'`-mode line
settings by storeSync vs default-mode by StyleManager — a mode discrepancy to reconcile when the
single-driver consolidation happens.

**NOT touched:** UI-driven `toolStyleStore.set` in `OverlayToolbar` / `DraggableOverlayToolbar`
(different concern), grid/ruler ports, `bim/structural/*`, `codes/*` (shared tree, other agent).

---
