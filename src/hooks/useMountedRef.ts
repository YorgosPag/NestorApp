'use client';

/**
 * @fileoverview **SSoT: «ζει ακόμα το component;» — για ασύγχρονη εργασία που τελειώνει μετά το unmount.**
 * @module hooks/useMountedRef
 * @related ADR-598 «(η)» · `hooks/useFormSubmission`
 *
 * Μετρημένο 2026-09-22: το ζεύγος `mounted.current = true / false` σε `useEffect` ήταν γραμμένο
 * με το χέρι σε **18** αρχεία. Επιστρέφει `ref` (όχι state): διαβάζεται σύγχρονα μέσα σε
 * `await`-συνέχειες χωρίς να προκαλεί render. Το `true` ξαναγράφεται στο mount ώστε το
 * StrictMode (mount → unmount → mount στο dev) να μην αφήνει ψευδές `false`.
 */

import { useEffect, useRef, type MutableRefObject } from 'react';

export function useMountedRef(): MutableRefObject<boolean> {
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  return mounted;
}
