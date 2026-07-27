/**
 * RadialCommandRing — pure helpers (predicates + inline style builders).
 *
 * Εξήχθησαν από το `RadialCommandRing.tsx` (file-size SRP, N.7.1, 2026-07-06): stateless
 * predicates (heads-up numeric key) + inline cursor-follow/anchor style builders. Testable
 * χωρίς DOM/React· το component τα καταναλώνει, δεν κρατούν state.
 *
 * ⚠️ **ADR-711 §5.6 (2026-07-27)** — εδώ ζούσε δεύτερο `isEditableTarget` με **ίδιο όνομα
 * και άλλο σώμα** από το SSoT (`@/lib/a11y/keyboard-scope`): πρόσθετε `SELECT`, έχανε το
 * `contenteditable=""`. Έφυγε. Το δαχτυλίδι ρωτά πλέον την **ερώτηση 2**
 * (`focusConsumesTypedCharacters`) — «θα καταναλώσει κάποιος άλλος τον χαρακτήρα;» — που
 * είναι η σωστή ερώτηση όταν κλέβεις ψηφίο. **Μην ξαναγράψεις τοπικό predicate εδώ**:
 * το κενό που έκλεισε ήταν το canonical Radix dropdown (`<button role="combobox">`), που
 * ένας έλεγχος `tagName` δεν μπορεί να δει.
 *
 * @see ./RadialCommandRing — the consuming component
 * @see ADR-513 — Δαχτυλίδι Εντολών
 * @see src/lib/a11y/keyboard-scope.ts — οι δύο ερωτήσεις
 */

import type React from 'react';
import { portalComponents } from '@/styles/design-tokens';

/**
 * ADR-513 §direct-distance-entry — pure predicate: ένα πλήκτρο ενεργοποιεί το heads-up άνοιγμα του
 * «Μήκος» (AutoCAD direct distance entry). Δεκτά: ψηφία 0-9, δεκαδικό (`.`/`,`), πρόσημο (`-`) —
 * ΧΩΡΙΣ ctrl/alt/meta (ώστε shortcuts όπως Ctrl+1 να μην κλέβονται). Testable χωρίς DOM.
 */
export function isHeadsUpNumericKey(
  e: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'altKey' | 'metaKey'>,
): boolean {
  if (e.ctrlKey || e.altKey || e.metaKey) return false;
  return /^[0-9.,-]$/.test(e.key);
}

/** Inline cursor-follow box (px). Κεντραρισμένο στο δαχτυλίδι. */
export function boxStyle(x: number, y: number, box: number): React.CSSProperties {
  return {
    left: `${x}px`,
    top: `${y}px`,
    width: `${box}px`,
    height: `${box}px`,
    zIndex: portalComponents.overlay.controls.zIndex() + 90,
  };
}

/** Θέση popup στο anchor του wedge (px εντός του box). */
export function anchorStyle(x: number, y: number): React.CSSProperties {
  return { left: `${x}px`, top: `${y}px` };
}
