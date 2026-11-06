'use client';

/**
 * **Το ένα ζουμ ενός εγγράφου, όπου κι αν μπει η μπάρα** (ADR-928 §5.25).
 *
 * Ο πάροχος κρατά **μία** μηχανή (`document-zoom-engine.ts`)· οι γλωσσικές στήλες δηλώνονται (`useDocumentZoomColumn`)
 * και η μπάρα (`DocumentZoomBar`) διαβάζει το στιγμιότυπο — ώστε στον επεξεργαστή να ζει στην κεφαλίδα της στήλης
 * («Μόνο έγγραφο») και στη λεπτομέρεια πάνω από το έγγραφο, με **το ίδιο** ζουμ.
 * 🔑 Χωρίς πάροχο (παράθυρο «Προεπισκόπηση εγγράφου») ⇒ καμία μηχανή: σελίδα Α4 στο κέντρο, όπως πριν.
 */

import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode, type RefObject } from 'react';

// Προαιρετικό: η προτίμηση είναι ευκολία — χωρίς χρήστη (δεν φόρτωσε ακόμη) ισχύει η «Προσαρμογή», όχι σφάλμα.
import { useAuthOptional } from '@/auth/contexts/AuthContext';

import { createDocumentZoomEngine, type DocumentZoomEngine, type DocumentZoomSnapshot } from './document-zoom-engine';

const DocumentZoomContext = createContext<DocumentZoomEngine | null>(null);

export function DocumentZoomProvider({ children }: { readonly children: ReactNode }) {
  const [engine] = useState(createDocumentZoomEngine);
  const uid = useAuthOptional()?.user?.uid ?? null;
  // `useLayoutEffect`: η αποθηκευμένη προτίμηση εφαρμόζεται **πριν** ζωγραφιστεί η σελίδα — όχι αναλαμπή «Προσαρμογή → 150 %».
  useLayoutEffect(() => engine.bindUser(uid), [engine, uid]);
  useEffect(() => {
    const flush = () => engine.flush();
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [engine]);
  return <DocumentZoomContext.Provider value={engine}>{children}</DocumentZoomContext.Provider>;
}

/** `null` ⇒ έγγραφο χωρίς ζουμ (καμία μηχανή πάνω του). */
export function useDocumentZoomEngine(): DocumentZoomEngine | null {
  return useContext(DocumentZoomContext);
}

const STATIC_SNAPSHOT: DocumentZoomSnapshot = { zoom: 1, fitted: true };
const noopSubscribe = () => () => undefined;

export function useDocumentZoomSnapshot(engine: DocumentZoomEngine | null): DocumentZoomSnapshot {
  return useSyncExternalStore(
    engine?.subscribe ?? noopSubscribe,
    engine?.getSnapshot ?? (() => STATIC_SNAPSHOT),
    () => STATIC_SNAPSHOT,
  );
}

export interface DocumentZoomColumn {
  /** `true` ⇒ η σελίδα ανήκει στη μηχανή (πλάτος/ζουμ από εκεί)· `false` ⇒ στατική σελίδα Α4. */
  readonly zoomable: boolean;
  readonly frameRef: RefObject<HTMLDivElement | null>;
  readonly pageRef: RefObject<HTMLElement | null>;
}

/** Μία γλωσσική στήλη δηλώνεται στη μηχανή όσο είναι στην οθόνη. */
export function useDocumentZoomColumn(): DocumentZoomColumn {
  const engine = useDocumentZoomEngine();
  const frameRef = useRef<HTMLDivElement | null>(null);
  const pageRef = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    const frame = frameRef.current;
    const page = pageRef.current;
    if (!engine || !frame || !page) return;
    return engine.registerColumn(frame, page);
  }, [engine]);
  return { zoomable: engine !== null, frameRef, pageRef };
}
