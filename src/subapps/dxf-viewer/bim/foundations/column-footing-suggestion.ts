/**
 * column-footing-suggestion — pure detection για το proactive «βάλε/επέκτεινε
 * πέδιλο» (ADR-459 Phase 2/3).
 *
 * Δοθείσας μιας νέας κολόνας (ενεργός όροφος) + των πεδίλων του ορόφου Θεμελίωσης
 * (cross-level), αποφασίζει ΕΝΑ από τα τρία:
 *   · `covered` — υπάρχει ήδη πέδιλο που στηρίζει τη βάση της (→ μόνο FK, μηδέν toast).
 *   · `extend`  — υπάρχει ΓΕΙΤΟΝΙΚΟ πέδιλο που ΔΕΝ την καλύπτει (→ πρόταση επέκτασης,
 *                 2 κολόνες + 1 πέδιλο = ένας οργανισμός).
 *   · `create`  — κανένα κοντινό πέδιλο (→ πρόταση δημιουργίας νέου).
 *
 * Όλα τα Z σε **απόλυτο** datum-relative frame (column base = FFL ενεργού + offset·
 * footing top = FFL Θεμελίωσης + topElevationMm). Reuse του SSoT κριτηρίου
 * `footingSupportsColumnBase` (μηδέν duplicate, N.0.2). Plan XY κοινό frame μεταξύ
 * ορόφων (ίδια υπόθεση με τον 3D multi-floor stacker).
 *
 * Pure module — zero React/DOM/Firestore deps.
 *
 * @see footing-column-coverage.ts — footingSupportsColumnBase (coverage SSoT)
 * @see footing-element-summary.ts — resolveFootingSummary
 * @see docs/centralized-systems/reference/adrs/ADR-459-structural-organism-connectivity.md §Phase 2/3
 */

import { isColumnEntity } from '../../types/entities';
import { resolveColumnBaseZmm } from '../geometry/column-vertical-profile';
import { resolveFootingSummary } from './footing-element-summary';
import { footingSupportsColumnBase, polygonCentroid, type CoveragePoint } from './footing-column-coverage';
import type { Entity } from '../../types/entities';
import type { ColumnEntity } from '../types/column-types';

/** Μέγιστη απόσταση κέντρων (canvas units = mm) για πρόταση επέκτασης. */
export const EXTEND_MAX_CENTROID_GAP_MM = 3000;
/** Μέγιστη κατακόρυφη απόκλιση top πεδίλου ↔ βάσης κολόνας (mm) για «ίδιο επίπεδο». */
export const EXTEND_MAX_Z_GAP_MM = 2000;

/** Ένα υποψήφιο πέδιλο με το απόλυτο FFL του ορόφου που ζει. */
export interface FootingCandidate {
  readonly entity: Entity;
  readonly floorElevationMm: number;
}

export type ColumnFootingSuggestion =
  | { readonly kind: 'covered'; readonly footingId: string }
  | { readonly kind: 'extend'; readonly footingId: string }
  | { readonly kind: 'create' };

function distance(a: CoveragePoint, b: CoveragePoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Plan-centroid βάσης + απόλυτο baseZmm κολόνας, ή null αν εκφυλισμένη. */
function columnBase(
  column: ColumnEntity,
  floorElevationMm: number,
): { centroid: CoveragePoint; baseZmm: number } | null {
  const verts = column.geometry?.footprint?.vertices;
  if (!verts || verts.length < 3) return null;
  return {
    centroid: polygonCentroid(verts),
    baseZmm: resolveColumnBaseZmm(column.params, { floorElevationMm }),
  };
}

/**
 * Αποφασίζει covered / extend / create για τη νέα κολόνα έναντι των cross-level
 * πεδίλων. Αν η κολόνα έχει ήδη `footingId`, ή είναι εκφυλισμένη, ή δεν υπάρχουν
 * πέδιλα → επιστρέφει `create`/`covered` αναλόγως.
 */
export function suggestColumnFooting(
  column: Entity,
  columnFloorElevationMm: number,
  footings: readonly FootingCandidate[],
): ColumnFootingSuggestion {
  if (!isColumnEntity(column)) return { kind: 'create' };
  // Ήδη συνδεδεμένη (ρητό FK) → καμία πρόταση (covered, no-op).
  if (column.params.footingId !== undefined) {
    return { kind: 'covered', footingId: column.params.footingId };
  }
  const base = columnBase(column, columnFloorElevationMm);
  if (!base) return { kind: 'create' };

  let nearest: { footingId: string; gap: number } | null = null;
  for (const c of footings) {
    const s = resolveFootingSummary(c.entity);
    if (!s) continue;
    const topZmm = s.topZmm + c.floorElevationMm;
    // (α) καλύπτει τη βάση → covered (authoritative, μηδέν toast).
    if (footingSupportsColumnBase({ footprint: s.footprint, topZmm }, { baseCentroid: base.centroid, baseZmm: base.baseZmm })) {
      return { kind: 'covered', footingId: c.entity.id };
    }
    // (β) γειτονικό + ~ίδιο επίπεδο → υποψήφιο επέκτασης (κράτα το κοντινότερο).
    if (Math.abs(topZmm - base.baseZmm) > EXTEND_MAX_Z_GAP_MM) continue;
    const gap = distance(base.centroid, polygonCentroid(s.footprint));
    if (gap <= EXTEND_MAX_CENTROID_GAP_MM && (nearest === null || gap < nearest.gap)) {
      nearest = { footingId: c.entity.id, gap };
    }
  }
  if (nearest) return { kind: 'extend', footingId: nearest.footingId };
  return { kind: 'create' };
}
