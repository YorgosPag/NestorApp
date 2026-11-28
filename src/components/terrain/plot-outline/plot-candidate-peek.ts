'use client';

/**
 * @fileoverview **Το εφήμερο «ποιο υποψήφιο κοιτάζω» ΕΞΩ από το δέντρο της καρτέλας** (ADR-920 §14.11 Ζ4 — αμφίδρομη επισήμανση).
 * @related lib/state/createExternalStore (το ΕΝΑ pub/sub) · lib/listings/listing-focus (το λεξιλόγιο εφήμερο ≠ επίμονο, ADR-777) ·
 *   components/catalog/imports/review-hover-store (το ίδιο σχήμα, ADR-923) · hooks/listings/usePlotDrawingImport (ο ιδιοκτήτης)
 * @module components/terrain/plot-outline/plot-candidate-peek
 *
 * 🔴 **Γιατί δεν είναι `useState`** (μετρημένο στην παραγωγή 2026-11-28, `long-animation-frame`): ως state του hook κάθε κίνηση
 *    του δείκτη ξανα-απέδιδε ΟΛΗ την καρτέλα — κάρτα κατάστασης, ανάγλυφο, γεωαναφορά, το σχέδιο με όλες τις γραμμές του και
 *    65 κάρτες ⇒ 53–88 ms ανά hover, ~12 fps προ-τονισμός.
 * 🔑 **Σχήμα micro-leaf (ADR-040)**: μόνο τα φύλλα ρωτούν `useSyncExternalStore`. Κάρτα και σχήμα ρωτούν **boolean** («εγώ;») ⇒
 *    μια κίνηση ξαναζωγραφίζει ΜΟΝΟ το παλιό και το νέο· τη ΜΙΑ ταυτότητα τη ρωτούν μόνο η στρώση έμφασης και η γραμμή κατάστασης.
 * 🔑 Ένα store **ανά εισαγωγή** (όχι καθολικό): δύο καρτέλες δεν μοιράζονται δείκτη, και κάθε test ξεκινά καθαρό.
 */

import { useCallback, useSyncExternalStore } from 'react';

import { createExternalStore, type ExternalStore } from '@/lib/state/createExternalStore';

/** Το εφήμερο υποψήφιο — `null` = τίποτα κάτω από τον δείκτη/την εστίαση. Ίδια τιμή ⇒ καμία ειδοποίηση. */
export type PlotCandidatePeek = Pick<ExternalStore<string | null>, 'get' | 'set' | 'subscribe'>;

export function createPlotCandidatePeek(): PlotCandidatePeek {
  const { get, set, subscribe } = createExternalStore<string | null>(null, { equals: Object.is });
  return { get, set, subscribe };
}

const nothing = () => null;

/** Ποιο υποψήφιο κοιτάζει ο άνθρωπος — για όποιον δείχνει ΤΟ ΙΔΙΟ το εφήμερο (στρώση έμφασης · γραμμή κατάστασης). */
export function usePlotCandidatePeekedId(peek: PlotCandidatePeek): string | null {
  return useSyncExternalStore(peek.subscribe, peek.get, nothing);
}

/** Κοιτάζει ΑΥΤΟ; Boolean ⇒ ξαναζωγραφίζει μόνο όταν αλλάξει η απάντηση. */
export function usePlotCandidateIsPeeked(peek: PlotCandidatePeek, candidateId: string): boolean {
  const snapshot = useCallback(() => peek.get() === candidateId, [peek, candidateId]);
  return useSyncExternalStore(peek.subscribe, snapshot, () => false);
}
