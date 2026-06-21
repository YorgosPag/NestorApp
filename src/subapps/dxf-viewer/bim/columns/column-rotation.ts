/**
 * column-rotation — pure SSoT for the column place+rotate 2nd-click orientation (ADR-508).
 *
 * Το 2ο κλικ της κολώνας ορίζει τον προσανατολισμό: η γωνία = κατεύθυνση από την κλειδωμένη θέση
 * (1ο κλικ) προς το σημείο του 2ου κλικ (CCW μοίρες, ίδια σύμβαση με `ColumnParams.rotation`).
 */

import type { Point2D } from '../../rendering/types/Types';

/** CCW μοίρες από `origin` προς `target`. 0 όταν συμπίπτουν (degenerate). */
export function columnRotationDeg(origin: Readonly<Point2D>, target: Readonly<Point2D>): number {
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  if (Math.hypot(dx, dy) < 1e-9) return 0;
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}
