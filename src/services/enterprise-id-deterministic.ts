/**
 * ENTERPRISE ID — DETERMINISTIC UUID SUFFIX (ADR-632 Φ5)
 *
 * Pure, dependency-free helper extracted from `enterprise-id-class.ts` to keep
 * that file under the 500-line SRP limit (N.7.1). No `crypto`, no state — a
 * synchronous public-domain 128-bit string hash (cyrb128), so it stays a leaf
 * in the import graph exactly like the class file that consumes it.
 *
 * @module services/enterprise-id-deterministic
 */

/**
 * DETERMINISTIC UUID-shaped suffix από σταθερό `seed` (cyrb128 — synchronous,
 * public-domain 128-bit string hash· browser+node safe, μηδέν crypto).
 * Ίδιο seed → ίδιο suffix → **σταθερό** enterprise id για derived/managed
 * οντότητες που ξανα-δημιουργούνται idempotent (π.χ. auto stairwell opening ανά
 * (stair, slab)), ώστε undo→redo να ΜΗΝ αλλάζει doc id (μηδέν Firestore churn).
 * ΔΕΝ είναι κρυπτογραφικό — μόνο για σταθερή ταυτότητα, όχι security.
 */
export function deterministicUuid(seed: string): string {
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
  for (let i = 0; i < seed.length; i++) {
    const k = seed.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  const hx = (n: number) => (n >>> 0).toString(16).padStart(8, '0');
  const h = hx(h1) + hx(h2) + hx(h3) + hx(h4); // 32 hex chars (128-bit)
  // RFC-4122-shaped: version nibble '5' (name-based) + variant '8' — «μοιάζει» enterprise uuid.
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
