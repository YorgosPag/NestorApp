'use client';

/**
 * @fileoverview **ΤΟ Esc ΤΗΣ ΟΘΟΝΗΣ ΤΟΠΟΘΕΤΗΣΗΣ** — ένας ιδιοκτήτης (το `onEscapeKeyDown` του διαλόγου), που ρωτά πρώτα το εργαλείο
 * που είναι ενεργό (ADR-884 Φ2ζ ζ3 · §4.15).
 * @related `TourEditorDialog.tsx` (ο ιδιοκτήτης) · `redaction/TourRedactionOverlay.tsx` (ο πρώτος που δηλώνει) ·
 *   `spaces/TourSpacesWorkspace.tsx` (`useWorkspaceKeys` — το ίδιο μάθημα, Γ3γ-2β)
 * @module components/spatial-tour/editor/tour-editor-escape
 *
 * 🔑 **Γιατί όχι `stopPropagation` στο εργαλείο ή η στοίβα `escape-layers`**: ο Radix ακούει στη φάση **capture** του document —
 *   τρέχει ΠΡΙΝ από κάθε χειριστή του React **και** πριν τη στοίβα (που ακούει στο bubble και παραιτείται στο `defaultPrevented`).
 *   Μετρήθηκε στη Γ3γ-2β: Esc μέσα σε εργαλείο έκλεινε όλη την οθόνη. Άρα η απόφαση ζει στο `onEscapeKeyDown` του διαλόγου,
 *   και ο `TourEditor` (φορτωμένος με `next/dynamic` μέσα του) του μιλά μέσα από αυτό το context.
 * 🔑 **Ένα εργαλείο τη φορά**: η δήλωση αντικαθιστά την προηγούμενη και επιστρέφει την ακύρωσή της.
 */

import { createContext, useContext, useEffect, useMemo, useRef } from 'react';

/** `true` ⇒ το εργαλείο κατανάλωσε το Esc (ο διάλογος **δεν** κλείνει). */
export type TourEditorEscapeHandler = () => boolean;

export interface TourEditorEscape {
  /** Δήλωση του ενεργού εργαλείου· επιστρέφει την ακύρωση. */
  readonly claim: (handler: TourEditorEscapeHandler) => () => void;
  /** Για τον διάλογο: `true` αν κάποιο εργαλείο κατανάλωσε το πάτημα. */
  readonly consume: () => boolean;
}

export const TourEditorEscapeContext = createContext<TourEditorEscape | null>(null);

/** Ο ιδιοκτήτης (διάλογος): ένα κουτί για τον τρέχοντα χειριστή. */
export function useTourEditorEscapeOwner(): TourEditorEscape {
  const current = useRef<TourEditorEscapeHandler | null>(null);
  return useMemo(() => ({
    claim: (handler) => {
      current.current = handler;
      return () => { if (current.current === handler) current.current = null; };
    },
    consume: () => current.current?.() ?? false,
  }), []);
}

/** Το εργαλείο: δηλώνει τον χειριστή του όσο είναι `active` (ο χειριστής διαβάζεται τη στιγμή του πατήματος — getter, ADR-040). */
export function useTourEditorEscapeClaim(active: boolean, handler: TourEditorEscapeHandler): void {
  const escape = useContext(TourEditorEscapeContext);
  const latest = useRef(handler);
  latest.current = handler;
  useEffect(() => (active && escape !== null ? escape.claim(() => latest.current()) : undefined), [active, escape]);
}
