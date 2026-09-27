/**
 * Pure easing math — η ΜΙΑ δήλωση των καμπυλών κίνησης (ADR-366 Phase 4.2 · §C.1.Q4).
 *
 * 🔑 Μετακόμισε από το `subapps/dxf-viewer/bim-3d/viewport/easing-functions.ts` (ADR-884 §4.8, 2026-09-27): ήταν ήδη
 * χωρίς εισαγωγές, αλλά ζούσε **πίσω από το σύνορο** του subapp (CHECK 3.62) — ο δημόσιος θεατής περιήγησης χρειάζεται
 * την ίδια καμπύλη με την κάμερα BIM. Το παλιό αρχείο **επανεξάγει** από εδώ· οι εισαγωγείς του μένουν αμετάβλητοι.
 * ⚠️ ΜΗΝ προσθέσεις εισαγωγή εδώ.
 *
 * @module lib/motion/easing
 */

/** Cubic ease-in-out. f(0)=0, f(0.5)=0.5, f(1)=1. A.4.Q1 canonical curve. */
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** Cubic ease-out — fast start, decelerates to stop. */
export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/** Cubic ease-in — slow start, accelerates to end. */
export function easeInCubic(t: number): number {
  return t * t * t;
}

/** Pass-through linear (no easing). */
export function easeLinear(t: number): number {
  return t;
}

// ---------------------------------------------------------------------------
// ADR-366 §C.1.Q4 — Animation easing extensions (4 additional presets)
// ---------------------------------------------------------------------------

/** Quartic ease-in — slower start than cubic, sharper acceleration. */
export function easeInQuart(t: number): number {
  return t * t * t * t;
}

/** Quartic ease-out — sharper deceleration than cubic. */
export function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - t, 4);
}

/** Smooth-step (Perlin/Hermite). Smoother than cubic ease-in-out, zero
 * 1st-derivative at endpoints. f(0)=0, f(1)=1, f(0.5)=0.5. */
export function smoothStep(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Elastic ease-out — spring-back oscillation past target then settles.
 * Standard Penner formula. f(0)=0, f(1)=1, overshoots in between. */
export function easeOutElastic(t: number): number {
  if (t === 0) return 0;
  if (t === 1) return 1;
  const c4 = (2 * Math.PI) / 3;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
}
