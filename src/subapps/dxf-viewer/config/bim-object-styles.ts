/**
 * ADR-375 — BIM Object Styles (Revit-equivalent, Tier 2)
 * ADR-377 — SubcategoryStyle extension
 *
 * Per category: { projectionPen, cutPen } pen assignments + optional subcategory overrides.
 * Defaults match Revit Architectural Template (verified 2026-05-25).
 *
 * Phase A: hard-coded defaults, SubcategoryStyle extension (ADR-377).
 * Phase B: user customization via ribbon + Firestore persistence.
 */
import type { PenIndex } from './bim-pen-table';
import type { LinePatternKey } from './bim-line-patterns';

/**
 * Discriminated entity categories matching our BIM renderers.
 * Each maps to projection + cut pen indices (Revit Object Styles).
 */
export type BimCategory =
  | 'wall'
  | 'column'
  | 'beam'
  | 'slab'
  | 'opening'
  | 'slab-opening'
  | 'stair'
  | 'roof'
  | 'ceiling'
  | 'dimension'
  | 'hatch'
  | 'grip'
  // ADR-396 P4 — ETICS εξωτερική θερμοπρόσοψη (floor-overlay, V/G κατηγορία).
  | 'envelope';

/**
 * Per-subcategory style overrides (ADR-377).
 * All fields optional — absent field falls back to parent ObjectStyle value.
 * Color null → use canvas token (light/dark adaptive).
 */
export interface SubcategoryStyle {
  cutPen?: PenIndex;
  projectionPen?: PenIndex;
  /** Line pattern override (absent → 'solid'). */
  linePattern?: LinePatternKey;
  /** Cut color hex or null (null → canvas token). */
  cutColor?: string | null;
  /** Projection color hex or null (null → canvas token). */
  projectionColor?: string | null;
}

/** ADR-375 Phase C.5 — Per-element style override (Revit "Override Graphics in View by Element"). */
export interface BimElementStyleOverride {
  /** false = hide this element entirely, regardless of category/subcategory visibility. */
  visible?: boolean;
  /** Pen for projection pass. Wins over subcategory + objectStyles. */
  projectionPen?: PenIndex;
  /** Pen for cut pass. Wins over subcategory + objectStyles. */
  cutPen?: PenIndex;
  /** Color hex or null (null = canvas token). undefined = no override. */
  color?: string | null;
  /** Line pattern override. */
  linePattern?: LinePatternKey;
}

export interface ObjectStyle {
  /** Pen used when element is in projection (not cut by plane). */
  projectionPen: PenIndex;
  /** Pen used when element is cut by view plane. */
  cutPen: PenIndex;
  // ── ADR-375 Phase C.4 — Visibility/Graphics per-view overrides ────────────
  /** false = hide this category entirely for the current view. Default: true. */
  visible?: boolean;
  /** Hex color for projection lines (null = use canvas token). */
  projectionColor?: string | null;
  /** Hex color for cut lines (null = use canvas token). */
  cutColor?: string | null;
  /** Line pattern override for projection lines. */
  projectionPattern?: LinePatternKey;
  /** Line pattern override for cut lines. */
  cutPattern?: LinePatternKey;
  // ─────────────────────────────────────────────────────────────────────────
  /** Per-subcategory style overrides (ADR-377). Keys validated by SUBCATEGORY_TAXONOMY. */
  subcategories?: Partial<Record<string, SubcategoryStyle>>;
}

/**
 * Default Object Styles — Revit Architectural Template equivalent.
 *
 * Visual hierarchy (thicker → thinner):
 *   Column cut (Pen #9 ≈ 0.70mm) > Wall/Slab cut (Pen #7 ≈ 0.35mm)
 *   > Beam cut (Pen #6 ≈ 0.25mm) > Stair cut (Pen #5 ≈ 0.18mm)
 *   > Opening (Pen #4 ≈ 0.13mm) > Dimension/Annotation (Pen #3 ≈ 0.10mm)
 *
 * Per ADR-375 §3.3 + Q0 locked hierarchy.
 */
/** All BIM categories in display order (matches DEFAULT_OBJECT_STYLES keys). */
export const BIM_CATEGORIES: readonly BimCategory[] = [
  'wall', 'column', 'beam', 'slab', 'opening', 'slab-opening',
  'stair', 'roof', 'ceiling', 'dimension', 'hatch', 'grip', 'envelope',
] as const;

export const DEFAULT_OBJECT_STYLES: Readonly<Record<BimCategory, ObjectStyle>> = {
  wall:           { projectionPen: 5,  cutPen: 7  },
  column:         { projectionPen: 5,  cutPen: 9  },
  beam: {
    projectionPen: 4, cutPen: 6,
    subcategories: { 'hidden-lines': { linePattern: 'dashed' } },
  },
  slab:           { projectionPen: 5,  cutPen: 7  },
  opening:        { projectionPen: 3,  cutPen: 4  },
  'slab-opening': { projectionPen: 3,  cutPen: 4  },
  stair: {
    projectionPen: 3, cutPen: 5,
    subcategories: {
      'walkline':  { linePattern: 'dashed'  },
      'handrails': { linePattern: 'dashed2' },
    },
  },
  roof:           { projectionPen: 5,  cutPen: 6  },
  ceiling:        { projectionPen: 3,  cutPen: 4  },
  dimension:      { projectionPen: 3,  cutPen: 3  },
  hatch:          { projectionPen: 1,  cutPen: 1  },
  grip:           { projectionPen: 3,  cutPen: 3  },
  // ADR-396 P4 — ETICS θερμοπρόσοψη: λεπτή γραμμή (όπως opening), thin hatch band.
  envelope:       { projectionPen: 3,  cutPen: 4  },
} as const;
