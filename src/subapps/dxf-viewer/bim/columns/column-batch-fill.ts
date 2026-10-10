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
 * ΚΑΜΙΑ αναπαραγωγή — ο χρωματικός σαρωτής ορθογωνίων ζει στο ουδέτερο
 * `bim/walls/same-color-rects.ts` (κοινός με τον βοηθό του ADR-911)· εδώ μένει ΜΟΝΟ
 * ό,τι ξέρει τι είναι κολώνα: το idempotency φίλτρο και το entry point.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-524-column-batch-fill-same-color-frames.md
 * @see ../walls/same-color-rects.ts (χρωματικός σαρωτής ορθογωνίων — SSoT)
 * @see ../walls/wall-in-region.ts (region detection SSoT)
 */

import type { Entity } from '../../types/entities';
import { isColumnEntity } from '../../types/entities';
import type { ColumnEntity } from '../types/column-types';
import { isPointInPolygon } from '../../utils/geometry/GeometryUtils';
import type { DetectedRectangle, RegionLineSeg } from '../walls/wall-in-region';
import {
  findSameColorRects,
  resolveRectFrameColorHex,
  type EntityColorResolver,
} from '../walls/same-color-rects';

/** Αποτέλεσμα σάρωσης για όμοια αγέμιστα πλαίσια. */
export interface BatchFillScan {
  /** Πλαίσια ίδιου χρώματος που ΔΕΝ έχουν ακόμη κολόνα/τοιχίο. */
  readonly rects: DetectedRectangle[];
  /** Το resolved χρώμα του πλαισίου-αναφοράς (debug/τεκμηρίωση)· `null` αν άγνωστο. */
  readonly colorHex: string | null;
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
