/**
 * ADR-363 Phase 4.5c.6 / Phase 8 / Phase 2b — Column section-symbol resolver (SSoT).
 *
 * Pure decision module: maps a `ColumnEntity` to the cross-section outline drawn
 * as a plan-view symbol (hover/selection only), or `null` when no symbol applies.
 * Extracted from `ColumnRenderer.drawSectionProfile` so the renderer stays within
 * the 500-line Google budget (CLAUDE.md N.7.1) while Phase 2b adds U-shape (Π) +
 * composite (polygon-backed) coverage.
 *
 * Per-kind rules:
 *   - L-shape / T-shape  → steel material only (∟ / ⊤). Non-steel RC L/T show
 *     dimension labels instead (section symbol = visual noise without structural
 *     meaning).
 *   - U-shape            → RC τοιχίο Π (κάθε υλικό). Polygon-backed (από-
 *     περίγραμμα) → scaled actual polygon· manual παραμετρικό Π → Π outline.
 *   - composite          → RC σύνθετο τοιχίο (κάθε υλικό). Πάντα polygon-backed.
 *   - everything else    → null (rectangular / circular / polygon / shear-wall /
 *     I-shape handled by hatch + dimension pill, no extra section glyph).
 *
 * Zero dependencies on React / DOM / canvas / Firestore.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.6 §6
 */

import type { ColumnEntity } from '../types/column-types';
// ADR-507 Φ7 — material classification ενοποιήθηκε στο MATERIAL_HATCH_MAP SSoT.
import { normalizeMaterial } from '../hatch/material-hatch-map';
import {
  computeLProfileOutline,
  computePolygonBackedOutline,
  computeTProfileOutline,
  computeUProfileOutline,
  type SectionPoint,
} from './column-section-profile';

/**
 * Resolve the section-symbol outline (LOCAL symbol px, centre = origin) for a
 * column, or `null` when no symbol should be drawn. Pure — caller owns the
 * canvas placement + styling.
 */
export function resolveColumnSectionOutline(
  column: ColumnEntity,
): ReadonlyArray<SectionPoint> | null {
  const { kind } = column;

  if (kind === 'L-shape' || kind === 'T-shape') {
    if (normalizeMaterial(column.params.material) !== 'steel') return null;
    const flipY = kind === 'L-shape'
      ? (column.params.lshape?.flipY ?? false)
      : (column.params.tshape?.flipY ?? false);
    return kind === 'L-shape'
      ? computeLProfileOutline(undefined, undefined, undefined, flipY)
      : computeTProfileOutline(undefined, undefined, undefined, undefined, flipY);
  }

  // ADR-363 Phase 2b — RC τοιχία Π / σύνθετα (κάθε υλικό, όχι μόνο χάλυβας).
  if (kind === 'U-shape') {
    const poly = column.params.ushape?.polygon;
    if (poly && poly.length >= 3) return computePolygonBackedOutline(poly);
    const flipY = column.params.ushape?.flipY ?? false;
    return computeUProfileOutline(undefined, undefined, undefined, undefined, flipY);
  }
  if (kind === 'composite') {
    const poly = column.params.composite?.polygon;
    return poly && poly.length >= 3 ? computePolygonBackedOutline(poly) : null;
  }

  return null;
}
