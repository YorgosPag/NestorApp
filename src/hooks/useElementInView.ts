'use client';

/**
 * @fileoverview **Είναι αυτό το στοιχείο στην οθόνη τώρα;** — ένας `IntersectionObserver`, ένα boolean.
 * @module hooks/useElementInView
 *
 * 🔑 **Callback ref, όχι `RefObject`**: ο παρατηρητής δένεται όταν το στοιχείο **μπει** στο DOM και λύνεται όταν
 * φύγει — ακόμη κι αν εμφανιστεί αργότερα από την πρώτη απόδοση. Ένα `useEffect([ref])` θα έχανε αυτή τη στιγμή.
 *
 * 🔑 **Χωρίς `IntersectionObserver` (παλιός browser, jsdom) ⇒ `false`**: ο καταναλωτής πρέπει να δείχνει το
 * εφεδρικό του (π.χ. την κάτω μπάρα), ποτέ να κρύβει πληροφορία επειδή δεν μπόρεσε να μετρήσει.
 */

import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

export interface ElementInView<T extends Element> {
  /** Δώσ' το ως `ref` στο στοιχείο που παρατηρείται. */
  readonly ref: (element: T | null) => void;
  readonly inView: boolean;
  /** Το στοιχείο που παρατηρείται τώρα — για πράξεις τη στιγμή του συμβάντος (π.χ. `scrollIntoView`). */
  readonly element: React.RefObject<T | null>;
}

export function useElementInView<T extends Element>(): ElementInView<T> {
  const [inView, setInView] = useState(false);
  const observer = useRef<IntersectionObserver | null>(null);
  const current = useRef<T | null>(null);

  const ref = useCallback((element: T | null) => {
    current.current = element;
    observer.current?.disconnect();
    observer.current = null;
    if (element === null || typeof IntersectionObserver === 'undefined') {
      setInView(false);
      return;
    }
    const next = new IntersectionObserver((entries) => {
      const entry = entries[entries.length - 1];
      if (entry !== undefined) setInView(entry.isIntersecting);
    });
    next.observe(element);
    observer.current = next;
  }, []);

  useEffect(() => () => observer.current?.disconnect(), []);

  return { ref, inView, element: current };
}
