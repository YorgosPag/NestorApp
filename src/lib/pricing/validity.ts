/**
 * Χρονική ισχύς ως **ημιανοιχτό** διάστημα `[from, until)` σε ms· `null` = απεριόριστο άκρο
 * (ADR-923 §5.11). Ημιανοιχτό ώστε «έως 1/12» και «από 1/12» να **μην** επικαλύπτονται.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, μηδέν I/O.
 * @module lib/pricing/validity
 */

export interface ValidityWindow {
  readonly fromMs: number | null;
  readonly untilMs: number | null;
}

export type ValidityVerdict = 'valid' | 'notYetValid' | 'expired';

export function validityAt(window: ValidityWindow, atMs: number): ValidityVerdict {
  if (window.fromMs !== null && atMs < window.fromMs) return 'notYetValid';
  if (window.untilMs !== null && atMs >= window.untilMs) return 'expired';
  return 'valid';
}

/** `true` αν το διάστημα είναι κενό ή ανάποδο (`until ≤ from`). */
export function isEmptyWindow(window: ValidityWindow): boolean {
  return window.fromMs !== null && window.untilMs !== null && window.untilMs <= window.fromMs;
}

/** `true` αν δύο διαστήματα μοιράζονται έστω μία στιγμή. */
export function windowsOverlap(a: ValidityWindow, b: ValidityWindow): boolean {
  const aEndsBeforeB = a.untilMs !== null && b.fromMs !== null && a.untilMs <= b.fromMs;
  const bEndsBeforeA = b.untilMs !== null && a.fromMs !== null && b.untilMs <= a.fromMs;
  return !aEndsBeforeB && !bEndsBeforeA;
}
