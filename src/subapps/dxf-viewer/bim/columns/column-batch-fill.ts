/**
 * ADR-524 — «Πολλαπλή πλήρωση όμοιων πλαισίων» (batch-fill same-color frames).
 *
 * Μετά την τοποθέτηση μιας κολόνας/τοιχίου σε ένα πλαίσιο 4 γραμμών συγκεκριμένου
 * χρώματος (ADR-419 «1 κλικ μέσα»), σαρώνει την κάτοψη για ΟΛΑ τα υπόλοιπα όμοια
 * (ίδιο resolved χρώμα) πλαίσια που ΔΕΝ έχουν ακόμη κολόνα, ώστε ο caller να
 * προτείνει μαζική πλήρωση.
 *
 * PURE module — μηδέν React/store. Όλη η λογική χρώματος/layer εισάγεται ως
 * `colorOf` resolver (ο caller το χτίζει με `resolveEntityColorHex` + layers),
 * ώστε το module να μένει testable και η ανίχνευση χρώματος να ζει στο ΕΝΑ SSoT.
 *
 * ΚΑΜΙΑ αναπαραγωγή — επανάχρηση ΑΚΡΙΒΩΣ της ίδιας region-detection SSoT:
 *   - `extractLineSegments` + `findRectanglesFromSegments` + `pickSegmentAt`
 *     (`bim/walls/wall-in-region.ts`)
 *   - resolved χρώμα → `resolveEntityColorHex` (caller, ADR-030/445)
 *   - containment → `isPointInPolygon` (`utils/geometry/GeometryUtils`)
 *
 * @see docs/centralized-systems/reference/adrs/ADR-524-column-batch-fill-same-color-frames.md
 * @see ../walls/wall-in-region.ts (region detection SSoT)
 * @see ../../systems/selection/select-similar-by-color.ts (resolveEntityColorHex SSoT)
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import { isColumnEntity } from '../../types/entities';
import type { ColumnEntity } from '../types/column-types';
import { isPointInPolygon } from '../../utils/geometry/GeometryUtils';
import {
  extractLineSegments,
  findRectanglesFromSegments,
  pickSegmentAt,
  type DetectedRectangle,
  type RegionLineSeg,
} from '../walls/wall-in-region';

/** Resolver resolved/rendered χρώματος (lowercase hex) μιας οντότητας· `null` αν άγνωστο. */
export type EntityColorResolver = (entity: Entity) => string | null;

/** Αποτέλεσμα σάρωσης για όμοια αγέμιστα πλαίσια. */
export interface BatchFillScan {
  /** Πλαίσια ίδιου χρώματος που ΔΕΝ έχουν ακόμη κολόνα/τοιχίο. */
  readonly rects: DetectedRectangle[];
  /** Το resolved χρώμα του πλαισίου-αναφοράς (debug/τεκμηρίωση)· `null` αν άγνωστο. */
  readonly colorHex: string | null;
}

function midpoint(a: Point2D, b: Point2D): Point2D {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/**
 * Κυρίαρχο (majority) resolved χρώμα των 4 ακμών ενός πλαισίου. Για κάθε ακμή
 * δειγματίζει το μέσο της, βρίσκει το πλησιέστερο segment (`pickSegmentAt`) →
 * οντότητα (`entityById`) → resolved χρώμα (`colorOf`). Επιστρέφει το πιο συχνό
 * hex, ή `null` αν καμία ακμή δεν αντιστοιχίστηκε σε χρώμα.
 */
export function resolveRectFrameColorHex(
  rect: DetectedRectangle,
  segments: readonly RegionLineSeg[],
  tol: number,
  entityById: ReadonlyMap<string, Entity>,
  colorOf: EntityColorResolver,
): string | null {
  const poly = rect.polygon;
  const counts = new Map<string, number>();
  for (let i = 0; i < 4; i++) {
    const mid = midpoint(poly[i], poly[(i + 1) % 4]);
    const seg = pickSegmentAt(mid, segments, tol);
    const id = seg?.id;
    if (!id) continue;
    const entity = entityById.get(id);
    if (!entity) continue;
    const hex = colorOf(entity);
    if (!hex) continue;
    counts.set(hex, (counts.get(hex) ?? 0) + 1);
  }
  let best: { hex: string; n: number } | null = null;
  for (const [hex, n] of counts) {
    if (!best || n > best.n) best = { hex, n };
  }
  return best?.hex ?? null;
}

/**
 * Όλα τα κλειστά ορθογώνια που σχηματίζονται ΜΟΝΟ από οντότητες resolved χρώματος
 * `targetHex`. Επαναχρησιμοποιεί ΑΚΡΙΒΩΣ την ίδια region-detection SSoT — το μόνο
 * επιπλέον είναι το χρωματικό προ-φίλτρο των οντοτήτων.
 */
export function findSameColorRects(
  entities: readonly Entity[],
  targetHex: string,
  tol: number,
  colorOf: EntityColorResolver,
): DetectedRectangle[] {
  const sameColor = entities.filter((e) => colorOf(e) === targetHex);
  const segs = extractLineSegments(sameColor);
  return findRectanglesFromSegments(segs, tol);
}

/** True αν υπάρχει ήδη κολόνα/τοιχίο με κέντρο μέσα στο πλαίσιο (ήδη γεμισμένο). */
export function rectAlreadyFilled(
  rect: DetectedRectangle,
  columns: readonly ColumnEntity[],
): boolean {
  const poly = [...rect.polygon];
  return columns.some((c) =>
    isPointInPolygon({ x: c.params.position.x, y: c.params.position.y }, poly),
  );
}

/**
 * Entry point — σαρώνει την κάτοψη για ΟΜΟΙΑ (ίδιο resolved χρώμα) πλαίσια που δεν
 * έχουν ακόμη κολόνα/τοιχίο. Το πλαίσιο που μόλις γέμισε εξαιρείται ΑΥΤΟΜΑΤΑ από
 * το idempotency φίλτρο (η νέα κολόνα είναι ήδη στη scene → κέντρο της μέσα στο
 * πλαίσιο). Επιστρέφει τα candidate ορθογώνια + το χρώμα-αναφοράς.
 */
export function scanSameColorUnfilledRects(
  placedRect: DetectedRectangle,
  placedSegments: readonly RegionLineSeg[],
  entities: readonly Entity[],
  tol: number,
  colorOf: EntityColorResolver,
): BatchFillScan {
  const entityById = new Map<string, Entity>();
  for (const e of entities) entityById.set(e.id, e);

  const colorHex = resolveRectFrameColorHex(placedRect, placedSegments, tol, entityById, colorOf);
  if (!colorHex) return { rects: [], colorHex: null };

  const columns = entities.filter(isColumnEntity);
  const rects = findSameColorRects(entities, colorHex, tol, colorOf).filter(
    (r) => !rectAlreadyFilled(r, columns),
  );
  return { rects, colorHex };
}
