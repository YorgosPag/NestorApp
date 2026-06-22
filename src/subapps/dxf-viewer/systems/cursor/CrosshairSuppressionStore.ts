/**
 * ADR-513 — Crosshair suppression flag (zero-React singleton SSoT).
 *
 * Όταν ο κέρσορας μπαίνει στην περιοχή των πλήκτρων του «Δαχτυλιδιού Εντολών» (NavWheel,
 * zone `inside` → γίνεται βελάκι), το σχεδιαστικό **σταυρόνημα** (`CrosshairOverlay`) πρέπει να
 * **εξαφανίζεται εντελώς** (απόφαση Giorgio). Αντί να συζευχθεί ο ring με τον crosshair renderer,
 * περνά από αυτό το ΕΝΑ flag: ο ring το γράφει, ο `CrosshairOverlay` το διαβάζει στο `applyTransform`
 * (event-time) + subscribe για άμεσο re-apply όταν αλλάζει χωρίς κίνηση ποντικιού.
 *
 * Pattern: `HoverStore` / `ImmediateTransformStore` (zero React state). ADR-040-safe.
 */

let _suppressed = false;
const _subs = new Set<() => void>();

/** True όταν κάποιο overlay (π.χ. το NavWheel) απαιτεί να κρυφτεί το σταυρόνημα. */
export function isCrosshairSuppressed(): boolean {
  return _suppressed;
}

/** Writer — καλείται από το overlay που «πιάνει» τον κέρσορα. No-op αν δεν αλλάζει. */
export function setCrosshairSuppressed(next: boolean): void {
  if (_suppressed === next) return;
  _suppressed = next;
  for (const cb of _subs) cb();
}

/** Subscribe σε αλλαγές (ώστε ο crosshair να ξανα-εφαρμόσει ακόμη κι αν δεν κουνηθεί το ποντίκι). */
export function subscribeCrosshairSuppression(cb: () => void): () => void {
  _subs.add(cb);
  return () => { _subs.delete(cb); };
}
