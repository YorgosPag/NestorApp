/**
 * ADR-396 — Κολώνες ως είσοδος του κελύφους: ελάχιστο σχήμα + προ-υπολογισμός αποτυπώματος.
 *
 * Τροφοδοτεί την ένωση αποτυπωμάτων (`building-footprint.ts`) — το ΕΝΑ SSoT κελύφους
 * (`envelope-topology.ts`). Οι κόμβοι-γέφυρες του παλιού γράφου τοίχων (`col:<id>`, ανοχή 0,3 m,
 * τόξο εξωτ. όψεων) αποσύρθηκαν μαζί με το `computeEnvelopePerimeter` (ADR-937 2026-11-13): στην ένωση
 * η κολώνα κλείνει το κέλυφος **όταν ακουμπά** τους τοίχους, όπως στην πραγματικότητα — ένα κενό
 * φαίνεται, δεν «γεφυρώνεται» σιωπηλά.
 *
 * Καθαρές συναρτήσεις (canvas-unit χώρος). Μηδέν globals / React / Firestore.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-396-bim-external-thermal-envelope-etics.md §3.1
 */

import type { BimPoint } from '../types/bim-base';
import type { ColumnParams } from '../types/column-types';
import { computeColumnGeometry } from './column-geometry';
import { polygonCentroid } from './shared/polygon-utils';

/** Ελάχιστη μορφή κολώνας για το κέλυφος (καλύπτει `ColumnEntity` / `DxfColumn`). */
export interface ColumnForEnvelope {
  readonly id: string;
  readonly params: ColumnParams;
}

/** Προ-υπολογισμένη κολώνα: footprint (canvas units, CCW) + κέντρο. */
export interface PreparedColumn {
  readonly id: string;
  readonly footprint: readonly BimPoint[];
  readonly center: { readonly x: number; readonly y: number };
}

/**
 * Προ-υπολογίζει footprint + κέντρο κάθε κολώνας (SSoT `computeColumnGeometry`).
 * Αν η `geometry.footprint` είναι ήδη cached (π.χ. ColumnEntity) → χρησιμοποιεί
 * αυτήν (zero re-compute). Fallback σε `computeColumnGeometry` μόνο για plain
 * `ColumnForEnvelope` χωρίς pre-computed geometry. Σε degenerate params (π.χ.
 * test stubs χωρίς anchor/kind) → skip gracefully (empty footprint = δεν συμμετέχει).
 */
export function prepareColumns(
  columns: readonly (ColumnForEnvelope & { geometry?: { footprint?: { vertices?: readonly BimPoint[] } } })[],
): PreparedColumn[] {
  const result: PreparedColumn[] = [];
  for (const c of columns) {
    let footprint: readonly BimPoint[] | undefined = c.geometry?.footprint?.vertices;
    if (!footprint || footprint.length < 3) {
      if (!c.params.anchor || !c.params.kind || !c.params.position) continue;
      try {
        footprint = computeColumnGeometry(c.params).footprint.vertices;
      } catch {
        continue;
      }
    }
    if (footprint.length >= 3) {
      result.push({ id: c.id, footprint, center: polygonCentroid(footprint) });
    }
  }
  return result;
}
