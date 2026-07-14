/**
 * ADR-363 / ADR-436 — Rectangle grip ENGINE (SSoT resize transforms).
 *
 * The single home for the corner + edge-midpoint resize math shared by every
 * rectangular BIM entity (wall straight / column rect+shear-wall / foundation
 * pad). Pure geometry on a {@link RectFrame}: zero entity / unit / anchor
 * knowledge — the caller's adapter converts params ↔ frame (mm ↔ scene via
 * `mmScaleFor`) and re-applies entity semantics (anchor reference, dna/miter
 * clearing) after the transform.
 *
 * SEMANTICS (Revit / AutoCAD shape-handle parity — Giorgio 2026-06-10):
 *   - Corner drag → keep the OPPOSITE CORNER fixed. The dragged corner follows
 *     the cursor; both adjacent edges move; the opposite two edges hold.
 *   - Edge-midpoint drag → keep the OPPOSITE EDGE fixed. Only the dragged
 *     dimension changes; the other is untouched.
 * Both shift the centroid by the back-derived (post-clamp) half-displacement so
 * the held element never crosses its original position even when a dimension
 * hits its minimum. This replaces the previous per-entity "symmetric about the
 * anchor" edge resize with one consistent opposite-element-fixed model.
 *
 * Zero React / DOM / Firestore / canvas deps.
 *
 * @see rect-frame.ts — the frame type + corner/edge world-position readers
 * @see bim/grips/grip-math.ts — projectToLocalFrame / rotateVector SSoT (ADR-397)
 */

import type { Point2D } from '../../rendering/types/Types';
import { translatePoint } from '../../rendering/entities/shared/geometry-vector-utils';
import { projectToLocalFrame, rotateVector } from './grip-math';
import { constrainDeltaToDominantAxis } from './ortho-delta';
import type { RectFrame, RectCorner, RectEdge } from './rect-frame';

/** Per-axis minimum half-extents (scene units). Supplied by the entity adapter. */
export interface RectResizeLimits {
  readonly minHalfWidth: number;
  readonly minHalfLength: number;
}

/** Translate the centroid by a local-frame shift (rotated into world). */
function shiftCenter(frame: RectFrame, localShift: Point2D): Point2D {
  const w = rotateVector(localShift, frame.rotationDeg);
  return translatePoint(frame.center, w);
}

/**
 * ADR-654 — UNIFORM (aspect-locked) corner resize. Και οι δύο ημι-διαστάσεις
 * πολλαπλασιάζονται με τον ΙΔΙΟ συντελεστή, οπότε ο λόγος πλευρών διατηρείται ακριβώς
 * (Figma/Illustrator/PowerPoint: η γωνιακή λαβή μιας εικόνας δεν παραμορφώνει).
 *
 * Ο συντελεστής προκύπτει από τον **κυρίαρχο άξονα** — αυτόν που ο χρήστης έσυρε
 * περισσότερο αναλογικά — ώστε το κουτί να ακολουθεί την πρόθεση του κέρσορα και στους
 * δύο άξονες. Δεγενερή αρχική διάσταση (0) → δεν υπάρχει λόγος να διατηρηθεί, οπότε
 * επιστρέφουμε το ελεύθερο αποτέλεσμα.
 */
function lockAspectRatio(
  frame: RectFrame,
  halfWidth: number,
  halfLength: number,
  limits: RectResizeLimits,
): { halfWidth: number; halfLength: number } {
  if (frame.halfWidth <= 0 || frame.halfLength <= 0) return { halfWidth, halfLength };
  const widthScale = halfWidth / frame.halfWidth;
  const lengthScale = halfLength / frame.halfLength;
  const dominant = Math.abs(widthScale - 1) >= Math.abs(lengthScale - 1) ? widthScale : lengthScale;
  // Ο κοινός συντελεστής πρέπει να σέβεται ΚΑΙ ΤΑ ΔΥΟ minima (αλλιώς το κλείδωμα θα
  // μπορούσε να συρρικνώσει τη μία πλευρά κάτω από το όριό της).
  const minScale = Math.max(
    limits.minHalfWidth / frame.halfWidth,
    limits.minHalfLength / frame.halfLength,
  );
  const scale = Math.max(dominant, minScale);
  return { halfWidth: frame.halfWidth * scale, halfLength: frame.halfLength * scale };
}

/**
 * Corner drag — keep the opposite corner fixed. `worldDelta` is the cursor
 * displacement since drag start (scene units). The dragged corner tracks the
 * cursor 1:1; the opposite corner holds (exactly, even after a min clamp).
 *
 * `lockAspect` (ADR-654) → uniform scale: ο λόγος πλευρών διατηρείται (καμία
 * παραμόρφωση). Η αντίθετη γωνία μένει σταθερή ΚΑΙ στις δύο λειτουργίες.
 */
export function applyRectCornerDrag(
  frame: RectFrame,
  corner: RectCorner,
  worldDelta: Point2D,
  limits: RectResizeLimits,
  ortho?: boolean,
  lockAspect?: boolean,
): RectFrame {
  const projected = projectToLocalFrame(worldDelta, frame.rotationDeg);
  const local = ortho ? constrainDeltaToDominantAxis(projected) : projected;
  const freeHalfWidth = Math.max(limits.minHalfWidth, frame.halfWidth + (corner.sx * local.x) / 2);
  const freeHalfLength = Math.max(limits.minHalfLength, frame.halfLength + (corner.sy * local.y) / 2);
  const { halfWidth: newHalfWidth, halfLength: newHalfLength } = lockAspect
    ? lockAspectRatio(frame, freeHalfWidth, freeHalfLength, limits)
    : { halfWidth: freeHalfWidth, halfLength: freeHalfLength };
  // Back-derive the centroid shift from the CLAMPED half so the opposite corner
  // never crosses its original position (mirror wall `moveCorner` clamp recovery).
  const center = shiftCenter(frame, {
    x: corner.sx * (newHalfWidth - frame.halfWidth),
    y: corner.sy * (newHalfLength - frame.halfLength),
  });
  return { ...frame, center, halfWidth: newHalfWidth, halfLength: newHalfLength };
}

/**
 * Edge-midpoint drag — keep the opposite edge fixed. Only the dragged
 * dimension's half changes; the perpendicular dimension is untouched. The
 * dragged edge tracks the cursor 1:1; the opposite edge holds.
 */
export function applyRectEdgeDrag(
  frame: RectFrame,
  edge: RectEdge,
  worldDelta: Point2D,
  limits: RectResizeLimits,
): RectFrame {
  const local = projectToLocalFrame(worldDelta, frame.rotationDeg);
  if (edge.axis === 'x') {
    const newHalfWidth = Math.max(limits.minHalfWidth, frame.halfWidth + (edge.sign * local.x) / 2);
    const center = shiftCenter(frame, { x: edge.sign * (newHalfWidth - frame.halfWidth), y: 0 });
    return { ...frame, center, halfWidth: newHalfWidth };
  }
  const newHalfLength = Math.max(limits.minHalfLength, frame.halfLength + (edge.sign * local.y) / 2);
  const center = shiftCenter(frame, { x: 0, y: edge.sign * (newHalfLength - frame.halfLength) });
  return { ...frame, center, halfLength: newHalfLength };
}
