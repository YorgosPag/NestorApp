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
 * Notify plumbing delegated to the SSoT `createExternalStore` primitive.
 */

import { createExternalStore } from '../../stores/createExternalStore';

// `equals: Object.is` reproduces the old `if (_suppressed === next) return` no-op.
const store = createExternalStore<boolean>(false, { equals: Object.is });

/** True όταν κάποιο overlay (π.χ. το NavWheel) απαιτεί να κρυφτεί το σταυρόνημα. */
export function isCrosshairSuppressed(): boolean {
  return store.get();
}

/** Writer — καλείται από το overlay που «πιάνει» τον κέρσορα. No-op αν δεν αλλάζει. */
export function setCrosshairSuppressed(next: boolean): void {
  store.set(next);
}

/** Subscribe σε αλλαγές (ώστε ο crosshair να ξανα-εφαρμόσει ακόμη κι αν δεν κουνηθεί το ποντίκι). */
export function subscribeCrosshairSuppression(cb: () => void): () => void {
  return store.subscribe(cb);
}
