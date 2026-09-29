'use client';

/**
 * @fileoverview **ΤΑ ΔΕΔΟΜΕΝΑ ΤΗΣ ΟΘΟΝΗΣ ΤΟΠΟΘΕΤΗΣΗΣ** — ο γράφος (συνεδρία θέασης του υπευθύνου) + όλες οι λήψεις
 * (`GET …/captures`) (ADR-884 Φ2δ · §4.10).
 * @related `services/spatial-tour/spatial-tour-viewing.client.ts` (`openTourViewSessionFromScreen`) ·
 *   `services/spatial-tour/spatial-tour.client.ts` (`listTourCapturesFromScreen`) · `useTourEditorActions.ts`
 * @module components/spatial-tour/editor/useTourEditorData
 *
 * 🔑 **Καμία νέα διαδρομή ανάγνωσης**: η συνεδρία του υπευθύνου δίνει τον γράφο **και** το κουπόνι μέσων για ΟΛΗ την
 * περιήγηση (άρα και για ατοποθέτητες λήψεις)· οι λήψεις έρχονται από τα εισερχόμενα που υπάρχουν ήδη.
 * 🔑 **Η νεότερη φόρτωση κερδίζει** (αύξων αριθμός): δύο αλλαγές στη σειρά ⇒ η απάντηση της πρώτης δεν σβήνει τη δεύτερη.
 * 🔑 Το κουπόνι λήγει σε 15′ ⇒ ανανέωση κάθε {@link TOUR_VIEW_RENEW_EVERY_MS}, όπως η επιφάνεια θέασης.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { useInterval } from '@/hooks/useInterval';
import type { TourViewerLevel } from '@/lib/spatial-tour/viewer/tour-viewer-graph';
import { listTourCapturesFromScreen } from '@/services/spatial-tour/spatial-tour.client';
import { openTourViewSessionFromScreen } from '@/services/spatial-tour/spatial-tour-viewing.client';
import type { TourCapture, TourNode, TourSubject } from '@/types/spatial-tour';

import { TOUR_VIEW_RENEW_EVERY_MS } from '../TourViewSurface';

export interface TourEditorData {
  readonly nodes: readonly TourNode[];
  readonly levels: readonly TourViewerLevel[];
  readonly captures: readonly TourCapture[];
}

export type TourEditorLoad =
  | { readonly kind: 'loading' }
  | { readonly kind: 'loaded'; readonly data: TourEditorData }
  | { readonly kind: 'failed' };

export interface TourEditorDataHandle {
  readonly load: TourEditorLoad;
  readonly reload: () => Promise<void>;
  /**
   * **Ρολόι** (ανανέωση κουπονιού · «ετοιμάζεται ξανά»): φορτώνει **μόνο αν καμία φόρτωση δεν εκκρεμεί**. Με το «νεότερη κερδίζει»
   * ένα ρολόι πιο γρήγορο από τον διακομιστή πετούσε **κάθε** απάντηση — η οθόνη δεν ενημερωνόταν ποτέ όσο ο διακομιστής αργούσε,
   * δηλαδή ακριβώς όσο ψήνει (ζωντανή «Εφαρμογή», §4.15 ζ3). Οι φορτώσεις μετά από εντολή μένουν `reload` (κερδίζουν).
   */
  readonly poll: () => void;
  /**
   * Αισιόδοξη αντικατάσταση του γράφου (κόμβοι **και** όροφοι με τα σχήματα χώρων, Γ3γ-1) — η επόμενη φόρτωση φέρνει την
   * αλήθεια του διακομιστή.
   */
  readonly setGraph: (graph: TourEditorGraphData) => void;
}

/** Ο γράφος της οθόνης — ό,τι αλλάζει μια εντολή (οι λήψεις αλλάζουν μόνο με φόρτωση). */
export type TourEditorGraphData = Pick<TourEditorData, 'nodes' | 'levels'>;

export function useTourEditorData(subject: TourSubject): TourEditorDataHandle {
  const [load, setLoad] = useState<TourEditorLoad>({ kind: 'loading' });
  const sequence = useRef(0);
  const inFlight = useRef(0);
  const reload = useCallback(async () => {
    const mine = ++sequence.current;
    inFlight.current += 1;
    try {
      const [session, captures] = await Promise.all([
        openTourViewSessionFromScreen(subject, { signedIn: true, shareId: null }),
        listTourCapturesFromScreen(subject),
      ]);
      if (mine !== sequence.current) return;
      if (session.kind !== 'ok' || captures.kind !== 'ok') return setLoad({ kind: 'failed' });
      const { nodes, levels } = session.value.manifest;
      setLoad({ kind: 'loaded', data: { nodes, levels, captures: captures.value.captures } });
    } finally {
      inFlight.current -= 1;
    }
  }, [subject]);
  const poll = useCallback(() => { if (inFlight.current === 0) void reload(); }, [reload]);
  const setGraph = useCallback(({ nodes, levels }: TourEditorGraphData) => {
    setLoad((prev) => (prev.kind === 'loaded' ? { kind: 'loaded', data: { ...prev.data, nodes, levels } } : prev));
  }, []);
  useEffect(() => { void reload(); }, [reload]);
  useInterval(poll, TOUR_VIEW_RENEW_EVERY_MS);
  return { load, reload, poll, setGraph };
}
