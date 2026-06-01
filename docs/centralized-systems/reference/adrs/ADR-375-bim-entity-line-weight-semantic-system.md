# ADR-375 — BIM Entity Line Weight Semantic System (Revit-Equivalent)

| Status | Date | Author | Strategy |
|--------|------|--------|----------|
| ✅ **Phase A DONE** · ✅ **Phase B.1 DONE** · ✅ **Phase B.2 DONE** · ✅ **Phase B.3 DONE** · 🩹 **Phase B Runtime Wiring HOTFIX 2026-05-26** · ✅ **Phase C.1 DONE 2026-05-26** · ✅ **Phase C.2 DONE 2026-05-26** · ✅ **Phase C.4 DONE 2026-05-26** · 🩹 **Phase C.4 V/G Visibility Runtime Wiring HOTFIX v2.6 2026-05-26** · 🎨 **Phase C.4 V/G Color Picker UX swap v2.7 2026-05-26** · 🩹 **Phase C.4 V/G > Layer Priority Stack Fix v2.8 2026-05-26** · ✅ **Phase C.5 DONE 2026-05-26** · ✅ **Phase C.6 DONE 2026-05-26** · ✅ **Phase C.7 DONE 2026-05-26 (3D parity)** · ✅ **Phase C.8 DONE 2026-06-02 (Hide BIM / DXF-only toggle)** | 2026-05-25 / 2026-06-02 | Giorgio Pagonis + Claude (Sonnet 4.6 / Opus 4.7 / Opus 4.8) | **Full Revit Clone — Enterprise — Unified SSoT with ADR-358** |

**Related ADRs**:
- ADR-044 — Centralized Canvas Line Widths (current generic SSoT, will coexist)
- ADR-040 — Preview Canvas Performance (rendering pipeline)
- ADR-363 — BIM Drawing Mode (BIM entities baseline)
- ADR-370 — BIM Readonly Visualization (3D parity scope)
- ADR-358 — Layer Management System (potential override layer)
- ADR-365 — Tailwind Semantic Palette Enforcement (theme tokens)
- ADR-343 — DXF Canvas Visual Regression Suite (baseline updates required)

---

## 1. Context

### 1.1 Current State (baseline)

Όλοι οι BIM renderers του 2D canvas χρησιμοποιούν **ένα μοναδικό σταθερό πάχος**:

```typescript
// src/subapps/dxf-viewer/config/text-rendering-config.ts (ADR-044)
export const RENDER_LINE_WIDTHS = {
  THIN: 1, NORMAL: 2, THICK: 3,
} as const;
```

Consumers (όλοι σε `NORMAL = 2px`):
`WallRenderer`, `SlabRenderer`, `ColumnRenderer`, `BeamRenderer`, `OpeningRenderer`, `SlabOpeningRenderer`, `StairRenderer`.

### 1.2 Problem statement

Καμία σημασιολογική διάκριση μεταξύ:
1. **Cut** (στοιχείο που τέμνεται από plane) vs **Projection** (στοιχείο σε προβολή)
2. **Structural** (φέρων) vs **Secondary** (άνοιγμα, σκάλα)
3. **Scale-awareness** (το πάχος δεν προσαρμόζεται στην κλίμακα/zoom)
4. **Per-category control** (δεν αλλάζει επιλεκτικά)

Αντιβαίνει σε ISO 128-20 και σε όλα τα enterprise BIM tools.

### 1.3 Goal — **Full Revit-Equivalent System**

> Decision (Giorgio, 2026-05-25): _"FULL ENTERPRISE — ΘΕΛΩ ΝΑ ΚΑΝΟΥΜΕ ΑΥΤΟ ΠΟΥ ΚΑΝΕΙ Η REVIT"_

Καθαρή αναπαραγωγή του Revit μοντέλου, όχι compact παραλλαγή.

### 1.4 Architectural Relationship with ADR-358 — Unified SSoT, Dual Resolvers

> Decision (Giorgio, 2026-05-25): _"Ενοποιημένο σύστημα, μία SSoT, δύο resolvers (όπως Revit)"_

**Pure SSoT principle**: μία και μοναδική πηγή αλήθειας για τις ISO mm values. Δύο paradigms που μοιράζονται την ίδια πηγή.

```
                  ┌──────────────────────────────────┐
                  │  SHARED SSoT — ISO Pen Catalog   │
                  │  src/subapps/dxf-viewer/config/  │
                  │  lineweight-iso-catalog.ts       │  ← ADR-358 §G6
                  │                                  │
                  │  24 ISO mm values (frozen)       │
                  │  + 3 special: -3/-2/-1           │
                  │  Pre-commit ratchet active       │
                  └────────────┬─────────────────────┘
                               │
                ┌──────────────┴───────────────┐
                ▼                              ▼
      ┌─────────────────────┐       ┌─────────────────────┐
      │  CAD RESOLVER       │       │  BIM RESOLVER       │
      │  (ADR-358)          │       │  (ADR-375)          │
      │                     │       │                     │
      │ entity.lineweight   │       │ category +          │
      │ → layer.lineweight  │       │ cut/projection +    │
      │ → project default   │       │ scale → pen index   │
      │ → system 0.25mm     │       │ → ISO mm value      │
      └──────────┬──────────┘       └──────────┬──────────┘
                 │                             │
                 ▼                             ▼
       DXF entities (Line,             BIM entities (Wall,
       Polyline, Circle, Arc,          Column, Slab, Beam,
       Polygon, Hatch, Text)           Opening, Stair)
```

**Σταθερές αρχές**:
1. **Pen Table mm values ΔΕΝ είναι hardcoded** — αναφέρονται στο `LINEWEIGHT_ISO_VALUES` του ADR-358.
2. **BIM entities ΠΟΤΕ δεν περνούν από CAD resolver** — έχουν δικό τους paradigm (Object Styles).
3. **Pre-commit ratchet `lineweight-iso-catalog`** ήδη ενεργό — μπλοκάρει hardcoded ISO values εκτός catalog.
4. **Phase B (Ribbon UI)**: ξεχωριστά panels για DXF Layers (ADR-358) και BIM Object Styles (ADR-375), αλλά **κοινός catalog browser** για mm picker.

---

## 2. Revit Architecture — Verified from Web Research (2026-05-25)

### 2.1 Four-tier model (full Revit)

```
┌────────────────────────────────────────────────────────────┐
│ TIER 0 — VIEW RANGE (per plan view)                        │
│ 4 horizontal planes: Top / Cut Plane / Bottom / View Depth │
│ Determines: cut | projection | <Beyond> per element        │
│ Default Cut Plane height: 1.20m (4ft) for floor plans      │
└────────────────────────────────────────────────────────────┘
                            │
                            ▼ (state lookup: cut|projection|beyond)
┌────────────────────────────────────────────────────────────┐
│ TIER 1 — PEN TABLE (Manage → Additional Settings → Line Weights) │
│ 16 pens × 6 scale columns = 96 mm values                   │
│ Pen #1, #2 reserved (hatches, ceiling patterns)            │
│ Pens #3-#16 for general use                                │
└────────────────────────────────────────────────────────────┘
                            │
                            ▼ (pen index lookup)
┌────────────────────────────────────────────────────────────┐
│ TIER 2 — OBJECT STYLES (Manage → Object Styles)            │
│ Per category: { projectionPen: 1-16, cutPen: 1-16 }        │
│ Subcategories: finer control (Door panel, Door swing, ...) │
└────────────────────────────────────────────────────────────┘
                            │
                            ▼ (category lookup at render)
┌────────────────────────────────────────────────────────────┐
│ TIER 3 — VIEW OVERRIDES (Visibility/Graphics → Override)   │
│ Per-view OR per-element override (cut, projection, color)  │
└────────────────────────────────────────────────────────────┘
```

### 2.0 View Range mechanics (NEW — Tier 0)

**Primary range** = 3 horizontal planes:
- **Top plane**: elements above are NOT shown
- **Cut Plane**: elements intersecting → **CUT** (παχύ)
- **Bottom plane**: lower boundary of primary range

**View Depth** = extra plane below Bottom:
- Elements within → `<Beyond>` line style (διακεκομμένο, λεπτό, halftone)
- **Exception**: Floors / Structural Floors / Stairs / Ramps within 4ft (1.22 m) below Bottom → drawn with **Projection** line weight (not Beyond)

**Display rules (verified)**:
| Element Z-range vs view planes | Display state | Line weight |
|--------------------------------|--------------|-------------|
| Intersects **Cut Plane** | **Cut** | category.cutPen |
| Within primary range, not cutting | **Projection** | category.projectionPen |
| Below Bottom, within View Depth (general case) | **Beyond** | `<Beyond>` line style |
| Floors/Stairs/Ramps within 4ft below Bottom | **Projection** (exception) | category.projectionPen |
| Above Top plane | **Not shown** | — |

**Default Cut Plane height**: 4ft (1.22m). Adjustable per view.

### 2.2 Revit defaults (researched, verified)

#### Pen Table — 16 pens

- **Pen #1**: reserved για hatches/fill patterns
- **Pen #2**: reserved για ceiling surface patterns
- **Pens #3–#16**: γενική χρήση
- **Mathematical ladder (ISO 128)**: `wₙ₊₁ = wₙ × √2`
- **ISO color coding** (από πιστοποιημένη πηγή):
  - 0.18 mm → Red, 0.25 mm → White, 0.35 mm → Yellow,
  - 0.50 mm → Brown, 0.70 mm → Blue, 1.00 mm → Orange, 1.40 mm → Green
- **Recommended ladder**: 0.10, 0.13, 0.18, 0.25, 0.35, 0.50, 0.70, 1.00, 1.40 mm

#### Scale Columns — 6 default (customizable)

Default κλίμακες (παράδειγμα): 1:10, 1:20, 1:50, 1:100, 1:200, 1:500.
Fallback: αν δεν ορίζεται κλίμακα → χρησιμοποιείται η πλησιέστερη.

#### Object Styles — Default category-to-pen (verified)

| Category | Projection Pen | Cut Pen |
|----------|:--:|:--:|
| **Walls** | 2 | 5 |
| **Floors** | 2 | 5 |
| **Roofs** | 2 | 4 |
| **Doors** | 1 | 2 |
| **Windows** | 1 | 2 |
| **Stairs** | 1 | 3 |
| **Structural Columns** | 2 | 5 (often 9 in templates) |
| **Structural Framing** | 3 (often 10) | 4 |
| **Ceilings** | 1 | 2 |
| **Generic Models** | 1 | 2 |

> ⚠️ **Disclaimer**: Τα ακριβή Revit defaults διαφέρουν ελαφρώς ανά template (architectural/structural/mechanical). Οι τιμές παραπάνω είναι οι **πιο συνηθισμένες** σε Architectural Template, verified από πολλαπλές πηγές.

---

## 3. Decision — Our Architecture (Full Revit Clone)

### 3.1 Four-tier mapping στην εφαρμογή μας

```
TIER 0 — VIEW_RANGE
  → src/subapps/dxf-viewer/config/bim-view-range.ts
  → { topMm, cutPlaneMm, bottomMm, viewDepthMm } per plan view
  → Phase A: hard-coded defaults (cut=1200mm)
  → Phase C: per-view UI

TIER 1 — PEN_TABLE
  → src/subapps/dxf-viewer/config/bim-pen-table.ts
  → 16 pens × N scale columns
  → mm values (canonical), runtime → px via DPI

TIER 2 — OBJECT_STYLES
  → src/subapps/dxf-viewer/config/bim-object-styles.ts
  → Map<EntityCategory, { projectionPen, cutPen }>
  → Hard-coded defaults + (Phase B) user customization via ribbon

TIER 3 — VIEW_OVERRIDES (Phase C — μελλοντικό)
  → Per-view και per-element overrides
  → Layer-level override (συν-τίθεται με ADR-358)
  → <Beyond> line style override (Manage → Additional Settings → Line Styles)
```

### 3.2 Tier 1 — Pen Table (SSoT)

> **Pre-commit ratchet**: ΑΠΑΓΟΡΕΥΕΤΑΙ hardcoded ISO mm value. Όλες οι τιμές ΥΠΟΧΡΕΩΤΙΚΑ αναφέρονται στο `LINEWEIGHT_ISO_VALUES` του `lineweight-iso-catalog.ts` (ADR-358 §G6).

```typescript
// src/subapps/dxf-viewer/config/bim-pen-table.ts (NEW)

/**
 * ADR-375 — BIM Pen Table (Revit-equivalent)
 *
 * 16 pens × 6 scale columns = 96 lineweight assignments.
 * Values reference ISO catalog from ADR-358 (no duplication).
 *
 * Pen #1, #2: reserved (hatches, fill patterns) — per Revit convention.
 * Pens #3-#16: general use.
 *
 * Pre-commit ratchet `lineweight-iso-catalog` BLOCKS hardcoded ISO numeric
 * literals; this file uses only references to LINEWEIGHT_ISO_VALUES.
 */
import {
  LINEWEIGHT_ISO_VALUES,
  type ConcreteLineweightMm,
} from './lineweight-iso-catalog';

export const PEN_COUNT = 16 as const;

export const SCALE_COLUMNS = ['1:10', '1:20', '1:50', '1:100', '1:200', '1:500'] as const;
export type ScaleColumn = typeof SCALE_COLUMNS[number];

/** Pen index 1-16 (1-based, matching Revit UI). */
export type PenIndex = 1|2|3|4|5|6|7|8|9|10|11|12|13|14|15|16;

/**
 * Helper: lookup ISO value by mm magnitude.
 * Avoids hardcoded numeric literals (pre-commit ratchet compliance).
 */
const iso = (mm: number): ConcreteLineweightMm => {
  const found = LINEWEIGHT_ISO_VALUES.find(v => Math.abs(v - mm) < 0.005);
  if (!found) throw new Error(`Lineweight ${mm}mm not in ISO catalog`);
  return found as ConcreteLineweightMm;
};

/**
 * Pen Table: 16 rows × 6 columns of ConcreteLineweightMm (ISO catalog values).
 *
 * Per pen index → mm value at each scale column.
 * Larger scales (1:10, 1:20) use thicker mm, smaller (1:200, 1:500) thinner.
 *
 * NB: All values resolved through `iso()` helper → pre-commit ratchet PASS.
 */
export const PEN_TABLE_MM: readonly (readonly ConcreteLineweightMm[])[] = [
  // Pen #1 — reserved hatches (finest at all scales)
  [iso(0.05), iso(0.05), iso(0.05), iso(0.05), iso(0.05), iso(0.05)],
  // Pen #2 — reserved fill patterns
  [iso(0.09), iso(0.09), iso(0.09), iso(0.05), iso(0.05), iso(0.05)],
  // Pen #3 — finest general line (dimensions, annotations, <Beyond>)
  [iso(0.13), iso(0.13), iso(0.13), iso(0.13), iso(0.09), iso(0.09)],
  // Pen #4 — opening detail, door leaf
  [iso(0.18), iso(0.18), iso(0.18), iso(0.15), iso(0.13), iso(0.09)],
  // Pen #5 — wall/slab projection, stair cut
  [iso(0.25), iso(0.25), iso(0.25), iso(0.18), iso(0.13), iso(0.13)],
  // Pen #6 — beam cut, secondary structural
  [iso(0.35), iso(0.35), iso(0.30), iso(0.25), iso(0.18), iso(0.15)],
  // Pen #7 — wall cut, slab cut (default Revit walls)
  [iso(0.50), iso(0.40), iso(0.35), iso(0.35), iso(0.25), iso(0.18)],
  // Pen #8 — heavier projection
  [iso(0.60), iso(0.50), iso(0.50), iso(0.40), iso(0.35), iso(0.25)],
  // Pen #9 — structural column cut
  [iso(0.80), iso(0.70), iso(0.70), iso(0.50), iso(0.40), iso(0.35)],
  // Pen #10 — structural framing
  [iso(0.90), iso(0.80), iso(0.80), iso(0.60), iso(0.50), iso(0.40)],
  // Pen #11 — heavy structural cut
  [iso(1.0),  iso(1.0),  iso(0.90), iso(0.70), iso(0.50), iso(0.40)],
  // Pen #12
  [iso(1.2),  iso(1.06), iso(1.0),  iso(0.80), iso(0.60), iso(0.50)],
  // Pen #13
  [iso(1.4),  iso(1.2),  iso(1.06), iso(1.0),  iso(0.70), iso(0.50)],
  // Pen #14
  [iso(1.58), iso(1.4),  iso(1.2),  iso(1.06), iso(0.80), iso(0.60)],
  // Pen #15
  [iso(2.0),  iso(1.58), iso(1.4),  iso(1.2),  iso(1.0),  iso(0.70)],
  // Pen #16 — maximum heavy
  [iso(2.11), iso(2.0),  iso(1.58), iso(1.4),  iso(1.2),  iso(0.80)],
] as const;
```

> ⚠️ **Pen Table values είναι STARTING POINT**. Phase B Ribbon UI επιτρέπει per-project override. Όλες οι τιμές προέρχονται από `LINEWEIGHT_ISO_VALUES` (ADR-358 SSoT).

### 3.3 Tier 2 — Object Styles (category → pen mapping)

```typescript
// src/subapps/dxf-viewer/config/bim-object-styles.ts (NEW)

import type { PenIndex } from './bim-pen-table';

/**
 * Discriminated entity categories matching our BIM renderers.
 * Each maps to projection + cut pen indices (Revit Object Styles).
 */
export type BimCategory =
  | 'wall'
  | 'column'
  | 'beam'
  | 'slab'
  | 'opening'         // door/window opening in wall
  | 'slab-opening'    // floor opening (cutout)
  | 'stair'
  | 'roof'            // future
  | 'ceiling'         // future
  | 'dimension'       // annotation
  | 'hatch'           // fill pattern
  | 'grip';           // editing handle

export interface ObjectStyle {
  /** Pen used when element is in projection (not cut by plane) */
  projectionPen: PenIndex;
  /** Pen used when element is cut by view plane */
  cutPen: PenIndex;
}

/**
 * Default Object Styles — Revit Architectural Template equivalent.
 *
 * Verified defaults (web research 2026-05-25):
 * - Walls/Floors: P=2, C=5
 * - Doors/Windows: P=1, C=2
 * - Stairs: P=1, C=3
 * - Structural Columns: P=2, C=5 (or 9 for heavier templates)
 * - Structural Framing (beams): P=3, C=4
 */
export const DEFAULT_OBJECT_STYLES: Record<BimCategory, ObjectStyle> = {
  wall:         { projectionPen: 5,  cutPen: 7 },   // 0.18 / 0.35 mm
  column:       { projectionPen: 5,  cutPen: 9 },   // 0.18 / 0.70 mm
  beam:         { projectionPen: 4,  cutPen: 6 },   // 0.13 / 0.25 mm
  slab:         { projectionPen: 5,  cutPen: 7 },   // 0.18 / 0.35 mm
  opening:      { projectionPen: 3,  cutPen: 4 },   // 0.10 / 0.13 mm
  'slab-opening': { projectionPen: 3, cutPen: 4 },  // 0.10 / 0.13 mm
  stair:        { projectionPen: 3,  cutPen: 5 },   // 0.10 / 0.18 mm
  roof:         { projectionPen: 5,  cutPen: 6 },   // future
  ceiling:      { projectionPen: 3,  cutPen: 4 },   // future
  dimension:    { projectionPen: 3,  cutPen: 3 },   // 0.10 mm
  hatch:        { projectionPen: 1,  cutPen: 1 },   // reserved
  grip:         { projectionPen: 3,  cutPen: 3 },   // 0.10 mm
} as const;
```

> 📐 Pen indices επιλέχθηκαν από τον ladder ώστε να μιμηθούμε Revit's "thicker for cut", "thinner for projection" + 2-3 pen βήματα διαφορά.

### 3.4 Tier 0 — View Range (NEW)

```typescript
// src/subapps/dxf-viewer/config/bim-view-range.ts (NEW)

/**
 * ADR-375 — View Range (Revit-equivalent)
 *
 * 4 horizontal planes per plan view, in millimeters above level base.
 * Defaults match Revit Architectural Template floor plan.
 */
export interface ViewRange {
  /** Upper limit of primary range (mm). Elements above NOT shown. */
  topMm: number;
  /** Cut plane elevation (mm). Elements intersecting → CUT state. */
  cutPlaneMm: number;
  /** Lower limit of primary range (mm). */
  bottomMm: number;
  /** Lower limit of view depth (mm). Elements within → <Beyond> state. */
  viewDepthMm: number;
  /** Special-case range below Bottom (mm) — Floors/Stairs/Ramps draw as projection. */
  floorAdjustedRangeMm: number;  // default = 1220mm (4ft)
}

/** Revit Architectural Template default for floor plans. */
export const DEFAULT_VIEW_RANGE: ViewRange = {
  topMm: 2300,             // 2.30 m above level (above doors)
  cutPlaneMm: 1200,        // 1.20 m — primary cut
  bottomMm: 0,             // 0.00 m — current level
  viewDepthMm: -300,       // -0.30 m below level
  floorAdjustedRangeMm: 1220, // 4ft exception range
} as const;

/** Display state for an element at render time. */
export type CutState = 'cut' | 'projection' | 'beyond' | 'hidden';

/** Z-extents of an entity (mm above level base). */
export interface EntityZExtents {
  zBottomMm: number;
  zTopMm: number;
  /** Category needed for floor/stair/ramp exception. */
  category: 'wall'|'column'|'beam'|'slab'|'opening'|'slab-opening'|'stair'|'roof'|'ceiling'|'dimension'|'hatch'|'grip';
}

/**
 * Apply Revit view-range rules to derive display state.
 *
 * Per Revit display rules (verified web research 2026-05-25):
 *  1. zTop > topMm AND zBottom > topMm  → hidden
 *  2. zBottom ≤ cutPlaneMm ≤ zTop       → cut
 *  3. Within primary range, not cutting → projection
 *  4. Below bottomMm but within viewDepthMm:
 *       - Floor/Slab/Stair within floorAdjustedRangeMm below → projection (exception)
 *       - All other categories → beyond
 *  5. Below viewDepthMm → hidden
 */
export function resolveCutState(entity: EntityZExtents, range: ViewRange): CutState {
  const { zBottomMm, zTopMm, category } = entity;
  const { topMm, cutPlaneMm, bottomMm, viewDepthMm, floorAdjustedRangeMm } = range;

  // Rule 1: above top → hidden
  if (zBottomMm > topMm) return 'hidden';

  // Rule 2: intersects cut plane → cut
  if (zBottomMm <= cutPlaneMm && cutPlaneMm <= zTopMm) return 'cut';

  // Rule 3: within primary range (between bottom and top), not cutting
  if (zTopMm >= bottomMm && zBottomMm <= topMm) return 'projection';

  // Rule 4: below bottom, within view depth or floor-adjusted range
  if (zTopMm < bottomMm) {
    const isFloorLike = category === 'slab' || category === 'stair' || category === 'slab-opening';
    if (isFloorLike && zTopMm >= bottomMm - floorAdjustedRangeMm) return 'projection';
    if (zTopMm >= viewDepthMm) return 'beyond';
  }

  return 'hidden';
}
```

### 3.5 Tier 3 — Runtime resolver (cut/projection/beyond → line weight px)

```typescript
// src/subapps/dxf-viewer/config/bim-line-weight-resolver.ts (NEW)

import { PEN_TABLE_MM, SCALE_COLUMNS, type PenIndex } from './bim-pen-table';
import { DEFAULT_OBJECT_STYLES, type BimCategory } from './bim-object-styles';
import { resolveCutState, type ViewRange, type CutState } from './bim-view-range';

/** mm → CSS px (1 inch = 25.4 mm = 96 px @ standard DPI) */
export function mmToPx(mm: number, dpi: number = 96): number {
  return mm * (dpi / 25.4);
}

/** Map a numeric view scale (e.g., 100) to closest SCALE_COLUMN. */
export function closestScaleColumn(scaleDenominator: number): number {
  const numericScales = SCALE_COLUMNS.map(s => parseInt(s.split(':')[1], 10));
  let bestIdx = 0;
  let bestDiff = Math.abs(numericScales[0] - scaleDenominator);
  for (let i = 1; i < numericScales.length; i++) {
    const diff = Math.abs(numericScales[i] - scaleDenominator);
    if (diff < bestDiff) { bestDiff = diff; bestIdx = i; }
  }
  return bestIdx;
}

export interface LineWeightContext {
  category: BimCategory;
  cutState: CutState;        // resolved from ViewRange
  scaleDenominator: number;  // e.g. 100 means 1:100
  dpi?: number;
}

/** <Beyond> default — Pen #3 (finest, dashed). Per Revit Line Styles. */
const BEYOND_PEN: PenIndex = 3;

/**
 * Resolve line weight in screen pixels.
 *
 * Pipeline:
 *  1. Lookup ObjectStyle by category → projectionPen | cutPen
 *  2. If cutState='beyond' → use BEYOND_PEN
 *  3. Lookup mm value from PEN_TABLE_MM[penIndex-1][scaleColumn]
 *  4. Convert mm → px via DPI
 */
export function resolveLineWeightPx(ctx: LineWeightContext): number {
  if (ctx.cutState === 'hidden') return 0;

  const style = DEFAULT_OBJECT_STYLES[ctx.category];
  let penIdx: PenIndex;
  switch (ctx.cutState) {
    case 'cut':        penIdx = style.cutPen; break;
    case 'projection': penIdx = style.projectionPen; break;
    case 'beyond':     penIdx = BEYOND_PEN; break;
  }
  const scaleCol = closestScaleColumn(ctx.scaleDenominator);
  const mm = PEN_TABLE_MM[penIdx - 1][scaleCol];
  return mmToPx(mm, ctx.dpi);
}
```

### 3.6 Consumer pattern

```typescript
// Example: WallRenderer.ts (after migration)
import { resolveLineWeightPx } from '@/.../config/bim-line-weight-resolver';
import { resolveCutState, DEFAULT_VIEW_RANGE } from '@/.../config/bim-view-range';

function renderWall(ctx: CanvasRenderingContext2D, wall: BimWall, view: View) {
  const cutState = resolveCutState(
    { zBottomMm: wall.elevationMm, zTopMm: wall.elevationMm + wall.heightMm, category: 'wall' },
    view.viewRange ?? DEFAULT_VIEW_RANGE,
  );
  ctx.lineWidth = resolveLineWeightPx({
    category: 'wall',
    cutState,
    scaleDenominator: view.scaleDenominator,
    dpi: view.dpi,
  });
  // ...
}
```

---

## 4. Differences vs Pure Revit (justified)

| Revit feature | Our system | Reason |
|--------------|-----------|--------|
| 3 line-weight tabs (Model / Perspective / Annotation) | **1 unified table** (Phase A) | Δεν έχουμε ξεχωριστή perspective view ακόμη. Επεκτάσιμο. |
| User-editable PEN_TABLE via UI | **Code-only (Phase A)** + **Ribbon UI (Phase B)** | Phase A = SSoT λειτουργικός. Phase B = customization. |
| Subcategories (Door panel, swing) | **Flat categories (Phase A)** | Συνεπές με υπάρχοντα BIM model μας. Subcategories Phase C. |
| Per-view overrides | **Phase C** | Πρώτα χρειαζόμαστε `View` abstraction. |
| Layer-driven overrides (ADR-358) | **Phase B integration** | Coexist με ADR-358. Layer wins αν οριστεί explicit weight. |
| Mathematical ladder = √2 (ISO) | **Same** | Default ladder ταυτίζεται με ISO 128-20. |
| **View Range** (Top/Cut/Bottom/ViewDepth) | **Tier 0 SSoT** (Phase A: defaults only, Phase C: per-view UI) | Full Revit auto-detect from Day 1, UI editing later. |
| **`<Beyond>` line style** (dashed/halftone) | **Phase A: line weight only**, **Phase B: dashed pattern** | Phase A αρκεί ότι υπάρχει state distinction. Visual treatment dashed στο Phase B. |
| **Underlay** (αν προβολή άλλου επιπέδου) | **Phase D (separate ADR)** | Πολύ μεγαλύτερο feature· δεν αφορά line weights direct. |

---

## 5. Phases / Implementation Plan

### Phase A — Core SSoT + Migration ✅ APPROVED

**Scope**: 11 αρχεία (4 νέα + 7 modified renderers)
**Model recommendation**: **Sonnet 4.6** (per CLAUDE.md N.8: 5+ files / 1 domain)
**Estimated complexity**: Medium (~1.5-2h)

#### Implementation Sequence

**Step 1 — New SSoT files (4)** _[create in this order — dependency chain]_

1. **`src/subapps/dxf-viewer/config/bim-pen-table.ts`** (Tier 1)
   - Import `LINEWEIGHT_ISO_VALUES`, `ConcreteLineweightMm` from `lineweight-iso-catalog.ts`
   - Export `PEN_COUNT = 16`, `SCALE_COLUMNS`, `PenIndex` type
   - Export `PEN_TABLE_MM`: 16 × 6 matrix referenced through `iso(mm)` helper
   - Add test: `bim-pen-table.test.ts` — validate all 96 values ∈ ISO catalog
   - Add to `.ssot-registry.json` module list

2. **`src/subapps/dxf-viewer/config/bim-object-styles.ts`** (Tier 2)
   - Export `BimCategory` type union
   - Export `ObjectStyle` interface { projectionPen, cutPen }
   - Export `DEFAULT_OBJECT_STYLES` — Revit Architectural Template defaults
   - Add test: validate all categories assigned, pens within 1-16

3. **`src/subapps/dxf-viewer/config/bim-view-range.ts`** (Tier 0)
   - Export `ViewRange` interface
   - Export `DEFAULT_VIEW_RANGE` (Top=2300, Cut=1200, Bottom=0, ViewDepth=-300, FloorAdjusted=1220)
   - Export `CutState` type, `EntityZExtents` interface
   - Export `resolveCutState(entity, range): CutState` pure function
   - Add test: 6 scenarios (cut/projection/beyond/hidden + floor-adjusted exception)

4. **`src/subapps/dxf-viewer/config/bim-line-weight-resolver.ts`** (orchestrator)
   - Import from all 3 above + `lineweight-iso-catalog.ts`
   - Export `LineWeightContext` interface
   - Export `resolveLineWeightPx(ctx): number` orchestrator
   - Export `closestScaleColumn(denominator): number` helper
   - Use `lineweightToPx` from existing catalog
   - Add test: full pipeline (category + cutState + scale → px)

**Step 2 — Renderer migration (7)** _[migrate sequentially, run TSC after each]_

For each renderer file, replace `ctx.lineWidth = RENDER_LINE_WIDTHS.NORMAL` with:

```typescript
import { resolveLineWeightPx } from '@/.../config/bim-line-weight-resolver';
import { resolveCutState, DEFAULT_VIEW_RANGE } from '@/.../config/bim-view-range';

const cutState = resolveCutState(
  { zBottomMm: entity.elevationMm, zTopMm: entity.elevationMm + entity.heightMm, category: 'X' },
  view.viewRange ?? DEFAULT_VIEW_RANGE,
);
ctx.lineWidth = resolveLineWeightPx({
  category: 'X',
  cutState,
  scaleDenominator: view.scaleDenominator,
  dpi: view.dpi,
});
```

Renderer mapping:
5. `WallRenderer.ts` → `category: 'wall'`
6. `SlabRenderer.ts` → `category: 'slab'`
7. `ColumnRenderer.ts` → `category: 'column'`
8. `BeamRenderer.ts` → `category: 'beam'`
9. `OpeningRenderer.ts` → `category: 'opening'`
10. `SlabOpeningRenderer.ts` → `category: 'slab-opening'`
11. `StairRenderer.ts` → `category: 'stair'`

#### Pre-implementation checks

- [ ] Verify each BIM entity has `elevationMm` + `heightMm` properties (or equivalent z-extents)
- [ ] Confirm `view.scaleDenominator` available in render context (or pass via prop)
- [ ] Confirm `view.dpi` available (default 96)
- [ ] Run `npm run ssot:audit` BEFORE implementation (baseline)

#### Post-implementation checks

- [ ] Run `npx tsc --noEmit` — zero new errors
- [ ] Run BIM renderer tests (per ADR-343 visual regression — likely needs baseline update)
- [ ] Run `npm run ssot:audit` AFTER — no new violations
- [ ] Pre-commit hook: passes CHECK 3.7 (SSoT ratchet) and 6D (no architecture drift)
- [ ] Manual visual check at zoom 1.0 — verify wall=Pen #7, column=Pen #9, opening=Pen #4

#### Risk register

| Risk | Mitigation |
|------|-----------|
| BIM entity missing z-extents | Default to `{zBottom: 0, zTop: 3000}` per category, log warning |
| Visual regression on tests | Update ADR-343 baseline in same commit |
| Pre-commit ratchet fails on `iso()` helper | Test helper directly with mocked catalog; ensure pre-commit allows refs |
| Renderer prop signature change | Add optional fields with defaults; non-breaking |

#### Files NOT touched in Phase A

- `lineweight-iso-catalog.ts` (ADR-358) — read-only consumer
- `default-lineweight-resolver.ts` (ADR-358) — used only for DXF entities, not BIM
- `LayerOperationsService.ts` (ADR-358) — DXF layer logic, untouched
- DXF entity renderers (LineRenderer, PolylineRenderer, CircleRenderer, etc.) — DXF paradigm unchanged
- 3D viewer (ADR-370) — separate phase (Phase C)

> Phase A: όλα τα BIM entities καλούν `resolveLineWeightPx({ category, cutState, scale, dpi })`. Το `cutState` παράγεται αυτόματα από `resolveCutState(entity.zExtents, viewRange)`.

### Phase B — User Customization (Sub-phases B.1 / B.2 / B.3) ⏸️ PENDING

> **Scope decision (Giorgio, 2026-05-25)**: Σπάσιμο σε 3 υπο-φάσεις, μία ανά session (≤70% context per `feedback_phase_per_session`). Κάθε υπο-φάση = αυτόνομο commit chain + ADR update + ΕΚΚΡΕΜΟΤΗΤΕΣ update.
>
> **Σύνολο scope**: ~22-30 αρχεία, 5 domains (BIM resolver / Ribbon UI / Firestore / state / i18n).
> **Execution mode** (αν συνεχιστεί ως ενιαίο): Orchestrator. Με σπάσιμο: Plan Mode + Sonnet σειριακά ανά υπο-φάση.

#### Locked decisions (Giorgio, 2026-05-25)

| # | Decision | Choice |
|---|----------|--------|
| 1 | Drawing Scale source | **Β** — Νέος ξεχωριστός selector "Κλίμακα Σχεδίου", **decoupled from zoom** (Revit annotation scale pattern). Δεν αλλάζει με zoom in/out. |
| 2 | View Range storage | **Α + Β** — Inline στο floorplan document (Level 1, Revit basic) **+** ξεχωριστή `view_templates` library (Level 2, reusable templates) |
| 3 | Object Styles overrides | **ΝΑΙ** — Πλήρης πίνακας 8 categories × 2 dropdowns (projectionPen / cutPen) per floorplan |

---

#### Phase B.1 — Drawing Scale Selector ⏸️ NEXT

**Goal**: Νέο ribbon input "Κλίμακα Σχεδίου" που ορίζει `scaleDenominator` για τον BIM resolver, **ανεξάρτητο από το viewport zoom**.

**Scope**: ~6 αρχεία (4 new + 2 modified)

##### Files

| # | File | Type | Purpose |
|---|------|------|---------|
| 1 | `src/subapps/dxf-viewer/state/drawing-scale-store.ts` | NEW | Zustand store: `drawingScale: number` (default 100) + setter |
| 2 | `src/subapps/dxf-viewer/ui/ribbon/panels/DrawingScalePanel.tsx` | NEW | Ribbon panel: input "1: ___" + presets (1:10, 1:20, 1:50, 1:100, 1:200, 1:500) |
| 3 | `src/subapps/dxf-viewer/state/__tests__/drawing-scale-store.test.ts` | NEW | Store tests |
| 4 | `src/i18n/locales/{el,en}/dxf-viewer-ribbon.json` | MODIFIED | Keys: `drawingScale.label`, `drawingScale.presets.*` |
| 5 | `src/subapps/dxf-viewer/bim/renderers/*Renderer.ts` (×7) | MODIFIED | Replace `scaleDenominator: 100` (hardcoded) → `useDrawingScale()` getter |
| 6 | `src/subapps/dxf-viewer/ui/ribbon/RibbonViewTab.tsx` (or similar) | MODIFIED | Mount `<DrawingScalePanel />` |

##### Persistence (B.1)

- **Phase B.1 first cut**: in-memory store only (no Firestore yet)
- **Phase B.2**: επεκτείνεται με persistence στο floorplan document (`floorplan.drawingScale`)

##### Acceptance

- Drawing Scale input στο ribbon — αλλαγή τιμής triggers redraw όλων των BIM entities με νέα line weights
- Zoom in/out — η κλίμακα **ΔΕΝ** αλλάζει, οι γραμμές μένουν σταθερές σε mm
- Defaults: 1:100 αν δεν έχει οριστεί
- Validation: 1-10000 range (όπως υπάρχον `ScaleControls`)
- TSC clean + 35 (Phase A) tests still PASS + new B.1 store tests

##### Risk

| Risk | Mitigation |
|------|-----------|
| 7 renderers χρειάζονται store getter | Pattern ήδη υπάρχει — Zustand `useStore.getState()` ή dedicated hook |
| Σύγχυση με υπάρχον `ScaleControls` (1/zoom) | Document explicitly: ScaleControls = display zoom only, DrawingScalePanel = annotation scale (semantic) |

---

#### Phase B.2 — View Range + Object Styles (per floorplan, inline) ⏸️ AFTER B.1

**Goal**: Editable per-floorplan ρυθμίσεις:
1. View Range (4 numeric inputs: top/cut/bottom/viewDepth mm)
2. Object Styles overrides (8 categories × 2 pen dropdowns)

Persistence inline στο floorplan document (`floorplan.bimRenderSettings`).

**Scope**: ~10-12 αρχεία (6 new + 4-6 modified)

##### Files

| # | File | Type | Purpose |
|---|------|------|---------|
| 1 | `src/subapps/dxf-viewer/services/bim-render-settings.service.ts` | NEW | Firestore CRUD για `floorplan.bimRenderSettings` field |
| 2 | `src/subapps/dxf-viewer/state/bim-render-settings-store.ts` | NEW | Zustand: current floorplan's settings + setters + Firestore sync |
| 3 | `src/subapps/dxf-viewer/ui/ribbon/panels/ViewRangePanel.tsx` | NEW | 4 numeric inputs (top, cut, bottom, viewDepth) σε mm |
| 4 | `src/subapps/dxf-viewer/ui/ribbon/panels/ObjectStylesPanel.tsx` | NEW | Πίνακας 8 categories × 2 dropdowns (1-16 pen indices) |
| 5 | `src/subapps/dxf-viewer/services/__tests__/bim-render-settings.service.test.ts` | NEW | Service tests |
| 6 | `src/subapps/dxf-viewer/state/__tests__/bim-render-settings-store.test.ts` | NEW | Store tests |
| 7 | `src/subapps/dxf-viewer/types/floorplan-types.ts` | MODIFIED | Extend `Floorplan` interface με `bimRenderSettings?: { viewRange, objectStyles, drawingScale }` |
| 8 | `firestore.rules` | MODIFIED | Validation rule για `bimRenderSettings` subfield (immutable companyId, owner write) |
| 9 | `src/subapps/dxf-viewer/config/bim-line-weight-resolver.ts` | MODIFIED | Accept override Object Styles map (fallback to `DEFAULT_OBJECT_STYLES`) |
| 10 | `src/subapps/dxf-viewer/config/bim-view-range.ts` | MODIFIED | Add `resolveViewRange(floorplan): ViewRange` helper (override or default) |
| 11 | `src/i18n/locales/{el,en}/dxf-viewer-ribbon.json` | MODIFIED | Keys: `viewRange.*`, `objectStyles.*`, category labels |
| 12 | `src/subapps/dxf-viewer/ui/ribbon/RibbonViewTab.tsx` | MODIFIED | Mount 2 νέα panels |

##### Persistence model (B.2)

```typescript
// firestore: floorplans/{id}
{
  // ... existing fields
  bimRenderSettings?: {
    drawingScale: number;              // moved from B.1 in-memory → Firestore
    viewRange?: Partial<ViewRange>;    // omit → use DEFAULT_VIEW_RANGE
    objectStyles?: Partial<Record<BimCategory, ObjectStyle>>;  // partial override
  };
}
```

##### Acceptance

- ViewRangePanel: αλλαγή cut plane από 1200 → 800 → οι τοίχοι/κολώνες ξαναυπολογίζουν cutState
- ObjectStylesPanel: αλλαγή wall.cutPen από 7 → 9 → τοίχοι γίνονται παχύτεροι
- Firestore persistence: refresh σελίδας → οι ρυθμίσεις παραμένουν
- Defaults restore button → reset to `DEFAULT_VIEW_RANGE` + `DEFAULT_OBJECT_STYLES`
- TSC clean + όλα τα Phase A + B.1 tests PASS + νέα B.2 tests

##### Risk

| Risk | Mitigation |
|------|-----------|
| Firestore schema migration για legacy floorplans | Optional field, fallback chain `?.bimRenderSettings ?? DEFAULT_*` |
| Render loop αν store updates trigger Firestore writes | Debounce 500ms, write only on commit (blur/Apply button) |
| Mass override του ObjectStylesPanel μπερδεύει user | Highlight changed cells, "Reset category" + "Reset all" buttons |

---

#### Phase B.3 — View Templates Library (reusable, Revit Level 2) ✅ DONE 2026-05-25

**Goal**: Ξεχωριστή `view_templates` collection — reusable presets που εφαρμόζονται σε πολλά floorplans με ένα κλικ.

**Scope**: ~8-10 αρχεία (5 new + 3-5 modified)

##### Files

| # | File | Type | Purpose |
|---|------|------|---------|
| 1 | `src/subapps/dxf-viewer/services/view-template.service.ts` | NEW | Firestore CRUD: list / create / update / delete / apply template |
| 2 | `src/subapps/dxf-viewer/state/view-template-store.ts` | NEW | Zustand: cached templates list + currently-applied template per floorplan |
| 3 | `src/subapps/dxf-viewer/ui/ribbon/panels/ViewTemplatesPanel.tsx` | NEW | List τα templates + "Apply to current" + "Save current as template" + "Edit" + "Delete" |
| 4 | `src/subapps/dxf-viewer/ui/dialogs/ViewTemplateEditorDialog.tsx` | NEW | Modal: edit template name + viewRange + objectStyles + drawingScale |
| 5 | `src/subapps/dxf-viewer/services/__tests__/view-template.service.test.ts` | NEW | Service tests |
| 6 | `src/subapps/dxf-viewer/types/floorplan-types.ts` | MODIFIED | Add `appliedViewTemplateId?: string` στο `Floorplan` (cross-link to template) |
| 7 | `firestore.rules` | MODIFIED | Rules για `view_templates` collection (companyId scoped, role-based write) |
| 8 | `firestore.indexes.json` | MODIFIED | Composite index `companyId` + `createdAt` για list query |
| 9 | `src/config/firestore-collections.ts` | MODIFIED | Add `VIEW_TEMPLATES = 'view_templates'` |
| 10 | `src/subapps/dxf-viewer/ui/ribbon/RibbonViewTab.tsx` | MODIFIED | Mount `<ViewTemplatesPanel />` |

##### Persistence model (B.3)

```typescript
// firestore: view_templates/{id} — enterprise ID prefix: 'vtmpl_'
interface ViewTemplate {
  id: string;
  companyId: string;
  name: string;                              // "Standard Plan", "Section Cut Low"
  description?: string;
  drawingScale: number;
  viewRange: ViewRange;
  objectStyles: Record<BimCategory, ObjectStyle>;
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
}

// floorplan reference (optional)
interface Floorplan {
  // ...
  appliedViewTemplateId?: string;   // if set, bimRenderSettings ignored
}
```

##### Apply semantics

- Όταν `appliedViewTemplateId` οριστεί → resolver χρησιμοποιεί τις τιμές του template
- Αλλάζεις το template → όλα τα floorplans που το χρησιμοποιούν ενημερώνονται **αυτόματα** (Revit behavior)
- "Detach from template" → copies template values στο `floorplan.bimRenderSettings` και αδειάζει `appliedViewTemplateId`

##### Acceptance

- Create template "Στάνταρ Κάτοψη" → εμφανίζεται στο dropdown
- Apply σε 3 floorplans → όλα κρατούν τις ίδιες ρυθμίσεις
- Edit template → 3 floorplans αυτόματα ενημερώνονται
- Delete template ενώ είναι in use → confirmation: "Detach από X floorplans;"
- Enterprise ID prefix: `vtmpl_` (add to `enterprise-id.service.ts` generators)
- TSC clean + όλα τα προηγούμενα tests PASS + νέα B.3 tests

##### Risk

| Risk | Mitigation |
|------|-----------|
| Stale template reference (template deleted) | Resolver falls back to `DEFAULT_*` αν `appliedViewTemplateId` δεν βρίσκεται |
| Mass update lag (1 template → 50 floorplans re-render) | Templates loaded once στο store, floorplans listen via store selector (no per-doc Firestore round-trip) |
| Concurrent edit conflict | Last-write-wins με `updatedAt` ως optimistic version (standard Firestore pattern) |

---

#### Cross-cutting items (όλα τα B sub-phases)

- **<Beyond> line style visual treatment** (dashed pattern + halftone) → Phase B.2 (μέρος του Object Styles)
- **Pen Table editor** (16 × 6 grid) → **DEFERRED to Phase C** (όχι μέρος B.1/B.2/B.3 per Giorgio's scope)
- **Pen Sets presets** (Design / Construction / Presentation) → **DEFERRED to Phase C**
- **i18n keys**: όλα τα νέα UI strings σε el + en locales (Giorgio rule N.11)
- **Enterprise IDs**: `vtmpl_` prefix στο `enterprise-id.service.ts` (rule N.6)
- **Pre-commit hooks**: όλα τα PRs περνούν CHECK 3.7 (SSoT ratchet), 3.13 (i18n resolver reachability), 6D (architecture protection)

#### Session boundaries

| Sub-phase | Estimated time | Context budget | Commit chain |
|-----------|---------------|----------------|--------------|
| B.1 | ~1.5-2h | ≤50% | 1 commit: "feat(bim/ribbon): drawing scale selector (Phase B.1)" |
| B.2 | ~3-4h | ≤70% | 2-3 commits (service / panels / wiring) |
| B.3 | ~3-4h | ≤70% | 2-3 commits (service / panels / wiring) |

> **Rule**: Each sub-phase ends with explicit ADR-375 changelog entry + ΕΚΚΡΕΜΟΤΗΤΕΣ update (per CLAUDE.md N.15) + `pending-ratchet-work.md` update if applicable.

### Phase C — Advanced

- **C.1 Pen Table editor** ✅ DONE 2026-05-26 — `dxf_viewer_pen_tables/{companyId}` singleton, Zustand store + `setPenTableSource()` resolver injection, `PenTablePanel.tsx` 16×6 grid UI. 10 tests PASS.
- **C.2 Pen Sets presets** ✅ DONE 2026-05-26 — `bim-pen-sets.ts` (Design/Construction/Presentation ISO tables + `penSetToOverrides`), store `+applyPreset(name)/activePresetName`, service `+activePresetName` Firestore field, `PenTablePanel.tsx` preset tabs (Design|Construction|Presentation|Custom, `aria-pressed`). 25/25 tests PASS.
- Subcategories (Door panel/swing, Wall layers cut/skin) — covered by ADR-377
- **C.4 Per-view overrides (Visibility/Graphics)** ✅ DONE 2026-05-26 — See §5.Phase-C description. `ObjectStyle` extended with `visible?/projectionColor?/cutColor?/projectionPattern?/cutPattern?`. `resolveIsCategoryVisible()` helper + `resolveSubcategoryStyle` applies full V/G priority stack (subcategory > category V/G > global > DEFAULT). Store `+setObjectStyleVisibility/+setObjectStyleVgColor/+setObjectStyleVgPattern` setters (500ms debounce → Firestore). `VisibilityGraphicsPanel.tsx` 12-category × 7-column table (visibility eye toggle + projPen/projColor/projPattern + cutPen/cutColor/cutPattern). Ribbon wiring: VISIBILITY_GRAPHICS_PANEL in View tab. i18n el+en. 24/24 new tests PASS. **🩹 v2.6 Runtime Wiring HOTFIX 2026-05-26**: Ο resolver helper υπήρχε αλλά κανείς renderer δεν τον κάλεσε στο render-entry — τα fill/hatch/hover/grips έτρεχαν εκτός resolver path, οπότε το V/G eye toggle δεν έκρυβε στην πράξη τίποτα. Fix: 7 BIM 2D renderers + early-return στο `render()` top + `BimSceneLayer.sync()` (3D) category filter + `BimViewport3D.tsx` `objectStyles` subscription. 2 new tests (renderer skip + 3D layer filter).
- **C.5 Per-element overrides** ✅ DONE 2026-05-26 — `BimElementStyleOverride` interface (`visible?/projectionPen?/cutPen?/color?/linePattern?`) in `bim-object-styles.ts`. `BimEntity.styleOverride?: BimElementStyleOverride` field (Firestore-persisted). `SubcategoryResolutionContext.elementOverride?` field. `resolveSubcategoryStyle` updated: new C.5 priority stack (elementOverride.visible=false → zero; elementOverride.cutPen/projectionPen → pen+color+pattern override; partial override color/pattern without pen falls through to objectStyles pen). 7 BIM renderers wired (WallRenderer ×2, SlabRenderer, SlabOpeningRenderer, ColumnRenderer, BeamRenderer ×2, StairRenderer lambda, OpeningRenderer lambda). 17/17 new tests PASS. 43/43 existing resolver tests PASS (zero regression).
- **C.6 Layer-driven overrides (ADR-358 integration)** ✅ DONE 2026-05-26 — `BimLayerOverride` interface (`lineweightMm?: ConcreteLineweightMm, color?: string | null`). `SubcategoryResolutionContext.layerOverride?` field. `resolveSubcategoryStyle` updated: new C.6 priority block after C.5 pen override — if `layerOverride.lineweightMm` is concrete, bypass pen table entirely and use `lineweightToPx(mm, dpi)` directly. Color chain: `elementOverride.color > layerOverride.color > subcategory/parent`. Pattern unaffected by layerOverride. 7 BIM renderers wired (`getLayer(entity.layerId)` + `isConcreteLineweight` guard → `_layerOverride`). 16/16 new tests PASS (`bim-layer-override.test.ts`). 181/181 total config suite tests PASS (zero regression).
- **C.7 3D parity — BIM edge overlay (ADR-370 integration)** ✅ DONE 2026-05-26 — Full mirror του 2D SSoT priority stack στο BIM 3D viewer. Industry convergence (Phase 1 research: Autodesk Forge / Three.js Editor / Revit / ArchiCAD): `Line2 / LineSegments2 + LineMaterial + LineSegmentsGeometry` (three/examples/jsm/lines) για screen-space thick lines (LineBasicMaterial.linewidth ignored από WebGL → 1px πάντα). `THREE.EdgesGeometry(geo, 30°)` silhouette filter (Revit/ArchiCAD default). `linewidth × devicePixelRatio` για High-DPI crisp. `depthTest: true / depthWrite: false` ώστε edges να φαίνονται χωρίς z-fighting. `alphaToCoverage: true` για MSAA edge smoothing. **NEW (4 αρχεία)**: `bim-3d-edge-resolver.ts` (wrapper γύρω από `resolveSubcategoryStyle` — zero duplication, default thresholdAngle 30°), `bim-3d-edge-overlay-builder.ts` (`buildEdgeOverlay(mesh, opts) → LineSegments2 | null` + `attachEdgeOverlay(mesh, overlay)` helpers, geometry.dispose unsubscribes resolution store), `bim-edge-resolution-store.ts` (singleton με `setSize/subscribe/copyInto/getSize` — ADR-040 compliant, μηδέν high-freq subscriptions), 2 test files (~30 tests καλύπτοντας priority stack pass-through + LineSegments2 type + DPR multiplication + resolution sync + dispose unsubscribe + industry config). **MODIFIED (5 αρχεία)**: `BimToThreeConverter.ts` (4 entity types: wall/column/beam/slab — `attachEdgesProjection` helper με canonical BimCategory + scaleDenominator=100 + dpi=96 defaults), `wall-opening-extrude.ts` (per-segment edge attach μέσα στο segment loop), `StairToThreeConverter.ts` (`attachStairEdges` helper με ADR-377 subcategory keys: treads→`treads`, risers→`risers`, stringers→`outlines`, landings→parent stair — handrails skipped γιατί tubes σε 30° δεν παράγουν αναγνωρίσιμη σιλουέτα), `ThreeJsSceneManager.ts` (one-line wire στο `resize()` → `bimEdgeResolutionStore.setSize(width, height)`). **Lifecycle**: edge overlays = children των parent BIM meshes (`mesh.add(overlay)`), `BimSceneLayer.clearGroup()` recursive dispose τα καλύπτει automatic, raycast hits παραμένουν στο parent (overlays είναι visual decoration). **Outcome**: όταν αλλάζει layer override (C.6) ή element override (C.5) ή V/G visibility (C.4), οι 3D BIM ακμές αντιδρούν ζωντανά με τους ίδιους κανόνες όπως το 2D plan view. Pure SSoT, μηδέν resolver duplication.
- **C.8 "Hide BIM / Show only DXF" isolate toggle** ✅ DONE 2026-06-02 — One-click ribbon toggle (View tab) που κρύβει όλα τα δομικά BIM στοιχεία ώστε να μένουν ορατές μόνο οι εισαγμένες DXF οντότητες (Revit "Hide in View" / AutoCAD isolate). **SSoT**: νέα σταθερά `STRUCTURAL_BIM_CATEGORIES` (`bim-object-styles.ts`) — οι 10 model categories (wall/column/beam/slab/opening/slab-opening/stair/roof/ceiling/envelope), εξαιρεί annotation/helper (dimension/hatch/grip). Νέα batch action `setBimObjectsVisibility(visible)` στο `bim-render-settings-store` — ΕΝΑ state update + ΕΝΑ debounced Firestore write· runtime-only `bimVisibilitySnapshot` field κρατά την προηγούμενη per-category ορατότητα όταν ενεργοποιείται το isolate, ώστε το toggle-off να επαναφέρει τυχόν χειροκίνητα κρυμμένες κατηγορίες αντί να τις εμφανίσει όλες (idempotent — διπλό hide δεν χαλάει το snapshot). Διοχετεύεται στον υπάρχοντα `resolveIsEntityVisible` path (2D + 3D μέσω C.4 wiring — μηδέν νέο render plumbing). **NEW**: `HideBimToggle.tsx` (widget, διαβάζει `objectStyles`, derived `isBimHidden = STRUCTURAL.every(visible===false)`), `HIDE_BIM_PANEL` (`view-tab-bim-settings.ts`). **MODIFIED**: `RibbonPanel.tsx` (widgetId `hide-bim` wiring), `ribbon-default-tabs.ts` (panel μετά VISIBILITY_GRAPHICS_PANEL), i18n el+en (`ribbon.panels.hideBim` + `ribbon.commands.hideBim.*`). 5 new store tests (hide-all / annotation-untouched / restore / manual-hide-preserved / idempotent), 27/27 PASS, tsc clean. **Update 2026-06-02 (ADR-405):** `STRUCTURAL_BIM_CATEGORIES` μετονομάστηκε σε `MODEL_BIM_CATEGORIES` (το παλιό όνομα = deprecated alias, zero-break). Το «Μόνο DXF» **συνυπάρχει** πλέον με το νέο discipline multi-toggle (ADR-405 §4) — industry-faithful (Revit κρατά ΚΑΙ category-level isolate ΚΑΙ View Discipline· δεν αντικαθίσταται το ένα από το άλλο). Το «Μόνο DXF» = γρήγορο category-level isolate· το discipline toggle = ανώτερο tier ορατότητας. Συνθέτονται μέσω ANY-hides-wins στον `resolveIsEntityVisible`.

### Phase D — Underlay (separate ADR)

- Display elements from another level (above/below) as underlay
- Halftone rendering

---

## 6. Open Questions (Clarification Phase)

> Μία προς μία. Μετά από κάθε απάντηση → ADR update.

### Q0: Visual hierarchy — προτεινόμενη ιεραρχία βαρύτητας ✅ **LOCKED (2026-05-25)**

**Answer (Giorgio)**: _Συμφωνώ με την προτεινόμενη ιεραρχία_

Κλειδωμένη hierarchy (παχύτερο → λεπτότερο):
1. **Κολώνα** (cut) — 0.70 mm — Pen #9
2. **Τοίχος / Πλάκα** (cut) — 0.35 mm — Pen #7
3. **Δοκός** (cut) — 0.25 mm — Pen #6
4. **Σκάλα** (cut) — 0.18 mm — Pen #5
5. **Πόρτα / Παράθυρο (opening)** — 0.13 mm — Pen #4
6. **Διάσταση / Annotation** — 0.10 mm — Pen #3

→ Άμεσος αντίκτυπος στο §3.3 `DEFAULT_OBJECT_STYLES`: ταυτίζονται.

### Q6: Layer override interplay ✅ **LOCKED — Unified SSoT, BIM Resolver wins for BIM entities (2026-05-25)**

**Decision (Giorgio)**: _"Ενοποιημένο σύστημα, μία SSoT, δύο resolvers (όπως Revit)"_.

→ **BIM entities ΠΟΤΕ δεν περνούν από CAD/Layer resolver**. Έχουν δικό τους paradigm (Object Styles + View Range).
→ **DXF entities** συνεχίζουν να χρησιμοποιούν το ADR-358 CAD resolver (layer-driven).
→ **Pen Catalog** = κοινός. `bim-pen-table.ts` αναφέρεται σε `LINEWEIGHT_ISO_VALUES` του `lineweight-iso-catalog.ts`.
→ Δες §1.4 για architectural diagram.

### Q1: Cut detection ✅ **LOCKED — Revit View Range auto-detect**

Per directive "FULL ENTERPRISE = Revit way": **auto-detection from View Range** (4 planes: Top/Cut/Bottom/ViewDepth). Phase A: defaults μόνο. Phase C: per-view UI.

### Q2: Pen Table ladder ✅ **LOCKED — ISO 128 + Revit defaults**

Per directive: ISO 128-20 ladder (√2 ratio) με Revit-equivalent defaults. Αμετάβλητο εκτός αν Giorgio ζητήσει αλλαγή σε συγκεκριμένη τιμή.

### Q3: Object Styles defaults ✅ **LOCKED — Revit Architectural Template defaults**

Per directive + Q0 hierarchy lock. Αντιστοιχίσεις §3.3 κλειδώνουν.

### Q4: Scale columns ✅ **LOCKED — 6 στήλες full Revit (2026-05-25)**

**Answer (Giorgio)**: 6 στήλες — 1:10, 1:20, 1:50, 1:100, 1:200, 1:500.

Per ISO 128-20 + Revit Architectural Template. Διαφορετικό πάχος ανά κλίμακα εκτύπωσης. Pen Table = 16 pens × 6 scales = 96 mm values.

**Initial scale-aware ladder (per pen):**
- Larger scales (1:10, 1:20) → παχύτερες γραμμές (περισσότερος χώρος)
- Smaller scales (1:200, 1:500) → λεπτότερες (πυκνότερη κάτοψη)
- Διαβάθμιση: ~×1.4 (√2) μεταξύ διαδοχικών scales σε ίδιο pen.

→ Τελικές τιμές κλειδώνουν στο Phase A implementation, με base τις προτεινόμενες στο §3.2.

### Q5: View Range defaults ✅ **LOCKED — Revit defaults (2026-05-25)**

**Answer (Giorgio)**: Top=2.30m, Cut=1.20m, Bottom=0.00m, ViewDepth=-0.30m, FloorAdjustedRange=1.22m (4ft).

→ Ενσωματωμένο στο `DEFAULT_VIEW_RANGE` στο §3.4.

### Q6: `<Beyond>` line style visual treatment — dashed/halftone από Phase A; ⏸️ **PENDING**

Στο Revit τα beyond entities ζωγραφίζονται με ξεχωριστή line style (συνήθως διακεκομμένη, halftone). Phase A: μόνο line weight. Phase B: full visual?

### Q7: Phase B (Ribbon UI) — αμέσως μετά Phase A; ⏸️ **PENDING**

### Q8: Layer override interplay (ADR-358) ✅ **LOCKED — βλέπε Q6 (unified SSoT, BIM resolver wins for BIM)**

### Q9: 3D parity (ADR-370) — included Phase A ή ξεχωριστό ADR; ✅ **LOCKED — Phase C.7 DONE 2026-05-26**

Implementation: edge overlay via `Line2 / LineMaterial + EdgesGeometry(30°)` (industry standard — Autodesk Forge / Three.js Editor pattern). 2D resolver (`resolveSubcategoryStyle`) called directly από 3D pipeline (zero duplication). LineMaterial.linewidth = `lineWidthPx × devicePixelRatio`, screen-space, resolution uniform synced από `bimEdgeResolutionStore` (updated στο `ThreeJsSceneManager.resize()`). 4 new files (resolver + builder + store + tests) + 4 modified converter files + 1 modified scene manager. Layer overrides (C.6) + element overrides (C.5) + V/G (C.4) όλα live στο 3D viewer με ίδιους priority κανόνες. **v2.6 wiring complement 2026-05-26**: το C.4 V/G visibility toggle πλέον φτάνει και στο 3D μέσω `BimSceneLayer.sync()` category filter (snapshot objectStyles once, 7 booleans, skip per-loop) + `BimViewport3D.tsx` `useBimRenderSettingsStore.subscribe((s) => s.objectStyles, ...)` re-issue `syncBimEntities`. Wall/slab loops keep host solid (empty openings array) όταν opening/slab-opening categories είναι hidden — IFC cutout semantic preserved.

### Q10: User-facing language — UI εμφανίζει "Pen #5" ή "0.18 mm" ή "Wall Cut"; ⏸️ **PENDING (Phase B)**

---

## 7. Consequences

### Positive
- ✅ **Full Revit equivalence** — γνωστό pattern για BIM users
- ✅ **ISO 128-20 compliance** — international standard
- ✅ **Three-tier extensibility** — Pen Table + Object Styles + Overrides
- ✅ **Scale-aware** — pixel-perfect σε όλα τα zoom levels
- ✅ **Central SSoT** — μία αλλαγή, καθολική εφαρμογή
- ✅ **mm-based canonical** — αναπαραγώγιμη μεταξύ printers/screens (via DPI)

### Negative
- ⚠️ **Larger surface area** — 3 αρχεία SSoT αντί 1
- ⚠️ **Migration cost** — 7 BIM renderers + visual regression baseline reset
- ⚠️ **Cut detection** — απαιτεί explicit flag ή auto-detection (Open Q1)

### Neutral
- 🔵 **ADR-044 παραμένει** για non-BIM entities (grid, ruler, ghost, selection)
- 🔵 **Backward compat**: η default τιμή των renderers χωρίς category μένει 2px

---

## 8. Changelog

| Date | Version | Change | Author |
|------|---------|--------|--------|
| 2026-06-02 | **2.14 — Phase C.8 "Hide BIM / Show only DXF" isolate toggle** | One-click ribbon toggle (View tab, μετά το Visibility/Graphics) που κρύβει όλα τα δομικά BIM στοιχεία ώστε να μένουν ορατές μόνο οι εισαγμένες DXF οντότητες (Revit "Hide in View" / AutoCAD isolate). **SSoT νέα σταθερά** `STRUCTURAL_BIM_CATEGORIES` (`bim-object-styles.ts`) — 10 model categories (wall/column/beam/slab/opening/slab-opening/stair/roof/ceiling/envelope), εξαιρεί annotation/helper (dimension/hatch/grip). **Νέα batch action** `setBimObjectsVisibility(visible)` στο `bim-render-settings-store` — ΕΝΑ state update + ΕΝΑ debounced Firestore write· runtime-only `bimVisibilitySnapshot` κρατά την προηγούμενη per-category ορατότητα ώστε το toggle-off να επαναφέρει χειροκίνητα κρυμμένες κατηγορίες (idempotent — διπλό hide δεν χαλάει το snapshot). Επανα-χρησιμοποιεί τον υπάρχοντα `resolveIsEntityVisible` path (2D + 3D μέσω C.4 wiring, μηδέν νέο render plumbing). **NEW**: `HideBimToggle.tsx`, `HIDE_BIM_PANEL`. **MODIFIED**: `RibbonPanel.tsx` (widgetId `hide-bim`), `ribbon-default-tabs.ts`, i18n el+en (`ribbon.panels.hideBim` + `ribbon.commands.hideBim.*`). 5 new store tests, 27/27 PASS, tsc clean. 🔴 browser verify. | Claude (Opus 4.8) |
| 2026-05-25 | 0.1 — Draft (compact) | Initial 5-tier compact design | Claude (Opus 4.7) |
| 2026-05-25 | 0.2 — Draft (Revit clone) | Rewrite: full 16-pen × 6-scale × Object Styles three-tier architecture per Giorgio's "FULL ENTERPRISE" directive | Claude (Opus 4.7) |
| 2026-05-25 | 0.3 — Draft (4-tier + View Range) | Add TIER 0 = View Range (Top/Cut/Bottom/ViewDepth) auto-detect cut/projection/beyond. Q1/Q2/Q3 locked. Q4-Q10 remain. | Claude (Opus 4.7) |
| 2026-05-25 | 0.4 — Draft (Unified SSoT with ADR-358) | Q4/Q5/Q6/Q8 locked. Shared catalog: Pen Table references `LINEWEIGHT_ISO_VALUES` (ADR-358). Architectural diagram §1.4. Pre-commit ratchet compliance. | Claude (Opus 4.7) |
| 2026-05-25 | **1.0 — APPROVED (Phase A Ready)** | **Phase A scope locked: 11 files (4 new + 7 modified). Sonnet 4.6 model. Full implementation sequence + pre/post checks + risk register documented §5. Clarification phase complete — Q7/Q9/Q10 deferred to Phase B/C/D.** | Claude (Opus 4.7) |
| 2026-05-25 | **1.1 — Phase A IMPLEMENTED** | **4 new SSoT files (bim-pen-table, bim-object-styles, bim-view-range, bim-line-weight-resolver) + 4 test files (35 tests PASS) + 7 BIM renderers migrated (Wall/Slab/Column/Beam/Opening/SlabOpening/Stair). TSC clean. All hardcoded RENDER_LINE_WIDTHS.NORMAL replaced with resolveLineWeightPx(). lineweightToPx from ADR-358 SSoT (no mm→px duplication). Phase A: defaults scaleDenominator=100, dpi=96.** | Claude (Sonnet 4.6) |
| 2026-05-25 | **1.2 — Phase B Sub-phases Planned** | **Phase B split into B.1 / B.2 / B.3 (per Giorgio session-per-phase rule). Locked decisions: (1) Drawing Scale = new selector decoupled from zoom (Revit annotation scale), (2) View Range = Α+Β inline floorplan + separate `view_templates` library, (3) Object Styles overrides = full 8-category × 2-pen table per floorplan. B.1 ~6 files (Drawing Scale store + ribbon panel + 7 renderer wirings). B.2 ~10-12 files (View Range + Object Styles panels + Firestore inline persistence). B.3 ~8-10 files (View Templates library + apply/edit/delete + Firestore collection). Pen Table editor + Pen Sets presets DEFERRED to Phase C.** | Claude (Opus 4.7) |
| 2026-05-25 | **1.3 — Phase B.1 IMPLEMENTED** | **Drawing Scale Selector (in-memory Zustand store). 4 new files: `drawing-scale-store.ts` (store + PRESETS + clamp), `drawing-scale-store.test.ts` (9 tests PASS), `DrawingScaleWidget.tsx` (ribbon dropdown "1:100" + 6 presets, ZoomControls-pattern), `view-tab-drawing-scale.ts` (VIEW_DRAWING_SCALE_PANEL data). 5 modified: `ribbon-default-tabs.ts` (add panel to view tab), `RibbonPanel.tsx` (widgetId handler), `el/dxf-viewer-shell.json` + `en/dxf-viewer-shell.json` (i18n keys), + all 7 BIM renderers updated: `scaleDenominator: 100` → `useDrawingScaleStore.getState().drawingScale`. Phase A 35 tests PASS + B.1 9 tests PASS = 44 total. TSC pending.** | Claude (Sonnet 4.6) |
| 2026-05-25 | **1.4 — Phase B.2 IMPLEMENTED** | **View Range + Object Styles panels + Firestore persistence. Architecture clarification: `bimRenderSettings` stored in `dxf_viewer_levels/{levelId}` (= Revit ViewPlan), NOT `floorplans/{id}` (ADR correction). SSoT: `bim-render-settings-store` replaces `drawing-scale-store` as canonical store; `drawing-scale-store` becomes thin re-export shim. 8 new files: `config/bim-render-settings-types.ts` (BimRenderSettings interface + resolveBimSettings()), `services/bim-render-settings.service.ts` (updateDxfLevelWithPolicy wrapper), `state/bim-render-settings-store.ts` (Zustand SSoT: drawingScale + viewRange + objectStyles, 500ms debounce), `state/hooks/useBimRenderSettingsSync.ts` (level-change sync hook), `ui/ribbon/panels/ViewRangePanel.tsx` (4 mm inputs), `ui/ribbon/panels/ObjectStylesPanel.tsx` (12×2 pen dropdowns), `ui/ribbon/data/view-tab-bim-settings.ts`, `state/__tests__/bim-render-settings-store.test.ts` (15 tests), `services/__tests__/bim-render-settings.service.test.ts` (5 tests). 8 modified: `config/bim-object-styles.ts` (+BIM_CATEGORIES export), `config/bim-view-range.ts` (+resolveViewRange()), `config/bim-line-weight-resolver.ts` (+objectStyles param), `state/drawing-scale-store.ts` (re-export shim), `systems/levels/config.ts` (+bimRenderSettings in Level), API schema + handler (+bimRenderSettings field), `ribbon-default-tabs.ts`, `RibbonPanel.tsx`, i18n el+en, 7 BIM renderers (+objectStyles param). Phase A (35) + B.1 (9) + B.2 (20) = 64 tests PASS.** | Claude (Sonnet 4.6) |
| 2026-05-26 | **1.8 — Phase B.3 ViewTemplate Create HOTFIX (Firestore undefined rejection)** | **Surface: `createViewTemplate()` threw `FirebaseError: Function setDoc() called with invalid data. Unsupported field value: undefined (found in field description)` when the user clicked "Save As" without typing a description. Root cause: `CreateViewTemplateInput.description` is optional (`description?: string`), and the service spread `description: input.description` directly into the Firestore payload — Firestore accepts `null` but rejects `undefined` (CLAUDE.md memory: "Firestore: NEVER write undefined values"). **Fix**: (a) `services/view-template.service.ts` — `description: input.description ?? null` in `createViewTemplate` (matches the existing `?? null` coalesce on the `updateViewTemplate` path); (b) `config/view-template-types.ts` — widen `ViewTemplate.description?: string` to `description?: string \| null` so the persisted shape matches the Firestore document. 2 files modified, 0 new files. TSC clean. Phase B.3 Save As now succeeds on empty-description input.** | Claude (Sonnet 4.6) |
| 2026-05-26 | **1.7 — Phase B.2 ViewRange Wiring HOTFIX (renderers)** | **Surface: changing Cut Plane in the ribbon ViewRange panel had no effect on the canvas. Root cause: all 6 BIM renderers that resolve cut state (`WallRenderer`, `SlabRenderer`, `ColumnRenderer`, `BeamRenderer`, `OpeningRenderer`, `SlabOpeningRenderer`) called `resolveCutState(entityExtents, DEFAULT_VIEW_RANGE)` with the **hardcoded** Phase A default — they never read the per-view override from `useDrawingScaleStore.getState().viewRange`. The Phase B.2 store path wrote correctly to `dxf_viewer_levels/{id}.bimRenderSettings.viewRange` (verified `_v` counter incrementing in Firestore) but the renderers ignored the value. **Fix**: replace `DEFAULT_VIEW_RANGE` with `useDrawingScaleStore.getState().viewRange` in all 6 renderers + drop the now-unused import. 6 files modified, 0 new files. Bitmap cache key already includes `bimSettingsHash` (covers viewRange) from v1.6, so cache invalidation is automatic. TSC clean. Phase B.2 ViewRange now end-to-end live.** | Claude (Sonnet 4.6) |
| 2026-05-26 | **1.6 — Phase B Runtime Wiring HOTFIX** | **Two runtime bugs surfaced during manual verification (Giorgio + Claude Sonnet 4.6, /dxf/viewer with `floorplan_walls` BIM entity, drawing scale change had no visible effect, F5 reset to 1:100). Bug #1 (visual, P0): `dxf-bitmap-cache.ts` `CacheKey` only included the ADR-344 `activeAnnotationScale` — the ADR-375 `drawingScale` + `viewRange` + `objectStyles` were never part of the key, so `isDirty()` returned false on every Phase B settings change and the offscreen bitmap was blit unchanged. Bug #2 (persistence, P0): `useBimRenderSettingsSync` hook was never mounted anywhere in the tree, so `useBimRenderSettingsStore.currentLevelId` stayed `null`, `debounceWrite()` was skipped, zero writes ever reached `dxf_viewer_levels/{id}.bimRenderSettings` (silent failure — also broke B.3 Apply/Update/Detach because the store had no anchor). **Fix**: (a) `app/DxfViewerContent.tsx` (+2 lines) — mount `useBimRenderSettingsSync({ currentLevelId, levels })` next to `useLevelManager()` so every level switch + Firestore push reloads the store; (b) `canvas-v2/dxf-canvas/dxf-bitmap-cache.ts` (+`drawingScale: number` + `bimSettingsHash: string` fields, +`readBimCacheInputs()` helper using `useBimRenderSettingsStore.getState()`, isDirty/rebuild paths updated); (c) `canvas-v2/dxf-canvas/dxf-canvas-renderer.ts` (+`useBimRenderSettingsStore.subscribe()` `useEffect` mirroring the `subscribeLayerStore` / `subscribeIsolateEffects` ADR-358 §5.6.bis Phase 10 pattern — flips `isDirtyRef.current = true` so the cache key gets re-evaluated on the next frame). 3 files modified, 0 new files, no test churn (cache key extension is additive; the bitmap-cache has no dedicated unit suite — ADR-040 covers it via the integration scenarios). TSC clean. Runtime verification then re-attempted (see Phase B runtime smoke notes).** | Claude (Sonnet 4.6) |
| 2026-05-25 | **1.5 — Phase B.3 IMPLEMENTED** | **View Templates Library (Revit Level 2 — reusable presets, separate `dxf_viewer_view_templates` collection, companyId-scoped). Locked decisions (snapshot-copy model): (1) Apply copies `template.settings → Level.bimRenderSettings` + sets `Level.appliedViewTemplateId`. (2) Detach nulls the FK, keeps the snapshot. (3) Template edit fans out client-side via `propagateToLinkedLevels` (Promise.allSettled isolation). (4) Renderers keep reading only `Level.bimRenderSettings` — orphaned FK after deletion is harmless. **3 new SSoT/service/store**: `config/view-template-types.ts` (ViewTemplate + Create/Update/Apply/Detach input types), `services/view-template.service.ts` (Firestore SDK CRUD + subscribe via `firestoreQueryService.subscribe('DXF_VIEWER_VIEW_TEMPLATES')` + `applyViewTemplate` / `detachViewTemplate` via `updateDxfLevelWithPolicy` + `propagateToLinkedLevels` fan-out + `saveCurrentAsTemplate` composer), `state/view-template-store.ts` (Zustand: cached list + mount-once idempotent subscribe + selectors). **1 new UI**: `ui/ribbon/panels/ViewTemplatesPanel.tsx` (Apply / Update / Delete per row, Save As footer, Detach when linked, linked-count badge). **2 new tests**: `services/__tests__/view-template.service.test.ts` (19 tests — CRUD + apply/detach + propagate failure isolation + subscribe + SOS N.6 trip-wire), `state/__tests__/view-template-store.test.ts` (9 tests — lifecycle + data/error forwarding + selectors). **Modified**: `services/enterprise-id-prefixes.ts` (+VIEW_TEMPLATE 'vtmpl'), `services/enterprise-id-class.ts` (+generateViewTemplateId), `services/enterprise-id-convenience.ts` + `services/enterprise-id.service.ts` re-export, `config/firestore-collections.ts` (+DXF_VIEWER_VIEW_TEMPLATES), `systems/levels/config.ts` (+`appliedViewTemplateId?: string \| null` on Level), `app/api/dxf-levels/dxf-levels.schemas.ts` + `dxf-levels.handlers.ts` (+appliedViewTemplateId field on UpdateDxfLevelSchema), `ui/ribbon/data/view-tab-bim-settings.ts` (+VIEW_TEMPLATES_PANEL), `ui/ribbon/components/RibbonPanel.tsx` (widgetId routing), `ui/ribbon/data/ribbon-default-tabs.ts` (View tab registration), i18n el+en (+viewTemplates keys), `firestore.rules` (read/create/update/delete by tenant member or super admin, companyId+createdBy immutable on update), `firestore.indexes.json` (composite index `companyId` + `createdAt DESC`). Phase A (35) + B.1 (9) + B.2 (20) + B.3 (28) = **92 tests PASS**. TSC clean (background).** | Claude (Opus 4.7) |
| 2026-05-27 | **2.13 — Phase C.4 V/G Server-Side Schema Strip ROOT-CAUSE FIX** | **Surface (Giorgio runtime report after v2.11 sync-race fix + v2.12 body-fill sweep)**: «δίνω χρώματα στις οντότητες BIM, αλλά μετά από λίγο εξαφανίζονται». Workflow: pick color → wall χρωματίζεται ✅ → wait ~10s ακίνητος → χρώμα επιστρέφει στο default token. **Διαγνωστικά logs** σε `loadForLevel` / `setObjectStyleVgColor` / `debounceWrite` (SCHEDULED/FLUSH/RESOLVED) / `useBimRenderSettingsSync` effect αποκάλυψαν: (a) setter fires σωστά (`#ff47ff`), (b) debounceWrite flush σε 507-511ms, (c) Firestore write RESOLVED σε ~835-1107ms post-flush, (d) v2.11 quiet-window guard δουλεύει τέλεια (sync useEffect skipping during 2s window), **(e) σε ΟΛΑ τα sync useEffect events `incomingWallProjColor: undefined`** — ποτέ δεν περιλάμβανε το χρώμα που μόλις γράφτηκε. **Root cause**: `src/app/api/dxf-levels/dxf-levels.schemas.ts` `UpdateDxfLevelSchema` validation block για `objectStyles[category]` όριζε ΜΟΝΟ `projectionPen` + `cutPen`:
```ts
objectStyles: z.record(z.object({
  projectionPen: z.number().int().min(1).max(16),
  cutPen: z.number().int().min(1).max(16),
})).optional(),
```
Όλο το ADR-375 Phase C.4 V/G surface (`visible / projectionColor / cutColor / projectionPattern / cutPattern`) + ADR-377 `subcategories` ήταν **απόντα** από το nested schema. Zod default behavior = `.strip()` unknown keys (το `.passthrough()` στο top-level **δεν propagate** σε nested `z.object()`). Server έλαβε full payload, **Zod strip-άρισε σιωπηρά τα V/G fields**, handler πέρασε το stripped object στο `withVersionCheck` write, Firestore αποθήκευσε χωρίς V/G data, snapshot listener delivered stripped doc, και μόλις το quiet-window εξέπνεε (2s) η επόμενη `sync useEffect` έκανε `loadForLevel(stripped)` → store wiped → swatch + canvas revert σε default. Εξηγεί 100% γιατί `incomingWallProjColor: undefined` σε ΟΛΑ τα Firestore echoes. **Επιπλέον επηρεαζόμενα paths (latent)**: `applyViewTemplate` + `propagateToLinkedLevels` περνούν από τον ίδιο `updateDxfLevelWithPolicy` → ίδιο strip. View Templates collection direct-Firestore writes (`createViewTemplate` / `updateViewTemplate` via `setDoc`/`updateDoc`) ΔΕΝ επηρεάζονται (no gateway). **Fix (full enterprise)**: rewrite του `dxf-levels.schemas.ts` με reusable named sub-schemas: `PenIndexSchema` (z.number int 1-16), `HexColorSchema` (regex `^#[0-9a-fA-F]{6}$` + msg), `LinePatternSchema` (z.union: enum 29 BIM_LINE_PATTERN_BUILTINS + regex `^custom_[a-zA-Z0-9_-]+$`), `SubcategoryStyleSchema` (ADR-377 — όλα optional, hex|null colors), `ObjectStyleSchema` (full ADR-375 Phase C.4 surface: projection/cutPen required + visible? + projection/cutColor? hex|null + projection/cutPattern? + subcategories? record SubcategoryStyleSchema), `BimRenderSettingsSchema` (drawingScale + viewRange? + objectStyles? record ObjectStyleSchema). `UpdateDxfLevelSchema.bimRenderSettings` πλέον references `BimRenderSettingsSchema.nullable().optional()`. Test-only export `__testing__ = { PenIndexSchema, HexColorSchema, LinePatternSchema, SubcategoryStyleSchema, ObjectStyleSchema, BimRenderSettingsSchema }` για unit testing. **Diagnostic logs αφαιρέθηκαν** από `bim-render-settings-store.ts` (`loadForLevel` + `setObjectStyleVgColor` + `debounceWrite SCHEDULED/FLUSH/RESOLVED`) + `useBimRenderSettingsSync.ts` (effect FIRED block). **Quiet-window guard διατηρείται** ως defense-in-depth (μας έσωσε από continuous revert loop κατά το διαγνωστικό + αν επανεμφανιστεί άλλο API endpoint strip σε άλλο τμήμα του ObjectStyle, ο guard προστατεύει local store). **Files (4 modified + 1 new)**: (1) `src/app/api/dxf-levels/dxf-levels.schemas.ts` — schema refactor + reusable sub-schemas + `__testing__` export. (2) `src/subapps/dxf-viewer/state/bim-render-settings-store.ts` — diag logs removed (3 spots). (3) `src/subapps/dxf-viewer/state/hooks/useBimRenderSettingsSync.ts` — diag log removed (1 spot). (4 new) `src/app/api/dxf-levels/dxf-levels.schemas.test.ts` — 13 schema regression tests: V/G projectionColor/cutColor preservation σε wall, V/G visibility toggle, V/G line patterns (built-in + custom_), ADR-377 subcategories preservation, multi-category roundtrip (real-world shape), null V/G colors (canvas-token fallback), invalid payload rejection (non-hex color, PenIndex out-of-range, unknown line pattern), sub-schema unit coverage (HexColorSchema 6-digit only, SubcategoryStyleSchema partial overrides, ObjectStyleSchema requires both pens, BimRenderSettingsSchema minimal accept). **Tests**: 13/13 new schema tests PASS + 44/44 existing BIM (store + service + V/G overrides) PASS = **57/57 zero regression**. TSC clean. **Outcome**: V/G colors persist correctly server-side, snapshot listener delivers full V/G payload, store stays in sync. Latent template apply/propagate path also fixed. ADR-377 subcategories future-proofed. Phase C.4 V/G surface server-validated end-to-end. | Claude (Sonnet 4.6) |
| 2026-05-27 | **2.11 — Phase C.4 V/G Sync Race Protection (local-write quiet window)** | **Surface (Giorgio runtime report after v2.9+v2.10)**: pick color → V/G swatch updates (#ff00ff) → immediately reverts to undefined. Διαγνωστικά logs αποκάλυψαν τη σειρά: `setObjectStyleVgColor #ff00ff` → store has new → `loadForLevel { wallProjectionColor: undefined, previousWallProjectionColor: "#ff00ff" }` wiping the local change. **Root cause**: `useBimRenderSettingsSync` useEffect fires στο `[currentLevelId, levels]` change. Το `levels` array reference αλλάζει για ανεξάρτητους λόγους ΠΡΙΝ η 500ms debounceWrite προλάβει να flush-άρει στο Firestore (Firestore listener echo, sibling field update στο level doc, super-admin tenant switch re-emit). Ο sync hook έκανε blind reload `loadForLevel(level.bimRenderSettings)` — εκείνη τη στιγμή το server-side payload ήταν ΑΚΟΜΗ stale (χωρίς το local pick) → store reset → swatch revert. Classic SSoT race: local in-memory write vs. parent provider re-injection από stale snapshot. **First attempt (rejected)**: JSON.stringify deep-equality comparison incoming ↔ rawSettings. Logs `settingsEqualCheck: false` παρότι το wall.projectionColor ήταν undefined και στα δύο sides — η αποτυχία έδειξε ότι κάποιο unrelated field drift (Firestore deserialization, sparse defaults, ordering) σπάει τη JSON σύγκριση. Fragile και δύσκολο να επιβεβαιωθεί τι ακριβώς διέφερε. **Fix (final)**: timestamp-based local-write quiet window. Store getter `lastLocalMutationAt: number` σταμπώνεται από κάθε V/G setter (`setDrawingScale/resetDrawingScale/setViewRangeField/setObjectStyleField/setObjectStyleVisibility/setObjectStyleVgColor/setObjectStyleVgPattern`) με `Date.now()` και reset σε `0` σε κάθε `loadForLevel` (level switch + post-quiet-window resume). Sync hook skips `loadForLevel` όταν `Date.now() - lastLocalMutationAt < 2000ms` (LOCAL_WRITE_QUIET_WINDOW_MS = 500ms debounce + 1500ms Firestore roundtrip buffer). Λογική: (a) level switch (`store.currentLevelId !== currentLevelId`) → πάντα reload (user explicitly navigated to new floor); (b) same level + within quiet window → SKIP (local writes pending, leave store alone); (c) same level + window expired → reload (debounce flushed + Firestore confirmed). **Trade-off**: real-time updates από άλλα concurrent sessions στο ίδιο level land με ≤2s delay κατά τη διάρκεια local editing. Για CAD-style single-user workflow αυτό είναι αποδεκτό — Revit δεν υποστηρίζει concurrent editing έτσι κι αλλιώς. **Files (2 modified)**: `bim-render-settings-store.ts` (+7 mutations × `lastLocalMutationAt: Date.now()` stamp + state shape +1 field), `useBimRenderSettingsSync.ts` (-27 JSON.stringify path / +3 timestamp check + extended docstring + LOCAL_WRITE_QUIET_WINDOW_MS const). **Tests**: 44/44 store + service + V/G overrides tests PASS (zero regression). TSC clean. **Note**: parallel race-pattern σε [[feedback-firestore-subscribe-equality-guard]] στο firestoreQueryService.subscribe consumer layer — ADR-040 Phase XV (2026-05-16). Διαφορά: εκεί η equality guard δουλεύει γιατί το payload είναι homogeneous documents; εδώ το `BimRenderSettings` field έχει ιδιαίτερη σπασμένη/sparse semantics οπότε timestamp είναι πιο robust. | Claude (Sonnet 4.6) |
| 2026-05-27 | **2.12 — Phase C.4 V/G Body Fill Tint (SSoT + 6-renderer sweep)** | **Surface (Giorgio runtime report after v2.11 fixed the revert race)**: «Στα τετράγωνα προεπισκόπησης παραμένει το επιλεγμένο χρώμα, αλλά δεν χρωματίζεται ο τοίχος» → fix εφαρμόστηκε σε Wall → Giorgio: «τώρα οι τοίχοι χρωματίζονται, αλλά όχι τα υποστηλώματα» → sweep σε Column/Slab/Beam/SlabOpening → Giorgio: «η σκάλα δεν χρωματίζεται» → +Stair (per-tread fill via `StairStyleContext.vgFillTint`). **Root cause**: όλοι οι 5 BIM 2D renderers (Wall/Column/Slab/Beam/SlabOpening) έβαζαν `this.ctx.fillStyle = <HARDCODED_FILL>[<kind|category>]` — translucent rgba constants ανά WallCategory / ColumnKind / SlabKind / BeamKind / SlabOpeningKind. Edges (stroke) έπαιρναν ήδη το V/G `_edgeColor` (✅ από v2.4–v2.8) και η hatch (drawMaterialHatch) έπαιρνε το V/G `_hatchColor` ως cut-pattern subcategory (✅). Αλλά για entities **χωρίς material hatch** (`*.params.dna` undefined ή zoom < 0.001), η μόνη ορατή χρωματική επιφάνεια είναι το body fill — και αυτό αγνοούσε εντελώς το V/G. **Boy Scout SSoT**: αντί per-renderer duplication, νέο shared util `src/subapps/dxf-viewer/bim/utils/bim-vg-fill-tint.ts` εξάγει `VG_FILL_ALPHA = 0.2` (Revit "cut pattern background" convention), `hexToRgba(hex, alpha)` (validates `^#[0-9a-fA-F]{6}$`), και `resolveVgFillTint(category, cutState, objectStyles, alpha?): string | null` με Revit-faithful priority chain για 2D plan footprints (το ίδιο polygon αναπαριστά ταυτόχρονα cut surface ΚΑΙ projection): (1) user-set color για το cutState-matching column, (2) fallback στο OPPOSITE column (για να μη βρει ο user "wrong column"), (3) `null` (renderer keeps hardcoded default). Industry alignment: Revit V/G «Override Graphics in View» όταν user σετάρει category color, το "Cut Pattern → Background" auto-adopts. **Files (8 modified/new)**: (1 new) `bim/utils/bim-vg-fill-tint.ts` (54 lines — SSoT util); (5 modified canonical 2D renderers) `WallRenderer.ts` + `ColumnRenderer.ts` + `SlabRenderer.ts` + `BeamRenderer.ts` + `SlabOpeningRenderer.ts` — όλοι κάνουν reorder των `cutState/objectStyles` reads πριν το `fillStyle` assignment + `fillStyle = resolveVgFillTint(<cat>, _cutState, _styles) ?? <HARDCODED_FILL>[<kind>]`; (2 modified stair) `StairRenderer.ts` (pre-compute `vgFillTint = resolveVgFillTint('stair', cutState, ds.objectStyles)` και inject στο `scx`) + `stair-render-structure-style.ts` (`StairStyleContext.vgFillTint?: string | null` + `renderTreadsForStructure` χρησιμοποιεί `scx.vgFillTint ?? (isGlass ? TREAD_FILL_GLASS : TREAD_FILL_DEFAULT)`). Hardcoded fallbacks διατηρούνται. **Renderer untouched**: `OpeningRenderer.ts` (doors/windows = stroke-only, no body fill — V/G stroke already wired). **Tests**: 395/395 PASS (29 suites incl. WallRenderer-subcategory-wiring + StairRenderer-subcategory-wiring + stair-render-structure-style + bim-renderers-vg-visibility + bim-vg-overrides + bim-render-settings-store + service). TSC clean. **Outcome**: V/G category color τώρα tint-άρει body/tread fill σε Wall + Column + Slab + Beam + SlabOpening + Stair — independent από material hatch availability. | Claude (Sonnet 4.6) |
| 2026-05-27 | **2.9 — Phase C.4 V/G Panel Focus Recursion HOTFIX** | **Surface (Giorgio runtime report)**: άνοιγμα V/G ribbon panel + κλικ σε swatch του `UnifiedColorPicker variant="modal"` έριχνε `InternalError: too much recursion` (Firefox / Chrome similar) στο `useFocusVisible.ts:146 → focus-scope.tsx:295 → handleFocusOut2:104 → focusWithoutScrolling:33 → focusSafely:43 → FocusScope.tsx:482`. Browser freeze μετά 50+ επαναλήψεις. **Root cause**: το `VisibilityGraphicsPanel.tsx` τυλίγει 24 `ColorDialogTrigger` instances μέσα σε Radix `<DropdownMenu>` (default `modal={true}`). Το Radix `@radix-ui/react-focus-scope` τραπώνει focus inside DropdownMenuContent. Όταν ο user κάνει κλικ σε swatch, το `EnterpriseColorDialog` ανοίγει με `<FocusScope contain restoreFocus autoFocus>` (React Aria). Παρότι το dialog κάνει `createPortal(document.body)` (DOM escape), **και οι δύο focus scopes παραμένουν λογικά active** — Radix τραβάει focus πίσω στο dropdown, React Aria το τραβάει στο dialog → infinite focusin/focusout ping-pong. Το ίδιο pattern δεν εμφανίζεται στο `OpeningTagStyleColorWidget` ή στις DXF Settings tabs γιατί εκείνα είναι σε Floating Panel (όχι Radix popup). **Fix (industry-standard Radix nested-overlay pattern)**: (a) `DropdownMenu modal={false}` — απενεργοποίηση Radix focus trap στο V/G dropdown. (b) `DropdownMenuContent onInteractOutside={(e) => { if ((e.target as HTMLElement)?.closest('[role="dialog"]')) e.preventDefault(); }}` — preserve open state όταν ο user αλληλεπιδρά με το portaled color dialog (το `useDialog` του React Aria σετάρει `role="dialog"` στο dialog root). Workflow result: V/G panel μένει ανοικτό κατά τη χρήση color dialog, ο user μπορεί να αλλάξει διαδοχικά πολλαπλά swatches χωρίς να επανανοίξει το V/G dropdown. **Files (1 modified)**: `src/subapps/dxf-viewer/ui/ribbon/panels/VisibilityGraphicsPanel.tsx` (+12/-2: 1 `modal={false}` prop + 1 `onInteractOutside` handler + 7-line doc block). 25/25 V/G runtime + scene-layer tests PASS (zero regression — focus behavior is browser-level, covered by manual verification στο localhost:3000). TSC clean. ADR-375 Phase C runtime stack now production-stable. | Claude (Sonnet 4.6) |
| 2026-05-26 | **2.8 — Phase C.4 V/G > Layer Priority Stack Fix (Revit-faithful)** | **Surface (Giorgio runtime report)**: «όταν αλλάζω χρώμα τοίχου BIM στο V/G panel, δεν βλέπω να αλλάζει το χρώμα του τοίχου στον καμβά». **Root cause**: `resolveSubcategoryStyle` priority stack είχε `layerOverride.color > parent.cutColor`. Επειδή κάθε wall έχει layer με assigned color (από LayerStore), το `layerOverride.color` ήταν **πάντα defined** και νικούσε σιωπηρά το V/G cutColor/projectionColor — ο user έβλεπε zero effect από το V/G eye/color toggle. Επιπλέον το `layerOverride.lineweightMm` (concrete mm bypass) έτρεχε ΠΡΙΝ ο user V/G pen, ίδιο pattern για pen. **Industry convergence verified**: (1) Revit "Override Graphics in View" — explicit per-view category override wins over Material/Layer colors. (2) ArchiCAD Graphic Override Rule — same per-view explicit > defaults pattern. (3) AutoCAD Layer State Override σε layouts — view override wins. V/G is by definition "make this category look like X in THIS view". **Fix**: rewrite `resolveSubcategoryStyle` με Revit-faithful priority stack: **elem > sub Object Style > V/G user explicit > Layer > parent DEFAULT**. Key insight για user-set detection: lookup `ctx.objectStyles?.[category]` (raw user input, NO merge με DEFAULT_OBJECT_STYLES) — `field !== undefined` distinguishes user-explicit values από globals. DEFAULT_OBJECT_STYLES carries μόνο pen indices (no colors/patterns), οπότε raw absence ⇒ "no V/G override active". **Beyond cutState special case**: V/G user pen και Layer mm bypass skipped (Revit Line Styles πάντα BEYOND_PEN για κάτω-από-view-range geometry — representational convention). **Files**: 1 modified (`bim-line-weight-resolver.ts` — complete `resolveSubcategoryStyle` refactor, ~80 lines), 1 test updated (`bim-layer-override.test.ts` — old "Layer > V/G pen" assertion flipped to "V/G > Layer pen"), 4 new tests added (V/G category color wins over Layer color για cut/projection/null-reset/no-override fallback). **Tests**: 205/205 resolver+config PASS (1 updated + 4 new) + 36/36 downstream renderer PASS (zero regression). Sub Object Style hardcoded structural intent preserved (e.g. `walkline` = dashed, `hidden-lines` = dashed) — sub > V/G όταν sub field defined, V/G > Layer όταν sub undefined. **No UI changes** — pure resolver fix. ADR-375 Phase C V/G runtime parity now 1:1 industry-faithful. | Claude (Sonnet 4.6) |
| 2026-05-26 | **2.7 — Phase C.4 V/G Color Picker UX swap (centralized UnifiedColorPicker)** | **Surface (Giorgio UX directive)**: `VisibilityGraphicsPanel.tsx` χρησιμοποιούσε native `<input type="color">` σε 2 cells ανά κατηγορία (projection + cut) = 24 native color inputs συνολικά. Στα Windows αυτό ανοίγει το system color picker το οποίο είναι ξεκάρφωτο από το UI και υποδέεστερο του ήδη υπάρχοντος κεντρικοποιημένου enterprise picker που εμφανίζεται στην καρτέλα **DXF Settings** του Floating Panel (μέσω `LineColorControl` → `UnifiedColorPicker`). **Swap**: `<input type="color">` → `<UnifiedColorPicker variant="modal">` σε 2 σημεία του render. Full enterprise defaults διατηρούνται (palettes + recent + hex/rgb/hsl modes + apply/cancel footer) — ο Giorgio θα ορίσει σε επόμενο βήμα αν θέλει να κρύψει features (`modes={['hex']}` / `showRecent={false}` / `showPalettes={false}` / `showModalFooter={false}`). Tooltip wrap διατηρείται με `<span className="inline-flex">` ως asChild target ώστε το Radix Tooltip να μπορεί να attachάρει ref χωρίς να σπάει τη nested component structure του UnifiedColorPicker. **Files**: 1 modified (`VisibilityGraphicsPanel.tsx`, +21/-16 lines, 1 import addition `UnifiedColorPicker` από `../../color/UnifiedColorPicker`, 2 cell swaps). Όχι αρχιτεκτονική αλλαγή — pure UX/centralization improvement (SSoT alignment: όλος ο color picking στο dxf-viewer περνά πλέον από `UnifiedColorPicker`). TSC clean. | Claude (Sonnet 4.6) |
| 2026-05-26 | **2.6 — Phase C.4 V/G Visibility Runtime Wiring HOTFIX** | **Surface (Giorgio runtime report): toggling the V/G eye icon in the ribbon "Ορατότητα/Γραφικά" panel had no visible effect — hidden walls / slabs / columns / beams / openings / slab-openings / stairs continued to render in both the 2D canvas and the 3D viewer. **Root cause**: `resolveIsCategoryVisible(category, objectStyles)` was added in v2.2 (Phase C.4) and `resolveSubcategoryStyle` correctly returns `lineWidthPx: 0` when `visible=false`, but **no renderer ever called the helper at render-entry**. The resolver only governs stroke width; translucent fill (`ctx.fill()`), per-material hatch, hover halo, hinge arcs, glazing, treads, and 3D mesh + edge overlay generation all run *outside* that resolver path and remained painted on canvas / pushed to the scene. Additionally the 3D `BimViewport3D.tsx` had no subscription on `useBimRenderSettingsStore.objectStyles`, so even with a correct filter inside `BimSceneLayer.sync()` the toggle would not trigger a rebuild. **Fix**: (a) **7 BIM 2D renderers** (`WallRenderer`, `SlabRenderer`, `ColumnRenderer`, `BeamRenderer`, `OpeningRenderer`, `SlabOpeningRenderer`, `StairRenderer`) — one-line early-return at the top of `render()` after the type guard: `if (!resolveIsCategoryVisible('<category>', useDrawingScaleStore.getState().objectStyles)) return;`. Import `resolveIsCategoryVisible` from `bim-line-weight-resolver` (already imported `resolveSubcategoryStyle`); existing `useDrawingScaleStore` import reused. (b) **3D `BimSceneLayer.sync()`** — snapshot `objectStyles` once at top of `sync()`, derive 7 booleans (`wallVisible`, `columnVisible`, `beamVisible`, `slabVisible`, `stairVisible`, `openingVisible`, `slabOpeningVisible`), wrap each entity loop in `if (...Visible)` so the mesh + edge overlay never enter the scene. Wall + slab loops still call `wallToMesh` / `slabToMesh` when their own visibility is on but pass an **empty openings array** when `openingVisible` / `slabOpeningVisible` is false (host stays solid, no `THREE.Shape` holes — IFC-style cutout semantic preserved). (c) **`BimViewport3D.tsx`** — new `useEffect` subscribing to `useBimRenderSettingsStore.subscribe((s) => s.objectStyles, ...)` that re-issues `syncBimEntities` with the current entity snapshot whenever any V/G mutation fires. Mirrors the existing `useBim3DEntitiesStore.subscribe` block (same pattern, same args). **Tests**: 2 new files — `bim-renderers-vg-visibility.test.ts` (7 renderers × `it.each`: `visible=false` → zero `fill`/`stroke`/`beginPath` calls; type-mismatch sanity), `BimSceneLayer-vg-visibility.test.ts` (10 cases: default → all 5 converters fire; per-category hidden → that converter skipped; opening/slab-opening hidden → host receives empty array; all hidden → group has zero children). Existing 24/24 `bim-vg-overrides.test.ts` resolver tests PASS unchanged. **Files**: 7 renderers + 1 3D scene layer + 1 3D viewport + 2 new test files = 11 files (10 modified + 1 new wiring assertion). TSC clean. ADR-375 Phase C closed.** | Claude (Sonnet 4.6) |
| 2026-05-26 | **2.5 — Phase C.7 3D BIM Edge Overlay Parity IMPLEMENTED** | **Mirror του 2D SSoT priority stack στο BIM 3D viewer. Industry tech (Autodesk Forge / Three.js Editor / Revit / ArchiCAD): `Line2 / LineSegments2 + LineMaterial + LineSegmentsGeometry` από `three/examples/jsm/lines` (LineBasicMaterial.linewidth αγνοείται από WebGL — πάντα 1px). `THREE.EdgesGeometry(geo, 30°)` Revit silhouette default. `linewidth × devicePixelRatio` High-DPI crisp. `depthTest:true / depthWrite:false` prevents z-fighting. `alphaToCoverage:true` MSAA edge smoothing. **4 NEW**: `edges/bim-3d-edge-resolver.ts` (wrapper γύρω από `resolveSubcategoryStyle` — zero duplication, default `thresholdAngle=30`), `edges/bim-3d-edge-overlay-builder.ts` (`buildEdgeOverlay(mesh, opts)` + `attachEdgeOverlay`, geometry.dispose unsubscribes resolution store για zero leaks), `edges/bim-edge-resolution-store.ts` (singleton με `setSize/getSize/copyInto/subscribe` API — ADR-040 compliant, only fires on actual resize), `edges/__tests__/` 2 test suites. **5 MODIFIED**: `BimToThreeConverter.ts` (4 entity types: wall/column/beam/slab via `attachEdgesProjection` helper), `wall-opening-extrude.ts` (per-segment edge attach μέσα στο segment loop, mirror του ADR-363 Bug 2 pattern), `StairToThreeConverter.ts` (`attachStairEdges` helper με ADR-377 subcategory keys: treads→`treads`, risers→`risers`, stringers→`outlines`, landings→parent stair; handrails skipped — round tubes σε 30° δεν παράγουν σιλουέτα), `ThreeJsSceneManager.ts` (one-line wire στο `resize()` → `bimEdgeResolutionStore.setSize`). **Lifecycle**: edge overlays είναι children των parent BIM meshes (`mesh.add(overlay)`), `BimSceneLayer.clearGroup()` recursive dispose τα καλύπτει automatic, raycast hits παραμένουν στο parent mesh (overlays = visual decoration). **Outcome**: layer override C.6 + element override C.5 + V/G C.4 + visibility όλα live στο 3D viewer με ίδιους κανόνες όπως 2D. Phase C ολοκληρωμένο.** | Claude (Opus 4.7) |
| 2026-05-26 | **2.4 — Phase C.6 Layer-Driven Lineweight Override IMPLEMENTED** | **ADR-358 integration: SceneLayer.lineweight (concrete ISO mm) overrides BIM pen table at priority level C.6 (below C.5 elementOverride, above subcategory pen). `BimLayerOverride` interface (`lineweightMm?: ConcreteLineweightMm, color?: string \| null`) added to `bim-line-weight-resolver.ts`. `SubcategoryResolutionContext.layerOverride?` field. `resolveSubcategoryStyle` updated: if `layerOverride.lineweightMm` is a concrete value (checked via `isConcreteLineweight` guard from ADR-358 SSoT), bypass pen table entirely and call `lineweightToPx(mm, dpi)` directly. Color priority: `elementOverride.color > layerOverride.color > subcategory/parent V/G`. Pattern unaffected (comes from subcategory/parent, not from layer). 7 BIM renderers wired: each computes `_layerOverride` inline via `getLayer(entity.layerId)` + `isConcreteLineweight(layer.lineweight)` guard. WallRenderer passes `layerOverride` as param to `drawFootprint` and `drawMaterialHatch` (DRY: computed once in `render()`). ColumnRenderer replaces `resolveLineWeightPx` call with `resolveSubcategoryStyle` to accept the new context field. 16/16 new tests PASS (`bim-layer-override.test.ts`). 181/181 total config suite PASS (zero regression).** | Claude (Sonnet 4.6) |
| 2026-05-26 | **2.3 — Phase C.5 Per-Element Style Override IMPLEMENTED** | **Revit "Override Graphics in View by Element" equivalent. `BimElementStyleOverride` interface (NEW in `bim-object-styles.ts`): `visible?/projectionPen?/cutPen?/color?/linePattern?`. `BimEntity.styleOverride?: BimElementStyleOverride` field added to base type (Firestore-persisted in entity doc). `SubcategoryResolutionContext.elementOverride?` field. `resolveSubcategoryStyle` updated with new C.5 priority layer: `elementOverride.visible=false` → zero; `elementOverride.cutPen/projectionPen` → full pen+color+pattern override from element; partial override (color/linePattern without pen) → pen from objectStyles but color/pattern from elementOverride. 7 BIM renderers wired: `WallRenderer` (×2 calls: common-edges + cut-pattern), `SlabRenderer`, `SlabOpeningRenderer`, `ColumnRenderer`, `BeamRenderer` (×2: hidden-lines + section-profile), `StairRenderer` (lambda `_rss`), `OpeningRenderer` (lambda `_rso`). 17/17 new tests PASS (`bim-per-element-override.test.ts`). 43/43 existing resolver tests PASS (zero regression). No UI (context-menu wiring deferred to Phase D+).** | Claude (Sonnet 4.6) |
| 2026-05-26 | **2.2 — Phase C.4 Visibility/Graphics Per-View Overrides IMPLEMENTED** | **Full Revit V/G equivalent. `ObjectStyle` extended: `+visible?`, `+projectionColor?`, `+cutColor?`, `+projectionPattern?`, `+cutPattern?`. `bim-line-weight-resolver.ts`: new `resolveIsCategoryVisible(category, objectStyles?)` helper + `resolveSubcategoryStyle` updated with full V/G priority stack (visible=false short-circuit → subcategory → category V/G → global DEFAULT). `bim-render-settings-store.ts`: 3 new setters `setObjectStyleVisibility/setObjectStyleVgColor/setObjectStyleVgPattern`, all 500ms debounce → Firestore. `VisibilityGraphicsPanel.tsx` (NEW): DropdownMenu trigger showing eye icon + hidden count; table 12 categories × [visible toggle | proj pen | proj color | proj pattern | cut pen | cut color | cut pattern]. `ObjectStylesPanel.tsx`: narrowed `setObjectStyleField` key type to `'projectionPen'|'cutPen'` (backward-compat — removes false `keyof ObjectStyle` broadness). Ribbon: VISIBILITY_GRAPHICS_PANEL in View tab (after OBJECT_STYLES_PANEL). i18n el+en: 20 new keys each (`ribbon.panels.visibilityGraphics`, `ribbon.commands.visibilityGraphics.*`). 24/24 new tests PASS. 59/59 existing resolver+store tests PASS. TSC pending.** | Claude (Sonnet 4.6) |
| 2026-05-26 | **2.1 — Phase C.2 Pen Sets Presets IMPLEMENTED** | **ArchiCAD-style pen set bundles: one click swaps the entire 16×6 pen table. 3 presets: `design` (one ISO step thinner), `construction` (equals PEN_TABLE_MM defaults — empty overrides), `presentation` (one ISO step heavier). `config/bim-pen-sets.ts` (new): `PenSetName` union, full ISO tables, `penSetToOverrides(name)` computes sparse diff vs defaults. `state/bim-pen-table-store.ts` (modified): +`activePresetName: PenSetName \| 'custom'` state, +`applyPreset(name)`, `setCell/resetCell` → auto-set `activePresetName='custom'`, `resetAll()` → `'construction'`, `loadForCompany` reads `activePresetName` from Firestore snapshot. `services/bim-pen-table.service.ts` (modified): `PenTableDoc.activePresetName` field, `savePenTableOverrides(companyId, overrides, activePresetName)` param, `subscribePenTableOverrides` callback now yields `PenTableSnapshot {overrides, activePresetName}`. `ui/ribbon/panels/PenTablePanel.tsx` (modified): `<nav>` with 3 preset buttons (`aria-pressed`) + disabled Custom indicator, Reset All button disables when `construction` + no overrides. i18n el+en: `penTable.penSets.{tabsAriaLabel,design,construction,presentation,custom}`. 25/25 tests PASS.** | Claude (Sonnet 4.6) |
| 2026-05-26 | **2.0 — Phase C.1 Pen Table Editor IMPLEMENTED** | **Per-company editable 16×6 pen table override system. Architecture: sparse override map stored in `dxf_viewer_pen_tables/{companyId}` (singleton doc per company). Module-level `_activePenTable` injection in `bim-line-weight-resolver.ts` via `setPenTableSource()` — zero renderer changes. `bim-pen-table-store.ts` Zustand store: `setCell/resetCell/resetAll` + 500ms debounce Firestore save + automatic `setPenTableSource` on every update. 6 new files: `config/bim-pen-table-types.ts` (PenTableOverrides, EffectivePenTable, buildEffectivePenTable, isOverridden), `services/bim-pen-table.service.ts` (loadOnce/save/subscribe), `state/bim-pen-table-store.ts` (Zustand store), `state/hooks/useBimPenTableSync.ts` (self-contained company sync hook), `ui/ribbon/panels/PenTablePanel.tsx` (16×6 grid, ISO select per cell, amber highlight for modified, right-click reset, counter badge), `state/__tests__/bim-pen-table-store.test.ts` (10 tests). 8 modified: `config/bim-line-weight-resolver.ts` (+_activePenTable injection + setPenTableSource export), `config/firestore-collections.ts` (+DXF_VIEWER_PEN_TABLES), `ui/ribbon/data/view-tab-bim-settings.ts` (+PEN_TABLE_PANEL), `ui/ribbon/data/ribbon-default-tabs.ts` (+PEN_TABLE_PANEL), `ui/ribbon/components/RibbonPanel.tsx` (+pen-table widgetId), `app/DxfViewerContent.tsx` (+useBimPenTableSync()), i18n el+en (+penTable keys). 10/10 new tests PASS. 43/43 resolver tests PASS (zero regression). TSC clean.** | Claude (Sonnet 4.6) |
| 2026-05-26 | **1.9 — StairRenderer + OpeningRenderer secondary-line coverage HOTFIX** | **Surface (Giorgio runtime report): stairs δεν αντιδρούσαν σε DrawingScale / ViewRange Cut Plane / ObjectStyles changes, ενώ οι ίδιοι controls δούλευαν σωστά για walls. **Root cause**: το v1.7 hotfix άγγιξε 6 BIM renderers (Wall/Slab/Column/Beam/Opening/SlabOpening) αλλά **όχι StairRenderer** (διαφορετικό pattern — υπήρχε ήδη partial migration σε μία μόνο γραμμή). Επιπλέον, ο `OpeningRenderer` είχε wired μόνο την κύρια wall-opening γραμμή στο `resolveLineWeightPx`· τα 4 secondary visual cues (hinge swing arc, door leaf line, sliding indicator, glazing inset) χρησιμοποιούσαν ακόμη hardcoded `RENDER_LINE_WIDTHS.{THIN,NORMAL}`. **Fix στο `StairRenderer.ts`**: στο `render()` υπολογίζω μία φορά `cutState = resolveCutState({ zBottomMm: stair.params.basePoint.z, zTopMm: zBottom + stair.params.totalRise, category: 'stair' }, ds.viewRange)` + `baseLineWidth = resolveLineWeightPx({ category: 'stair', cutState, scaleDenominator, dpi: 96, objectStyles })` και το προωθώ ως required field στο `StairStyleContext` (που πλέον έχει `baseLineWidth: number`) + ως param στα `drawHandrails(stair, baseLineWidth)` / `drawWalkline(walkline, baseLineWidth)` / `drawArrow(start, end, label, baseLineWidth)`. Removed: `RENDER_LINE_WIDTHS` import + hardcoded `cutState: 'cut'` στο drawArrow (αντικαταστάθηκε από το computed cutState). **Fix στο `stair-render-structure-style.ts`**: 8 occurrences `RENDER_LINE_WIDTHS.{THICK,NORMAL,THIN}` → `scx.baseLineWidth` (treads NORMAL + stringer-1side/central/cantilever/2side/glass/grating THICK + suspended THIN ×2). Visual hierarchy stringer/tread/walkline mirrors WallRenderer single-lineWidth pattern (όλη η σκάλα ίδιο πάχος, διαφοροποίηση μέσω dash patterns)· per-element hierarchy φέρεται από Object Subcategories στο Phase C.3 (pending). **Fix στο `OpeningRenderer.ts`**: το ήδη computed `_opCutState` παράγει `_opBaseLineWidth` που προωθείται στο `drawKindOverlay(opening, baseLineWidth)` → `drawHingeArc / drawSlidingIndicator / drawGlazing`. 4 hardcoded line widths (lines 177, 182, 214, 232) → `baseLineWidth`. Hover halo (line 60) εσκεμμένα διατηρεί `RENDER_LINE_WIDTHS.NORMAL` (scale-independent UX glow). **Files**: 3 modified + 1 test factory updated (`StairRenderer.ts`, `stair-render-structure-style.ts`, `OpeningRenderer.ts`, `__tests__/stair-render-structure-style.test.ts` — `makeScx()` accepts optional `baseLineWidth = 1.5`). **Tests**: 16/16 stair-render-structure-style PASS. TSC clean. Pending commit (separate from άλλου agent ADR-376 Phase C.2 work που υπάρχει στο working tree).** | Claude (Sonnet 4.6) |

---

## 9. References

### Industry sources (Revit research)
- [Revit Line Weights — Engipedia](https://www.engipedia.com/revit-line-weights/)
- [13 Tips Revit Line Weights — BIM Pure](https://www.bimpure.com/blog/13-tips-to-understand-line-weights-in-revit)
- [Revit Pure Pamphlet #12 — Line Weights (PDF)](https://static1.squarespace.com/static/5605a932e4b0055d57211846/t/5c92e1c8b208fc0cdfa22bf4/1553129929112/RP-Pamphlet12-Line-Weights.pdf)
- [Revit Object Styles — CADnotes](https://www.cad-notes.com/revit-object-styles/)
- [Revit Subcategories — Graitec](https://graitec.com/uk/blog/revit-families-taking-control-with-subcategories/)
- [Modify Line Weights — Autodesk](https://www.autodesk.com/support/technical/article/caas/sfdcarticles/sfdcarticles/Revit-How-to-modify-line-weight.html)
- [Add View Scales — Autodesk Knowledge Network](https://help.autodesk.com/cloudhelp/2022/ENU/Revit-Customize/files/GUID-402A7037-BE0C-4061-B4CF-598467BBF6D3.htm)
- [Wall Line Weights — AECTechTalk](https://aectechtalk.wordpress.com/2012/11/11/controlling-revit-wall-component-linework/)
- [Cut Pattern Line Weights — Revit Clinic](https://revitclinic.typepad.com/my_weblog/2010/03/drafting-cut-pattern-line-weights-on-walls.html)

### Industry sources (View Range research — 2026-05-25)
- [About the View Range — Autodesk 2025](https://help.autodesk.com/view/RVT/2025/ENU/?guid=GUID-58711292-AB78-4C8F-BAA1-0855DDB518BF)
- [View Range Explained — ATG USA](https://atgusa.com/revit-view-range-explained/)
- [View Range Become Expert in 10 min — BIM and Beam](https://bimandbeam.com/2022/01/revit-view-range-html/)
- [View Range Cut Plane — Novedge](https://novedge.com/blogs/design-news/revit-tip-mastering-revit-view-range-cut-plane)
- [View Depth & Far Clipping — Novedge](https://novedge.com/blogs/design-news/revit-tip-mastering-view-depth-and-far-clipping-in-revit)
- [Floor Plan Optimization — BIM Associates](https://www.bimassociates.com/blog/optimising-revit-floor-plan-view-range/)
- [Beam Projection in Plan — Engipedia](https://www.engipedia.com/display-beam-projection-revit-plan-views/)
- [Underlay in Revit — LazyBim](https://lazybim.com/revit-underlay/)
- [Revit Logic & Walls Not Cut — Cadgroup](https://www.cadgroup.com.au/knowledge-base/revit-logic-and-walls-that-dont-show-as-cut/)

### Industry sources (ArchiCAD comparison)
- [ArchiCAD BIM Pen Sets — gtaljaard](https://gtaljaard.wordpress.com/2013/09/29/archicad-17-int-bim-pen-sets/)
- [ArchiCAD Pens — On Land](https://www.onland.info/archives/2022/06/pens_25.php)

### Standards
- [ISO 128 — Wikipedia](https://en.wikipedia.org/wiki/ISO_128)
- [ISO 128-20:1996 — Sample](https://cdn.standards.iteh.ai/samples/1408/f62555427b87436eafe1e6abc5271860/ISO-128-20-1996.pdf)
- [Line Weights & ISO 128 — CADdrafter](https://caddrafter.us/line-weights-and-annotation-standards/)

### Internal references
- `src/subapps/dxf-viewer/config/text-rendering-config.ts` (current generic SSoT — ADR-044)
- `src/subapps/dxf-viewer/canvas-v2/dxf-canvas/entity-renderers/bim/*` (consumers)
- ADR-044, ADR-040, ADR-363, ADR-370, ADR-358, ADR-365, ADR-343
