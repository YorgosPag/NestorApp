/**
 * ADR-739 Φάση Γ — **hit-test + όρια** του `TableEntity` (ένα SSoT, τρεις καταναλωτές).
 *
 * Το ΕΝΑ σημείο όπου συμφωνούν οι τρεις διαδρομές επιλογής, ώστε ο πίνακας να μην
 * ζωγραφίζεται σε μια θέση και να πιάνεται σε άλλη (N.18, το μοτίβο του
 * `scale-bar-hit.ts`):
 *   - `TableRenderer.hitTest`   — η ακριβής επιλογή του φύλλου
 *   - `performDetailedHitTest`  — η στενή φάση του χωρικού ευρετηρίου (hover/click)
 *   - `BoundsCalculator`        — η ευρεία φάση + το marquee
 *
 * ## Γιατί το κουτί και όχι το πλέγμα
 * Ένας πίνακας είναι **αδιαφανές αντικείμενο σελίδας**, όχι σύνολο γραμμών: το AutoCAD,
 * το Excel και η Figma επιλέγουν όλα με κλικ **μέσα** στο ορθογώνιο, όχι πάνω σε γραμμή.
 * Πικάρισμα μόνο στις γραμμές θα σήμαινε ότι ένας πίνακας χωρίς πλέγμα (το preset
 * `detailSheet` **δεν έχει** πλέγμα) θα ήταν κυριολεκτικά ανεπίλεκτος.
 *
 * `sceneUnits` προεπιλέγεται σε `'mm'` για τον ίδιο λόγο που το κάνει το `scale-bar-hit`:
 * η γεωμετρία του καμβά είναι κανονική-mm και οι καθαροί καλούντες ορίων δεν έχουν
 * ενεθειμένο σύστημα μονάδων.
 *
 * @module subapps/dxf-viewer/bim/table/table-entity-hit
 * @see bim/table/table-entity-geometry.ts — η παράγωγη γεωμετρία
 * @see bim/scale-bar/scale-bar-hit.ts — ο αδελφός που καθρεφτίζει
 */

import type { Point2D } from '../../rendering/types/Types';
import type { SceneUnits } from '../../utils/scene-units';
import type { TableEntity } from '../../types/table-entity';
import {
  computeTableEntityGeometryLive,
  tableWorldToFrame,
} from './table-entity-geometry';
// ADR-794 — ΕΝΑ όνομα ανά ΧΩΡΟ, ΠΟΤΕ ανά ΑΝΤΙΚΕΙΜΕΝΟ — δεν υπάρχει TableBBox στον Revit.
import type { Bbox } from '../../types/coordinate-space';

/**
 * Αληθές όταν ένα σημείο **σκηνής** πέφτει μέσα στο (στραμμένο) ορθογώνιο του πίνακα,
 * με περιθώριο `tolerance` σε μονάδες σκηνής.
 *
 * Η σύγκριση γίνεται στο **πλαίσιο** του πίνακα (μετά την αντίστροφη περιστροφή), οπότε
 * είναι μια απλή σύγκριση ορθογωνίου — δεν χρειάζεται πολυγωνικό test. Η ανοχή
 * μετατρέπεται σε sheet-mm με την ίδια γέφυρα που όλα τα υπόλοιπα χρησιμοποιούν.
 */
export function hitTestTable(
  entity: TableEntity,
  point: Point2D,
  tolerance: number,
  sceneUnits: SceneUnits = 'mm',
): boolean {
  const geometry = computeTableEntityGeometryLive(entity, sceneUnits);
  const { layout, mmToWorld } = geometry;
  if (layout.rows.length === 0 || layout.columns.length === 0) return false;

  const { u, v } = tableWorldToFrame(entity, point, mmToWorld);
  // Η ανοχή δίνεται σε μονάδες σκηνής· το πλαίσιο μετρά σε sheet-mm.
  const padMm = mmToWorld > 0 ? tolerance / mmToWorld : 0;

  return (
    u >= -padMm &&
    u <= layout.widthMm + padMm &&
    v >= -padMm &&
    v <= layout.heightMm + padMm
  );
}

/**
 * Το άξονο-ευθυγραμμισμένο κουτί του πίνακα σε μονάδες σκηνής (με την περιστροφή ήδη
 * διπλωμένη μέσα, γιατί προκύπτει από τις τέσσερις πραγματικές γωνίες). Αυτό βλέπει το
 * marquee και το χωρικό ευρετήριο.
 *
 * Άδειος πίνακας ⇒ εκφυλισμένο κουτί **στην άγκυρα**, όχι `null`: μια οντότητα χωρίς
 * γραμμές εξακολουθεί να υπάρχει στη σκηνή και πρέπει να μπορεί να επιλεγεί και να
 * σβηστεί — `null` θα την έκανε αόρατη σε κάθε εργαλείο επιλογής.
 */
export function calculateTableBounds(
  entity: TableEntity,
  padWorld = 0,
  sceneUnits: SceneUnits = 'mm',
): Bbox {
  const { bbox } = computeTableEntityGeometryLive(entity, sceneUnits);
  if (!Number.isFinite(bbox.minX) || !Number.isFinite(bbox.minY)) {
    const { x, y } = entity.position;
    return { minX: x - padWorld, minY: y - padWorld, maxX: x + padWorld, maxY: y + padWorld };
  }
  return {
    minX: bbox.minX - padWorld,
    minY: bbox.minY - padWorld,
    maxX: bbox.maxX + padWorld,
    maxY: bbox.maxY + padWorld,
  };
}
