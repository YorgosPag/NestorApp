import { useEffect, useRef } from 'react';
import { pushEscapeLayer } from '@/lib/a11y/escape-layers';

/**
 * Centralized hook for handling the Escape key outside the DXF viewer's command bus.
 *
 * ADR-364 §10.15.γ · ADR-241 — **λεπτό περιτύλιγμα** πάνω στη στοίβα `@/lib/a11y/escape-layers`:
 *   - καλείται **μόνο** όταν αυτή η στρώση είναι η **κορυφαία** (ο νεότερος νικά), και
 *   - **μόνο** αν κανείς εσώτερος δεν κατανάλωσε ήδη το πάτημα (Radix, slot του bus, πεδίο με δικό του «άκυρο»).
 *
 * 🔴 Ως 2026-09-11 ήταν ωμός listener `document` χωρίς έλεγχο `defaultPrevented` ⇒ **ένα** Esc σε Select / μενού /
 * διάλογο μέσα σε πλήρη οθόνη έκλεινε **και** τη στρώση **και** την πλήρη οθόνη (μετρημένο σε 4 καταναλωτές).
 *
 * ⚠️ Ο handler ζει σε ref και το effect εξαρτάται **μόνο** από `enabled` / `id`: οι καλούντες περνούν συχνά νέο
 * closure σε κάθε render (π.χ. `useEscapeKey(onClose)`), και μια νέα εγγραφή θα ανέβαζε τη στρώση στην **κορυφή**
 * της στοίβας — δηλαδή ένα re-render θα άλλαζε ποιος κατέχει το Escape. Ίδιο μοτίβο με το `useEscapeHandler` του bus.
 *
 * @param handler — called when Escape is pressed and this layer owns it
 * @param enabled — whether the layer is active (default: true)
 * @param id — stable owner id, reported to the ADR-364 audit (default: `hooks/use-escape-key`)
 */
export function useEscapeKey(handler: () => void, enabled = true, id = 'hooks/use-escape-key'): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!enabled) return undefined;
    return pushEscapeLayer({ id, onEscape: () => handlerRef.current() });
  }, [enabled, id]);
}
