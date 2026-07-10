/**
 * ADR-513 §rectangle — Rectangle dynamic-input lock geometry (SSoT, preview ≡ commit).
 *
 * Mirror του `applyLengthAngleLock` για το εργαλείο «Ορθογώνιο». Το ορθογώνιο ορίζεται από
 * corner1 (1ο κλικ = AutoCAD anchor) + πλάτος/ύψος στους ΤΟΠΙΚΟΥΣ (περιστραμμένους κατά
 * `angle`) άξονες. Απόφαση A (locked νικά): κλειδωμένη πλευρά → σταθερό μέγεθος, μόνο το
 * πρόσημο/τεταρτημόριο έρχεται από το ποντίκι· μη-κλειδωμένη πλευρά → προβολή του cursor.
 *
 * Καλείται ΚΑΙ στο preview ΚΑΙ στο commit μέσω του ΙΔΙΟΥ builder branch (drawing-entity-builders)
 * → μηδέν WYSIWYG απόκλιση. No-lock → `corner2 = cursor, rotation = 0` (σημερινή συμπεριφορά).
 *
 * Zero React / DOM dependencies — fully unit-testable.
 *
 * @see ./RectLockStore.ts — η πηγή των locked width/height/angle
 * @see ./length-angle-lock.ts — το αντίστοιχο pattern της Γραμμής (polar length+angle)
 */

import type { Point2D } from '../../rendering/types/Types';
import { degToRad } from '../../rendering/entities/shared/geometry-angle-utils';
import { RectLockStore, type RectLockState } from './RectLockStore';

/** Πρόσημο του `v`, με 0 → +1 (προεπιλογή θετικό τεταρτημόριο όταν ο cursor είναι πάνω στον άξονα). */
function signOrPlus(v: number): number {
  return v < 0 ? -1 : 1;
}

/**
 * Παράγει την απέναντι γωνία (τοπικό frame) + rotation, σεβόμενο τα locks.
 *
 * @param corner1  1ο κλικ (anchor / pivot περιστροφής)
 * @param cursor   τρέχον σημείο ποντικιού ή 2ο κλικ (world)
 * @param locks    ενεργά locks (width/height σε scene units, angle σε μοίρες)
 * @returns `corner2` = axis-aligned απέναντι γωνία στο ΤΟΠΙΚΟ frame + `rotation` (μοίρες)
 */
export function applyRectLock(
  corner1: Readonly<Point2D>,
  cursor: Readonly<Point2D>,
  locks: Readonly<RectLockState>,
): { corner2: Point2D; rotation: number } {
  const theta = locks.angle ?? 0;
  const rad = degToRad(theta);
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  // Cursor στους τοπικούς (περιστραμμένους) άξονες σχετικά με corner1.
  const dx = cursor.x - corner1.x;
  const dy = cursor.y - corner1.y;
  const pw = dx * cos + dy * sin;   // προβολή στον τοπικό +X (πλάτος)
  const ph = -dx * sin + dy * cos;  // προβολή στον τοπικό +Y (ύψος)

  // locked → σταθερό μέγεθος, πρόσημο από cursor· free → πλήρης προβολή cursor.
  const w = locks.width != null ? signOrPlus(pw) * locks.width : pw;
  const h = locks.height != null ? signOrPlus(ph) * locks.height : ph;

  return {
    corner2: { x: corner1.x + w, y: corner1.y + h },
    rotation: theta,
  };
}

/**
 * Thin wrapper που διαβάζει το ζωντανό `RectLockStore` — το ΜΟΝΑΔΙΚΟ σημείο γέννησης
 * corner2/rotation του εργαλείου «Ορθογώνιο» (N.18: ένα build, preview ≡ commit).
 */
export function buildRectangleCornersFromLock(
  corner1: Readonly<Point2D>,
  cursor: Readonly<Point2D>,
): { corner2: Point2D; rotation: number } {
  return applyRectLock(corner1, cursor, RectLockStore.getLocked());
}
