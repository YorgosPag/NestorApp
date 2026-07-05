/**
 * column-rotation — pure SSoT for the column place+rotate 2nd-click orientation (ADR-508).
 *
 * Το 2ο κλικ της κολώνας ορίζει τον προσανατολισμό: η γωνία = κατεύθυνση από την κλειδωμένη θέση
 * (1ο κλικ) προς το σημείο του 2ου κλικ (CCW μοίρες, ίδια σύμβαση με `ColumnParams.rotation`).
 */

import type { Point2D } from '../../rendering/types/Types';
import { quantizeToStep } from '../../rendering/entities/shared/geometry-utils';

/** CCW μοίρες από `origin` προς `target`. 0 όταν συμπίπτουν (degenerate). */
export function columnRotationDeg(origin: Readonly<Point2D>, target: Readonly<Point2D>): number {
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  if (Math.hypot(dx, dy) < 1e-9) return 0;
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

/**
 * Zoom-adaptive βήμα γωνίας (μοίρες): λεπτό όταν μεγεθύνεις, χονδρό όταν σμικρύνεις — ώστε ο
 * χρήστης να έχει περισσότερη ακρίβεια από κοντά (ίδια φιλοσοφία με το `adaptiveDistanceStep`).
 * `worldPerPixel` = 1/scale.
 */
export function adaptiveRotationStepDeg(worldPerPixel: number): number {
  if (worldPerPixel <= 0.75) return 1;
  if (worldPerPixel <= 4) return 5;
  if (worldPerPixel <= 20) return 10;
  return 15;
}

/**
 * Τελική γωνία περιστροφής κολώνας (2ο κλικ): raw κατεύθυνση `origin→target` κουμπωμένη στο
 * zoom-adaptive βήμα. SSoT — ΙΔΙΑ τιμή σε preview + πορτοκαλί γραμμή + commit (preview ≡ commit).
 */
export function resolveColumnRotationDeg(
  origin: Readonly<Point2D>,
  target: Readonly<Point2D>,
  worldPerPixel: number,
): number {
  const step = adaptiveRotationStepDeg(worldPerPixel);
  return quantizeToStep(columnRotationDeg(origin, target), step);
}
