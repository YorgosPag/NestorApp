'use client';

/**
 * @fileoverview **«Έφτασε κοντά στην οθόνη;»** — ΜΙΑ φορά, και μένει `true`.
 * @related ADR-777 §8.70 (Φάση 2)
 * @module hooks/useNearViewport
 *
 * 🔑 **Μανδαλωμένο, επίτηδες.** Ο καταναλωτής ρωτά «αξίζει να ξεκινήσω ακριβή δουλειά;» (λήψη,
 * απόδοση χάρτη), όχι «φαίνεται αυτή τη στιγμή;». Ένα hook που γυρνά σε `false` όταν η κάρτα
 * κυλά έξω θα ακύρωνε δουλειά μισοτελειωμένη και θα την ξανάρχιζε — το αντίθετο του lazy.
 *
 * ⚠️ **Ref callback, όχι `RefObject`**: ο παρατηρητής δένεται τη στιγμή που **υπάρχει** κόμβος.
 * Με `RefObject` + `useEffect([ref])` (το σχήμα του `dxf-viewer/utils/performance.ts#useInView`)
 * ένας κόμβος που εμφανίζεται μετά την πρώτη απόδοση δεν παρατηρείται ποτέ.
 *
 * ⚠️ Περιβάλλον χωρίς `IntersectionObserver` (παλιός περιηγητής, jsdom) ⇒ `true` αμέσως: η
 * δουλειά γίνεται νωρίτερα, ποτέ δεν χάνεται.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

/** Πόσο πριν μπει στην οθόνη ξεκινά η δουλειά — ώστε να είναι έτοιμη όταν φτάσει ο αντίχειρας. */
export const NEAR_VIEWPORT_MARGIN = '200px';

export function useNearViewport<T extends Element>(): readonly [(node: T | null) => void, boolean] {
  const [near, setNear] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const disconnect = useCallback((): void => {
    observerRef.current?.disconnect();
    observerRef.current = null;
  }, []);

  const ref = useCallback(
    (node: T | null): void => {
      disconnect();
      if (node === null || near) return;
      if (typeof IntersectionObserver === 'undefined') {
        setNear(true);
        return;
      }
      const observer = new IntersectionObserver(
        (entries) => {
          if (!entries.some((entry) => entry.isIntersecting)) return;
          setNear(true);
          observer.disconnect();
        },
        { rootMargin: NEAR_VIEWPORT_MARGIN },
      );
      observer.observe(node);
      observerRef.current = observer;
    },
    [disconnect, near],
  );

  useEffect(() => disconnect, [disconnect]);

  return [ref, near] as const;
}
