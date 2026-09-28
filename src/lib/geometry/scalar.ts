/**
 * =============================================================================
 * SCALAR MATH (SSoT) — καθαρή, ΧΩΡΙΣ καμία εισαγωγή
 * =============================================================================
 *
 * Η **μία** οικογένεια `clamp` (ADR-071). Ζούσε στο `subapps/dxf-viewer/utils/scalar-math.ts`, που **επανεξάγει** πλέον
 * από εδώ (ίδιο πρότυπο με το `lib/geometry/angle.ts`, ADR-884 §4.8): ο θεατής περιήγησης τρέχει στη **δημόσια** αγγελία
 * και δεν επιτρέπεται να εισάγει από το subapp (CHECK 3.62), άρα τα αρχεία έξω από αυτό έγραφαν **τοπικά** αντίγραφα
 * (ADR-884 Φ2στ-γ · §4.14 — βρέθηκαν επτά· καταγραφή στο `.claude-rules/pending-ratchet-work.md`).
 *
 * ⚠️ **ΜΗΝ προσθέσεις εισαγωγή εδώ.** Η αξία του αρχείου είναι ότι δεν σέρνει τίποτα.
 *
 * @module lib/geometry/scalar
 */

/**
 * Περιορισμός στο `[min, max]`.
 * @example clamp(150, 0, 100) // → 100
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Περιορισμός στο `[0, 1]` (αδιαφάνεια · ποσοστό · παράμετρος t). */
export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/** Περιορισμός στο `[0, 255]` (συνιστώσες RGB). */
export function clamp255(value: number): number {
  return Math.max(0, Math.min(255, value));
}
