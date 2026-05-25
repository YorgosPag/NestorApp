/**
 * ADR-375 — BIM Object Styles (Revit-equivalent, Tier 2)
 *
 * Per category: { projectionPen, cutPen } pen assignments.
 * Defaults match Revit Architectural Template (verified 2026-05-25).
 *
 * Phase A: hard-coded defaults.
 * Phase B: user customization via ribbon + Firestore persistence.
 */
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
  | 'opening'
  | 'slab-opening'
  | 'stair'
  | 'roof'
  | 'ceiling'
  | 'dimension'
  | 'hatch'
  | 'grip';

export interface ObjectStyle {
  /** Pen used when element is in projection (not cut by plane). */
  projectionPen: PenIndex;
  /** Pen used when element is cut by view plane. */
  cutPen: PenIndex;
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
  'stair', 'roof', 'ceiling', 'dimension', 'hatch', 'grip',
] as const;

export const DEFAULT_OBJECT_STYLES: Readonly<Record<BimCategory, ObjectStyle>> = {
  wall:           { projectionPen: 5,  cutPen: 7  },
  column:         { projectionPen: 5,  cutPen: 9  },
  beam:           { projectionPen: 4,  cutPen: 6  },
  slab:           { projectionPen: 5,  cutPen: 7  },
  opening:        { projectionPen: 3,  cutPen: 4  },
  'slab-opening': { projectionPen: 3,  cutPen: 4  },
  stair:          { projectionPen: 3,  cutPen: 5  },
  roof:           { projectionPen: 5,  cutPen: 6  },
  ceiling:        { projectionPen: 3,  cutPen: 4  },
  dimension:      { projectionPen: 3,  cutPen: 3  },
  hatch:          { projectionPen: 1,  cutPen: 1  },
  grip:           { projectionPen: 3,  cutPen: 3  },
} as const;
