'use client';

/**
 * @fileoverview **ΚΛΕΙΣΜΕΝΗ ΧΕΙΡΟΝΟΜΙΑ ΔΕΝ ΞΑΝΑΝΟΙΓΕΙ** — ADR-332 D27 Β13.
 * @related components/shared/addresses/pin-drop (`PinDrop.gesture`, `nextPinGesture`)
 *
 * 🔑 Ο διάλογος συρσίματος ανοίγει **αμέσως** (`pending`, Google «Dropped pin») και η ίδια
 * χειρονομία ξαναφτάνει όταν απαντήσει η μηχανή. Αν στο μεταξύ ο άνθρωπος πάτησε «Μόνο η θέση» ή
 * «Ακύρωση», η καθυστερημένη απάντηση **δεν επιτρέπεται** να ξανανοίξει τον διάλογο.
 *
 * ⚠️ Δεν χρειάζεται σύγκριση «νεότερη από την ανοιχτή»: ο χάρτης ακυρώνει την ερώτηση κάθε
 * παλιότερης χειρονομίας και **δεν** την παραδίδει ποτέ (`useAddressMapGeocoding.handleDragEnd`).
 * Η σειρά άφιξης είναι επομένως ήδη η σειρά των χειρονομιών.
 *
 * Ένας φύλακας, δύο παραλήπτες: ο διάλογος του editor (`useAddressEditorDrag`) και ο διάλογος
 * της προβολής έργου (`useLocationsDragRouting`).
 */

import { useCallback, useMemo, useRef } from 'react';
import type { PinDrop } from './pin-drop';

export interface PinDropGate {
  /** Δέχεται το σύρσιμο; — όχι αν η χειρονομία του έχει ήδη κλείσει. */
  readonly admits: (drop: PinDrop<unknown>) => boolean;
  /** Η χειρονομία έκλεισε (επιβεβαίωση · «Μόνο η θέση» · ακύρωση). */
  readonly settle: (drop: PinDrop<unknown> | null | undefined) => void;
}

export function usePinDropGate(): PinDropGate {
  const settledRef = useRef(0);
  const admits = useCallback((drop: PinDrop<unknown>) => drop.gesture > settledRef.current, []);
  const settle = useCallback((drop: PinDrop<unknown> | null | undefined) => {
    if (drop) settledRef.current = Math.max(settledRef.current, drop.gesture);
  }, []);
  return useMemo(() => ({ admits, settle }), [admits, settle]);
}
