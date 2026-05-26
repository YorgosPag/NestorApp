# ADR-377: BIM Subcategories System

**Status**: 🟡 ACTIVE v0.6 — Phase A + B + C.1 + C.2 + C.3 implemented, D + E + F pending
**Date**: 2026-05-26
**Author**: Giorgio Pagonis (orchestrated via Claude)
**Related**:
- ADR-375 (BIM Entity Line Weight Semantic System — parent, Phase C.3 pointer)
- ADR-370 (BIM 3D Readonly Viewer — 3D parity target)
- ADR-358 (Lineweight ISO Catalog — shared SSoT)
- ADR-378 (BIM Family Types — successor, separate ADR planned)
- ADR-040 (Preview Canvas Performance — bitmap cache invalidation)

**Scope split rationale (Q7 lock)**: This ADR ships **only built-in subcategories** (geometric parts of BIM entities). User-defined "wall types / door types / stair types" go to a dedicated successor (ADR-378 BIM Family Types). The two systems are orthogonal — subcategories style **parts of geometry**, types define **variants of element**.

---

## 1. Context

### 1.1 Background

ADR-375 Phase A locked a 4-tier BIM line weight system inspired by Revit:

```
TIER 0 — VIEW_RANGE   (top/cut/bottom/depth planes)
TIER 1 — PEN_TABLE    (16 pens × 6 scale columns)
TIER 2 — OBJECT_STYLES (per category: { projectionPen, cutPen })
TIER 3 — VIEW_OVERRIDES (Phase C.4 — future)
```

Phase A delivered 12 BIM categories with global `{ projectionPen, cutPen }` styles per project (Phase B.2 added persistence + UI). The natural next step is **finer-grain control within a category** — what Revit/ArchiCAD/AutoCAD-Arch call **Subcategories**.

### 1.2 Why subcategories matter

A single BIM entity is rarely rendered with one pen across all its geometric parts:

- **Stair**: treads need 0.13mm solid, stringers 0.25mm solid, walkline 0.05mm dashed, arrows 0.10mm
- **Door**: panel needs 0.35mm solid, glass 0.05mm double, swing arc 0.10mm dashed, frame 0.25mm
- **Wall**: outer edge 0.35mm solid, hatch fill 0.05mm light, hidden lines (above cut plane) 0.13mm dashed

Without subcategories, a renderer either picks **one pen for the whole entity** (lossy) or **hardcodes pens internally** (no user control). Both are wrong for FULL ENTERPRISE — the user must own all visual decisions per geometric part.

### 1.3 Industry research (verified during ADR design 2026-05-26)

| Platform | Subcategory model |
|---|---|
| **Revit** | Object Styles dialog: tree per category with expandable subcategories. Each subcategory has projection/cut pen + line pattern + color. ~50+ built-in subcategories across all categories. Custom subcategories addable via Family Editor. |
| **ArchiCAD** | Component Pens: per element class, separate pens for each geometric component (panel/frame/glass for doors, treads/risers/stringers for stairs). Project-scoped Pen-Sets. |
| **AutoCAD-Arch** | Display Properties: per object-type per display-config overrides for each geometric part. Layered above standard AutoCAD layer styling. |
| **Vectorworks** | Class + Wall Style hybrid. Wall Style defines per-component appearance. |
| **MicroStation** | Element templates with per-component overrides. |

**Convergence: all major BIM platforms have a subcategory abstraction**. Our system needs it to match industry standard for FULL ENTERPRISE (per `[[feedback_industry_standard_default]]` + `[[feedback_completeness_over_mvp]]`).

### 1.4 Relationship to existing systems

```
                  ┌──────────────────────────────┐
                  │  ADR-358 lineweight-iso-cat  │ (CAD/BIM shared catalog)
                  └──────────────┬───────────────┘
                                 │
                  ┌──────────────▼───────────────┐
                  │   ADR-375 bim-pen-table     │ (16×6 mm grid)
                  └──────────────┬───────────────┘
                                 │
                  ┌──────────────▼───────────────┐
                  │ ADR-375 bim-object-styles    │
                  │  per category: { projPen,    │
                  │                  cutPen }    │
                  └──────────────┬───────────────┘
                                 │ EXTENDED HERE
                  ┌──────────────▼───────────────┐
                  │ ADR-377 SUBCATEGORIES        │
                  │  per category.key:           │
                  │   { projPen?, cutPen?,       │
                  │     linePattern?, colors? }  │
                  └──────────────────────────────┘
```

ADR-358 (CAD ByLayer cascade) remains the styling resolver for non-BIM DXF entities. ADR-377 extends ADR-375 only — BIM domain.

---

## 2. Architecture

### 2.1 Tier 2 extension

Phase A's `ObjectStyle` is extended with optional `subcategories` map:

```typescript
// bim-object-styles.ts (EXTENDED)
export interface SubcategoryStyle {
  /** Override parent cutPen */
  cutPen?: PenIndex;
  /** Override parent projectionPen */
  projectionPen?: PenIndex;
  /** Override line pattern (default: 'solid') */
  linePattern?: LinePatternKey;
  /** Override cut color (default: canvas token) */
  cutColor?: string | null;
  /** Override projection color (default: canvas token) */
  projectionColor?: string | null;
}

export interface ObjectStyle {
  projectionPen: PenIndex;
  cutPen: PenIndex;
  /** Per-subcategory overrides. Keys validated against BIM_SUBCATEGORIES per category. */
  subcategories?: Partial<Record<string, SubcategoryStyle>>;
}
```

**Key rules**:
- All subcategory fields are **optional**. Missing field → fall back to parent category style.
- Color = single value, theme-independent (Q11 lock). If `null`/missing → canvas token (auto light/dark adapt).
- LinePattern absent → `'solid'` default.

### 2.2 Per-tier responsibility (after ADR-377)

| Tier | Owner | Responsibility |
|---|---|---|
| 0 | View Range | Cut-state classification (cut / projection / beyond) |
| 1 | Pen Table | Pen index → mm value (16×6 grid) |
| 2 | Object Styles | Category → { projPen, cutPen } **+ subcategories override** |
| **NEW** | Subcategory resolver | Merge parent style + subcategory override per render call |
| 3 | View Overrides | Per-view overrides (Phase C.4 — future) |

### 2.3 47 built-in subcategories (locked Q2)

The taxonomy below is **first-class in SSoT** (`bim-subcategories.ts`). 23 are **wired** today (existing renderer sub-passes), 24 are **stubs** (badge "🔒 Δεν ρεντάρει ακόμη" in UI).

#### Wall — 6 subcategories

| Key | Wired? | Renderer method |
|---|---|---|
| `common-edges` | ✅ | `drawFootprint()` |
| `cut-pattern` | ✅ | `drawMaterialHatch()` (hatch SSoT, already routed) |
| `surface-pattern` | 🔒 | (no geometry — Phase C.3 of ADR-378 or new ADR) |
| `hidden-lines` | 🔒 | (system-wide stub — needs cut-state driven dashed pass) |
| `sweeps` | 🔒 | (no geometry — decorative trim) |
| `reveals` | 🔒 | (no geometry — wall recess) |

#### Slab — 5 subcategories

| Key | Wired? | Renderer method |
|---|---|---|
| `common-edges` | ✅ | `drawPolygonPath()` + stroke |
| `slab-edges` | 🔒 | (separation from common-edges TBD) |
| `interior-edges` | 🔒 | (computation from opening cutouts TBD) |
| `cut-pattern` | 🔒 | (reinforcement hatch already kind-driven — wiring possible) |
| `hidden-lines` | 🔒 | (system-wide stub) |

#### Column — 3 subcategories + 1 extra

| Key | Wired? | Renderer method |
|---|---|---|
| `hidden-lines` | 🔒 | (system-wide stub) |
| `stick-symbols` | 🔒 | (schematic single-line representation TBD) |
| `reference-lines` | 🔒 | (TBD) |
| `section-profile` ⭐ | ✅ | `drawSectionProfile()` (L/T steel — Phase 4.5c.6) |

#### Beam — 3 subcategories + 1 extra

| Key | Wired? | Renderer method |
|---|---|---|
| `hidden-lines` | ✅ | dashed outline (OUTLINE_DASH convention) |
| `stick-symbols` | 🔒 | (TBD) |
| `rigid-links` | 🔒 | (TBD) |
| `section-profile` ⭐ | ✅ | `drawSectionProfile()` (I/H steel — Phase 5.5h) |

#### Opening — 14 subcategories (3 kinds × ~5 each)

OpeningRenderer handles `kind: door | window | wall-cutout | sliding-door`. Subcategories keyed by `{kind}-{part}`:

| Key | Wired? | Renderer method |
|---|---|---|
| `door-panel` | 🔒 | (separate from frame TBD) |
| `door-frame` | ✅ | `drawOutline()` |
| `door-glass` | ✅ | `drawGlazing()` |
| `door-opening` | ✅ | `drawOutline()` |
| `door-plan-swing` | ✅ | `drawHingeArc()` |
| `door-elevation-swing` | 🔒 | (no elevation view yet) |
| `door-frame-elevation` | 🔒 | (no elevation view yet) |
| `window-frame` | ✅ | `drawOutline()` |
| `window-sash` | 🔒 | (no sash geometry) |
| `window-glass` | ✅ | `drawGlazing()` |
| `window-opening` | ✅ | `drawOutline()` |
| `window-plan-swing` | 🔒 | (hinged-window distinction TBD) |
| `wall-cutout-sill-head` | 🔒 | (TBD) |
| `wall-cutout-jambs` | ✅ | `drawOutline()` + `drawLeafLine()` |
| `sliding-track` ⭐ | ✅ | `drawSlidingIndicator()` |

#### SlabOpening — 2 subcategories

| Key | Wired? | Renderer method |
|---|---|---|
| `edges` | ✅ | `drawPolygonPath()` + stroke |
| `hidden` | 🔒 | (system-wide stub) |

#### Stair — 9 subcategories + 2 extras

| Key | Wired? | Renderer method |
|---|---|---|
| `treads` | ✅ | `renderTreadsForStructure()` |
| `risers` | 🔒 | (TBD per existing comment) |
| `outlines` (stringers) | ✅ | `renderStringersForStructure()` |
| `walkline` | ✅ | `drawWalkline()` |
| `cut-marks` | 🔒 | (TBD) |
| `down-arrows` | ✅ | `drawArrow()` + "DOWN" |
| `up-arrows` | ✅ | `drawArrow()` + "UP" |
| `boundary` | 🔒 | (perimeter — partial via hover halo, structural TBD) |
| `support` | 🔒 | (TBD) |
| `handrails` ⭐ | ✅ | `drawHandrails()` (Phase 7b1 ADA-extended) |
| `tread-labels` ⭐ | ✅ | `drawTreadLabels()` (Phase 3e numbering) |

**Total: 47 subcategories (42 Revit-default + 5 extras ⭐). 23 wired, 24 stubs.**

### 2.4 LinePattern SSoT (NEW)

Per Q8 lock — AutoCAD acad.lin compatible set (~28 patterns) + custom user-defined.

```typescript
// bim-line-patterns.ts (NEW SSoT)
export const BIM_LINE_PATTERNS = [
  // Base set
  'solid',
  // Dashed variants
  'dashed', 'dashed2', 'dashedX2',
  // Dotted variants
  'dotted', 'dotted2', 'dottedX2',
  // Center (long-short)
  'center', 'center2', 'centerX2',
  // Hidden (dense short dashes)
  'hidden', 'hidden2', 'hiddenX2',
  // Dash-dot
  'dashdot', 'dashdot2', 'dashdotX2',
  // Divide (dash + 2 dots)
  'divide', 'divide2', 'divideX2',
  // Phantom (long-short-short)
  'phantom', 'phantom2', 'phantomX2',
  // Border (dash-dash-dot)
  'border', 'border2', 'borderX2',
  // Special
  'double',
] as const;
// 28 built-in + custom user-defined ('custom_*' prefix)

export type LinePatternKey =
  | typeof BIM_LINE_PATTERNS[number]
  | `custom_${string}`;

export interface CustomLinePattern {
  /** Unique key (prefix 'custom_') */
  key: `custom_${string}`;
  /** Display name */
  displayName: string;
  /** Stroke dash array (CSS canvas-compatible) */
  strokeArray: ReadonlyArray<number>;
}
```

**Resolution**: `linePatternToDashArray(LinePatternKey): number[]` is the SSoT helper. Returns a stroke-array suitable for `ctx.setLineDash()` (2D) or `LineDashedMaterial.dashSize/gapSize` (3D).

**Custom patterns** stored per-project at `projects/{projectId}.bimCustomLinePatterns` (mirror of custom subcategory pattern from initial Q4 discussion — relocated here since custom subcategories were removed in Q7).

---

## 3. Data Model

### 3.1 SSoT files (NEW)

| File | Purpose |
|---|---|
| `src/subapps/dxf-viewer/config/bim-line-patterns.ts` | LinePatternKey + 28 built-in patterns + dash-array helper |
| `src/subapps/dxf-viewer/config/bim-subcategories.ts` | 47 subcategory keys per category + wired/stub registry |

### 3.2 SSoT files (EXTENDED)

| File | Change |
|---|---|
| `src/subapps/dxf-viewer/config/bim-object-styles.ts` | `ObjectStyle.subcategories?` field + `SubcategoryStyle` interface |
| `src/subapps/dxf-viewer/config/bim-line-weight-resolver.ts` | New `resolveSubcategoryStyle()` function returning { pen, pattern, color } |

### 3.3 Firestore schema

```
dxf_viewer_levels/{levelId}
  bimRenderSettings
    objectStyles
      wall
        projectionPen: 5
        cutPen: 7
        subcategories:                    # NEW (optional)
          common-edges:
            cutPen: 7
            linePattern: 'solid'
            cutColor: null               # → fallback canvas token
          cut-pattern:
            cutPen: 1
            linePattern: 'solid'
            cutColor: '#9CA3AF'          # explicit override
          hidden-lines:                   # stub — user can still edit
            cutPen: 4
            linePattern: 'hidden'
            cutColor: '#6B7280'
          ...
      stair:
        projectionPen: 3
        cutPen: 5
        subcategories:
          treads: { cutPen: 4, linePattern: 'solid' }
          walkline: { projectionPen: 3, linePattern: 'dashed2' }
          handrails: { projectionPen: 4, linePattern: 'solid' }
          ...

projects/{projectId}
  bimCustomLinePatterns:                  # NEW (optional)
    custom_zigzag_insulation:
      displayName: 'ζικ-ζακ μόνωσης'
      strokeArray: [4, 2, 2, 2]
      createdAt: <timestamp>
      createdBy: <userId>
```

**Validation rules**:
- All built-in keys must match `bim-subcategories.ts` SSoT
- Custom line pattern keys must have `custom_` prefix
- Color values: hex string (`#RRGGBB`) or `null`

### 3.4 Firestore security rules

`dxf_viewer_levels` rules already cover `bimRenderSettings` write access (creator-or-company-admin). Subcategories field is a sub-object — inherits same rules. No new collection added at level scope.

`projects.bimCustomLinePatterns` write requires `request.auth.companyId == resource.data.companyId` + creator-or-admin role. New schema validation added to `firestore.rules`.

### 3.5 Entity schema impact

**No changes to BIM entity types** (WallEntity, SlabEntity, etc.) in ADR-377. Built-in subcategories are auto-tagged by the renderer per geometry pass — no per-element field needed.

(Per-element subcategory override scope = Family Types, deferred to ADR-378.)

---

## 4. Resolver Pipeline

### 4.1 Extended resolver signature

```typescript
// bim-line-weight-resolver.ts (EXTENDED)
export interface SubcategoryResolutionContext extends LineWeightContext {
  /** Subcategory key for this render pass (e.g., 'treads', 'common-edges'). */
  subcategoryKey?: string;
}

export interface ResolvedSubcategoryStyle {
  /** Pixel line width (post-conversion mm → px). */
  lineWidthPx: number;
  /** Line pattern key (defaults to 'solid'). */
  linePattern: LinePatternKey;
  /** Color hex or null (null = use canvas token). */
  color: string | null;
}

export function resolveSubcategoryStyle(
  ctx: SubcategoryResolutionContext,
): ResolvedSubcategoryStyle {
  // 1. Lookup parent ObjectStyle (Phase A logic)
  const styles = ctx.objectStyles
    ? { ...DEFAULT_OBJECT_STYLES, ...ctx.objectStyles }
    : DEFAULT_OBJECT_STYLES;
  const parent = styles[ctx.category];

  // 2. Lookup subcategory override (if subcategoryKey provided)
  const sub = ctx.subcategoryKey
    ? parent.subcategories?.[ctx.subcategoryKey]
    : undefined;

  // 3. Resolve pen (override → parent → cut-state branch)
  let penIdx: PenIndex;
  if (ctx.cutState === 'cut') {
    penIdx = sub?.cutPen ?? parent.cutPen;
  } else if (ctx.cutState === 'projection') {
    penIdx = sub?.projectionPen ?? parent.projectionPen;
  } else {
    penIdx = BEYOND_PEN;
  }

  // 4. Lookup mm + convert to px (Phase A logic)
  const scaleCol = closestScaleColumn(ctx.scaleDenominator);
  const mm = PEN_TABLE_MM[penIdx - 1][scaleCol];
  const lineWidthPx = lineweightToPx(mm, ctx.dpi ?? 96);

  // 5. Resolve pattern (default solid)
  const linePattern = sub?.linePattern ?? 'solid';

  // 6. Resolve color (cut-state aware)
  const color = ctx.cutState === 'cut'
    ? (sub?.cutColor ?? null)
    : (sub?.projectionColor ?? null);

  return { lineWidthPx, linePattern, color };
}
```

### 4.2 Renderer usage pattern

```typescript
// Example: WallRenderer
function drawFootprint(wall: WallEntity, ctx: RenderContext) {
  const { lineWidthPx, linePattern, color } = resolveSubcategoryStyle({
    category: 'wall',
    subcategoryKey: 'common-edges',
    cutState: ctx.cutState,
    scaleDenominator: ctx.scaleDenominator,
    objectStyles: useBimRenderSettingsStore.getState().objectStyles,
  });
  ctx.canvas.lineWidth = lineWidthPx;
  ctx.canvas.setLineDash(linePatternToDashArray(linePattern));
  ctx.canvas.strokeStyle = color ?? canvasTokens.bimWallEdge;
  // ... draw geometry
}
```

### 4.3 Bitmap cache invalidation

Per ADR-040: `bimSettingsHash` cache key must include subcategory data. The hash function (already in `useBimRenderSettingsStore`) traverses `objectStyles[*].subcategories` recursively. No new cache layer needed — incremental hash extension only.

---

## 5. Phase Plan

Six sub-phases, one session per phase (per CLAUDE.md N.13).

### Phase A — SSoT foundation (~5-8h)

Files NEW:
- `bim-line-patterns.ts` — LinePatternKey enum + 28 built-in patterns + `linePatternToDashArray()` helper
- `bim-subcategories.ts` — SUBCATEGORY_TAXONOMY (47 keys) + WIRED_SUBCATEGORIES registry + ZodSchema validators

Files EXTENDED:
- `bim-object-styles.ts` — SubcategoryStyle interface + `ObjectStyle.subcategories?` field
- `bim-render-settings-types.ts` — Hash function extension for subcategory keys

Tests: ~25 (taxonomy completeness + stub registry + custom pattern validation + hash uniqueness).

Commit: `feat(bim/subcategories): ADR-377 Phase A — SSoT foundation`

### Phase B — Resolver enhancement (~3-5h)

Files EXTENDED:
- `bim-line-weight-resolver.ts` — `resolveSubcategoryStyle()` added (3-tuple return), legacy `resolveLineWeightPx()` re-implemented in terms of new function

Tests: ~30 (parent fallback, override precedence, all 47 keys × cut/projection/beyond states).

Commit: `feat(bim/subcategories): ADR-377 Phase B — resolver`

### Phase C — 2D renderer wiring (~8-12h)

7 BIM renderers retrofitted to pass `subcategoryKey` per draw call. Only the **23 wired** subcategories activate. Stubs remain inert (renderer doesn't call `resolveSubcategoryStyle()` for them — falls back to parent ObjectStyle).

Files MODIFIED (7):
- `WallRenderer.ts` — `drawFootprint` → `common-edges`, `drawMaterialHatch` → `cut-pattern`
- `SlabRenderer.ts` — `drawPolygonPath` → `common-edges`
- `BeamRenderer.ts` — outline dashed → `hidden-lines`, `drawSectionProfile` → `section-profile`
- `ColumnRenderer.ts` — `drawSectionProfile` → `section-profile`
- `OpeningRenderer.ts` — multi-key per kind (see §2.3 table)
- `SlabOpeningRenderer.ts` — `drawPolygonPath` → `edges`
- `StairRenderer.ts` + `stair-render-structure-style.ts` — multi-key (treads/outlines/walkline/arrows/handrails/tread-labels)

Tests: 60+ regression (each renderer × subcategory key combinations).

Commit chain (3 commits, isolation per renderer cluster):
- `feat(bim/subcategories): ADR-377 Phase C.1 — Wall + Slab + SlabOpening wiring`
- `feat(bim/subcategories): ADR-377 Phase C.2 — Beam + Column wiring`
- `feat(bim/subcategories): ADR-377 Phase C.3 — Opening + Stair wiring`

### Phase D — UI panel (~5-8h)

Files NEW:
- `src/subapps/dxf-viewer/ui/ribbon/panels/SubcategoriesPanel.tsx` — Tabs per BIM category (Wall/Slab/Column/Beam/Door/Window/Stair/SlabOpening) with scrollable rows
- `src/subapps/dxf-viewer/ui/ribbon/panels/SubcategoryRow.tsx` — Single row component (pen dropdown / pattern dropdown / color picker / stub badge)
- `src/subapps/dxf-viewer/ui/ribbon/components/LinePatternPicker.tsx` — Dropdown with visual preview of each pattern

Files MODIFIED:
- `view-tab-bim-settings.ts` — VIEW_SUBCATEGORIES_PANEL registration
- `ribbon-default-tabs.ts` — wiring
- i18n locale files (el + en) — keys for 47 subcategory display names + UI labels

Tests: ~15 (panel render + tab switching + dropdown interaction + stub badge visibility).

Commit: `feat(bim/subcategories): ADR-377 Phase D — Subcategories ribbon panel`

### Phase E — 3D parity (~5-8h)

THREE.js renderer (ADR-370) reads the same `objectStyles.{cat}.subcategories` SSoT and applies:
- `lineWidthPx` → `LineMaterial.linewidth` (with `WebGLRenderer.getPixelRatio()` correction)
- `linePattern` → `LineDashedMaterial.dashSize` + `gapSize` (via `linePatternToDashArray` + scaling)
- `color` → `material.color` (THREE.Color from hex)

Files MODIFIED:
- `src/subapps/dxf-viewer/three/renderers/*` — material assembly per BIM entity 3D mesh (matching 2D subcategory wiring exactly)
- Shared bridge: `src/subapps/dxf-viewer/three/bim-3d-style-bridge.ts` — adapter `from2DSubcategoryStyle()` → THREE.Material instance

Tests: ~15 (material assembly + dash array conversion + light/dark canvas-token bridging).

Commit: `feat(bim/subcategories): ADR-377 Phase E — 3D parity`

### Phase F — Stub UX + polish + ratchet (~3-5h)

UI polish:
- Stub badge component (🔒 lock icon + greyed-out row + tooltip "Δεν ρεντάρει ακόμη")
- Tooltip i18n keys
- Pre-commit ratchet entry in `.ssot-registry.json` for `bim-subcategories` module (forbid duplicate registry, ensure all 47 keys present)
- ADR-040 verification: bitmap cache invalidates on subcategory style change (manual + automated test)

Tests: ~5 (stub badge rendering + tooltip text + ratchet wrapper).

Commit: `feat(bim/subcategories): ADR-377 Phase F — polish + ratchet`

### Summary

| Phase | Duration | Files NEW | Files MOD | Tests |
|---|---|---|---|---|
| A | 5-8h | 2 | 2 | ~25 |
| B | 3-5h | 0 | 1 | ~30 |
| C | 8-12h | 0 | 7+1 | ~60 |
| D | 5-8h | 3 | 4+i18n | ~15 |
| E | 5-8h | 1 | 5-10 | ~15 |
| F | 3-5h | 0 | 2-3 | ~5 |
| **Total** | **29-46h** | **6 NEW** | **~30 MOD** | **~150 tests** |

---

## 6. UI Specification

### 6.1 Subcategories ribbon panel (Phase D)

Location: BIM Settings tab in ribbon (sibling of ObjectStyles, ViewRange, DrawingScale, ViewTemplates panels from Phase B of ADR-375).

Layout:

```
┌────────────────────────────────────────────────────────────┐
│ Subcategories                                              │
├────────────────────────────────────────────────────────────┤
│ ╔═══════════════════════════════════════════════════════╗  │
│ ║ Wall │ Slab │ Column │ Beam │ Door │ Window │ Stair... ║  │
│ ╚═══════════════════════════════════════════════════════╝  │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ ✅ Common Edges     [pen 7 ▾] [solid ▾] [████] [×]    │ │
│ │ ✅ Cut Pattern      [pen 1 ▾] [solid ▾] [████] [×]    │ │
│ │ 🔒 Surface Pattern  ─────── Δεν ρεντάρει ακόμη ─────── │ │
│ │ 🔒 Hidden Lines     ─────── Δεν ρεντάρει ακόμη ─────── │ │
│ │ 🔒 Sweeps           ─────── Δεν ρεντάρει ακόμη ─────── │ │
│ │ 🔒 Reveals          ─────── Δεν ρεντάρει ακόμη ─────── │ │
│ └────────────────────────────────────────────────────────┘ │
│ [Reset to Defaults] [Apply to All Levels]                  │
└────────────────────────────────────────────────────────────┘
```

**Row components**:
- ✅/🔒 status icon (wired vs stub)
- Display name (i18n)
- Pen dropdown (1-16 with mm preview at current scale)
- Line pattern dropdown (28 built-in + custom + visual preview)
- Color picker (hex input + "Reset to canvas token" [×] button)
- Stub rows greyed-out + tooltip "Δεν ρεντάρει ακόμη — αναμονή ADR-Xxx"

**Persistence**: 500ms debounced write to `dxf_viewer_levels/{levelId}.bimRenderSettings.objectStyles.{cat}.subcategories.{key}` (via Phase B.2 `updateDxfLevelWithPolicy`).

### 6.2 Custom line pattern creation (within LinePatternPicker)

Dropdown bottom has [+ New Custom Pattern...] button → opens modal:

```
┌──────────────────────────────────────┐
│ Νέο Custom Line Pattern              │
├──────────────────────────────────────┤
│ Όνομα:    [ζικ-ζακ μόνωσης         ] │
│ Stroke pattern:                      │
│   Dash 1:   [4 ] px                  │
│   Gap 1:    [2 ] px                  │
│   Dash 2:   [2 ] px                  │
│   Gap 2:    [2 ] px                  │
│   [+ Add segment]                    │
│                                      │
│ Preview: ▬▬ ▬ ▬▬ ▬                  │
│                                      │
│ [Cancel]                  [Save]     │
└──────────────────────────────────────┘
```

Saved to `projects/{projectId}.bimCustomLinePatterns` with `custom_<slug>` key.

---

## 7. Migration

### 7.1 Existing levels

No schema migration required. `subcategories` is an **optional** field added to existing `ObjectStyle`. Levels created before ADR-377 have no `subcategories` → resolver falls back to parent ObjectStyle exactly as Phase A (zero behavioral change).

### 7.2 Phase C wiring rollout

Per-renderer wiring (Phase C) is **non-destructive**:
- BEFORE wiring: renderer calls legacy `resolveLineWeightPx({ category, cutState, ... })` → parent style
- AFTER wiring: renderer calls `resolveSubcategoryStyle({ ..., subcategoryKey })` → tries sub override, falls back to parent

If user has not set any subcategory override → output is byte-identical to pre-ADR-377 rendering. **No visual regression**.

### 7.3 Phase E 3D rollout

3D renderer reads same SSoT. Levels without subcategory overrides → 3D output identical to pre-ADR-377 (only changes when user explicitly sets a subcategory style).

---

## 8. Open Questions

Locked decisions (Q1-Q11):

| Q | Topic | Decision (date) |
|---|---|---|
| Q1 | Override scope | Pen + LinePattern + Colors (2026-05-26) |
| Q2 | Taxonomy | 47 (42 Revit + 5 extras), 23 wired + 24 stubs (2026-05-26) |
| Q3 | Custom subcategories | ❌ Removed (moved to ADR-378 as Family Types) |
| Q4 | Custom storage | ❌ N/A after Q3 |
| Q5 | Element tagging | ❌ N/A after Q3 (no per-element field) |
| Q6 | Industry pattern | Revit Family Types — but for Q7 (split), ADR-377 keeps only subcategories |
| Q7 | Scope split | Two ADRs: 377 (subcategories) + 378 (Family Types) (2026-05-26) |
| Q8 | LinePattern count | AutoCAD acad.lin set (~28 patterns) + custom (2026-05-26) |
| Q9 | UI placement | New dedicated panel (ArchiCAD-style tabs per category) (2026-05-26) |
| Q10 | 3D parity | Inside ADR-377 (Αρχή Α — One Model Many Views) (2026-05-26) |
| Q11 | Color theme | Single optional + fallback to canvas token (2026-05-26) |

Deferred to draft review (best-guess in this doc):

| Q | Topic | Proposed |
|---|---|---|
| Q12 | Default styles per 47 | Revit Architectural Template defaults as baseline. Verified per-subcategory in Phase A. |
| Q13 | Stub UX | 🔒 lock icon + greyed row + tooltip "Δεν ρεντάρει ακόμη — αναμονή ADR-Xxx" |
| Q14 | Phase plan | 6 sub-phases A-F, ~29-46h total (see §5) |
| Q15 | Reset-to-defaults granularity | Per-row [×] (clear single subcategory) + Per-category [Reset Wall] + Global [Reset All]. Confirmation modal on global. |
| Q16 | Apply-to-all-levels button | Optional convenience: copies current level's subcategories into all sibling levels in same project. Uses Phase B.3 propagateToLinkedLevels pattern. |
| Q17 | Subcategory schema versioning | None for v0.1. If future ADR adds new built-in keys, simply extend SUBCATEGORY_TAXONOMY — old levels gracefully ignore unknown keys. |

---

## 9. Risks

| Risk | Mitigation |
|---|---|
| Wired-vs-stub confusion ("user sets style, nothing changes") | Stub badge + tooltip + greyed-out controls in Phase D |
| 2D-3D drift (different defaults) | Phase E reads same SSoT — verified by integration test |
| Custom line pattern explosion | UI limit: max 50 custom patterns per project (validated at save) |
| Cut-state ambiguity for stubs (no Hidden Lines pass yet) | Stub fields editable but inert — when future ADR wires Hidden Lines, existing user settings take effect immediately |
| Bitmap cache miss after subcategory change | ADR-040 `bimSettingsHash` extended to include subcategory keys (Phase A) |
| Performance regression from 47 lookups per draw call | Subcategories Map cached per render frame — sub-microsecond lookup |

---

## 10. Architectural diagram (post-Phase E)

```
┌────────────────────────────────────────────────────────┐
│              SubcategoriesPanel (Phase D)              │
│  [Wall][Slab][Column][Beam][Door][Window][Stair]...    │
└────────────────────┬───────────────────────────────────┘
                     │ updates
                     ▼
┌────────────────────────────────────────────────────────┐
│   useBimRenderSettingsStore  (Phase B.2 + extension)   │
│   .objectStyles.{cat}.subcategories.{key}              │
│   .customLinePatterns (per project)                    │
└────────────────────┬───────────────────────────────────┘
                     │ subscribe
        ┌────────────┴────────────┐
        │                         │
        ▼                         ▼
┌──────────────────┐    ┌──────────────────────┐
│  2D Renderers    │    │   3D Renderer        │
│  (Canvas2D)      │    │   (THREE.js)         │
│                  │    │                      │
│ resolveSubStyle  │    │  bim-3d-style-bridge │
│   → lineWidthPx  │    │   → LineMaterial     │
│   → setLineDash  │    │   → linewidth        │
│   → strokeStyle  │    │   → dashSize         │
└──────────────────┘    └──────────────────────┘
```

---

## 11. Changelog

- **v0.6 (2026-05-26)** — Phase C.3 IMPLEMENTED. Opening + Stair 2D renderers wired. `OpeningRenderer`: per-kind subcategory key routing via `openingOutlineSubcat()` + `openingOverlaySubcat()` helpers (door-opening / window-opening / wall-cutout-jambs / sliding-track / door-plan-swing / window-glass). `StairRenderer`: all 5 draw methods wired (`drawWalkline`, `drawHandrails`, `drawArrow`, treads/stringers via extended `StairStyleContext`). `StairStyleContext` extended with `treadsLineWidth?` + `stringersLineWidth?`. `stair-render-structure-style.ts` updated to use per-subcategory widths. `DEFAULT_OBJECT_STYLES.stair` gets default subcategories: walkline='dashed' [8,4] + handrails='dashed2' [4,2] (visual non-regression). 11 new tests (OpeningRenderer-subcategory-wiring 6 + StairRenderer-subcategory-wiring 5). 26/26 PASS (new C.2+C.3) + 19/19 PASS (C.1 regression). TSC pending.
- **v0.5 (2026-05-26)** — Phase C.2 IMPLEMENTED. Beam + Column 2D renderers wired. `BeamRenderer`: `hidden-lines` subcategory for dashed outline (resolveSubcategoryStyle replaces resolveLineWeightPx), `section-profile` subcategory for steel I/H symbol (color + lineWidth override). `ColumnRenderer`: `section-profile` subcategory for L/T steel symbol (color + lineWidth override). `DEFAULT_OBJECT_STYLES.beam` gets default subcategory: hidden-lines='dashed' [8,4] (exact match for OUTLINE_DASH, zero visual regression). 8 new tests (BeamRenderer-subcategory-wiring 5 + ColumnRenderer-subcategory-wiring 3). TSC pending.
- **v0.4 (2026-05-26)** — Phase C.1 IMPLEMENTED. Wall/Slab/SlabOpening 2D renderers wired. `WallRenderer.drawFootprint()` → `common-edges`, `WallRenderer.drawMaterialHatch()` → `cut-pattern`, `SlabRenderer.render()` → `common-edges`, `SlabOpeningRenderer.render()` → `edges`. `linePatternToDashArray()` applied per draw call. Color overrides via `ctx.strokeStyle` when non-null. SlabOpening preserves per-kind KIND_DASH fallback when linePattern='solid' (additive, zero regression). 19 new tests (3 files × 6-7 tests: WallRenderer-subcategory-wiring, SlabRenderer-subcategory-wiring, SlabOpeningRenderer-subcategory-wiring). 19/19 PASS. TSC pending.
- **v0.3 (2026-05-26)** — Phase B IMPLEMENTED. `resolveSubcategoryStyle()` + `ResolvedSubcategoryStyle` + `SubcategoryResolutionContext` added to `bim-line-weight-resolver.ts`. `resolveLineWeightPx()` re-implemented as thin wrapper (zero behavior change). 30 new tests (7 groups: parent fallback, cutPen/projectionPen overrides, linePattern override, color overrides, beyond state, unknown keys, wrapper regression). 43/43 PASS. TSC clean.
- **v0.2 (2026-05-26)** — Phase A IMPLEMENTED. 2 NEW SSoT files (`bim-line-patterns.ts`: 28 patterns + `linePatternToDashArray()`, `bim-subcategories.ts`: 47 keys + 23-entry WIRED_SUBCATEGORIES + 2 helpers). 1 MODIFIED (`bim-object-styles.ts`: `SubcategoryStyle` interface + `ObjectStyle.subcategories?` extension). Cache invalidation verified automatic via existing `JSON.stringify` in `dxf-bitmap-cache.ts:54`. 47 new tests + 35 regression = 82 tests PASS. TSC clean. Pending commit.
- **v0.1 (2026-05-26)** — DRAFT created. Clarification phase με Giorgio (Q1-Q11 locked). Industry research confirms 47 subcategories taxonomy. Architecture decided: extend ADR-375 Tier 2 with optional `subcategories` map. 6-phase plan ~29-46h total. Custom Wall Types / Door Types etc deferred to ADR-378 BIM Family Types.

---

## 12. References

- ADR-375 BIM Entity Line Weight Semantic System (parent)
- ADR-358 Lineweight ISO Catalog (shared base)
- ADR-370 BIM 3D Readonly Viewer (3D parity target)
- ADR-040 Preview Canvas Performance (bitmap cache rules)
- ADR-261 Execution Mode Decision (orchestrator vs plan mode)
- ADR-299 Ratchet Backlog Master Roadmap (Phase F ratchet entry)
- Revit Object Styles dialog (industry research, Autodesk documentation)
- ArchiCAD Component Pens (industry research, Graphisoft documentation)
- AutoCAD acad.lin standard line patterns
