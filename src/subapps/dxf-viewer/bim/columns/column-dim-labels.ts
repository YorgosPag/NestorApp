/**
 * ADR-363 Phase 8F — Column permanent dimension labels.
 *
 * Revit-style: when a column is selected or hovered, a centred pill label
 * appears directly on the column footprint (NOT a floating tooltip).
 *
 * `formatColumnDimLabels` is the SSoT for the column label text per kind. The
 * centred pill DRAWING now lives in the shared `bim/labels/bim-dim-labels`
 * (`drawDimPill`) consumed by every BIM renderer (the former `drawColumnDimPill`
 * moved there, generalised + larger font).
 *
 * Label format per kind:
 *   rectangular  → "w=400  d=400"
 *   circular     → "Ø=400"
 *   shear-wall   → "L=2000  t=200"
 *   I-shape      → "b=150  h=300"
 *   polygon      → "Ø=400  N=6"
 *   L-shape      → "w=400  d=400"
 *   T-shape      → "w=400  d=400"
 *   U-shape      → "w=400  d=400"   (τοιχείο ΟΣ, ADR-363 Phase 2)
 *   composite    → "w=400  d=400"   (σύνθετη διατομή, ADR-363 Phase 2)
 *
 * When `params.catalogProfile` is set, it is prepended as the first line
 * (e.g. ["IPE-300", "b=150  h=300"]).
 *
 * @see ADR-363 §5.6 Phase 8F
 */

import type { ColumnParams } from '../types/column-types';
import { DEFAULT_POLYGON_SIDES } from '../types/column-types';
import { formatLengthMm } from '../../config/display-length-format';

/** Hide label when the screen bounding-box span is smaller than this (px). */
export const COLUMN_LABEL_MIN_FOOTPRINT_PX = 20;

/**
 * Returns the ordered array of label lines for the column.
 * All measurements are rounded to integer mm.
 * Returns `[]` when `params.kind` is unrecognised.
 */
export function formatColumnDimLabels(params: ColumnParams): string[] {
  const w = Math.round(params.width);
  const d = Math.round(params.depth);
  const prefix = params.catalogProfile ? [params.catalogProfile] : [];

  switch (params.kind) {
    case 'rectangular': return [...prefix, `w=${w}  d=${d}`];
    case 'circular':    return [...prefix, `Ø=${w}`];
    case 'shear-wall':  return [...prefix, `L=${formatLengthMm(w)}  t=${d}`];
    case 'I-shape':     return [...prefix, `b=${w}  h=${d}`];
    case 'polygon': {
      const sides = params.polygon?.sides ?? DEFAULT_POLYGON_SIDES;
      return [...prefix, `Ø=${w}  N=${sides}`];
    }
    case 'L-shape':     return [...prefix, `w=${w}  d=${d}`];
    case 'T-shape':     return [...prefix, `w=${w}  d=${d}`];
    // ADR-363 Phase 2 «από περίγραμμα» — τοιχία ΟΣ· bbox w/d (πολύγωνο = SSoT γεωμετρίας).
    case 'U-shape':     return [...prefix, `w=${w}  d=${d}`];
    case 'composite':   return [...prefix, `w=${w}  d=${d}`];
    default:            return [];
  }
}

