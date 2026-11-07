'use client';

/**
 * ADR-923 §5.15.2 (Θ.2α-2) — **Η σελίδα στη διεύθυνση**: `#page=N`, η σύνταξη των Adobe PDF open parameters που
 * καταλαβαίνουν Acrobat, Chrome και Firefox. Βαθύς σύνδεσμος, ανανέωση, QR του εντύπου (Θ.4) ⇒ ανοίγει στη σελίδα.
 *
 * 🔑 Γραφή με `replaceUrlFragment` (`url-query-state`): χωρίς πλοήγηση, χωρίς νέα εγγραφή ιστορικού (το ξεφύλλισμα
 *    300 σελίδων δεν γεμίζει το «πίσω»), με το `history.state` του App Router αυτούσιο.
 * 🔑 Fragment, όχι query: δεν φτάνει ποτέ στον διακομιστή ⇒ η σελίδα δεν αλλάζει την κρυφή μνήμη ούτε το κλειδί της
 *    βιτρίνας, και ο σύνδεσμος μένει ο ίδιος για κάθε θεατή.
 * 🔑 Χωρίς «αναλαμπή»: όταν ο θεατής υιοθετεί σελίδα από τη διεύθυνση, **δεν** ξαναγράφει τη σελίδα 1 στο ενδιάμεσο
 *    render (`pendingRef`) — αλλιώς ο σύνδεσμος `#page=85` θα γινόταν στιγμιαία `#page=1`.
 *
 * @module components/file-manager/usePdfPageInUrl
 */

import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react';

import { replaceUrlFragment } from '@/lib/url-query-state';

import type { PdfState } from './pdf-canvas-config';

/** `#page=3` · `page=3` · `#page=3&zoom=200` ⇒ 3. Οτιδήποτε άλλο (ή < 1) ⇒ `null`. */
export function pdfPageFromFragment(fragment: string): number | null {
  const body = fragment.startsWith('#') ? fragment.slice(1) : fragment;
  if (body === '') return null;
  const raw = new URLSearchParams(body).get('page');
  if (raw === null || !/^\d+$/.test(raw)) return null;
  const page = Number(raw);
  return Number.isSafeInteger(page) && page >= 1 ? page : null;
}

/** Η σελίδα → το fragment της (χωρίς `#`). Ο ΕΝΑΣ συντάκτης — και για τους εσωτερικούς συνδέσμους. */
export function pdfPageFragment(page: number): string {
  return `page=${page}`;
}

/**
 * Υιοθετεί τη σελίδα της διεύθυνσης όταν φορτώσει το έγγραφο (και σε `hashchange`), και γράφει κάθε αλλαγή σελίδας πίσω.
 * `enabled = false` ⇒ καμία ανάγνωση, καμία εγγραφή (η σημερινή συμπεριφορά).
 */
export function usePdfPageInUrl(enabled: boolean, state: PdfState, setState: Dispatch<SetStateAction<PdfState>>): void {
  const pendingRef = useRef<number | null>(null);
  const ready = enabled && !state.loading && state.numPages > 0;
  const { numPages, currentPage } = state;

  useEffect(() => {
    if (!ready) return;
    const adopt = () => {
      const wanted = pdfPageFromFragment(window.location.hash);
      if (wanted === null) return;
      const page = Math.min(wanted, numPages);
      pendingRef.current = page;
      setState((s) => (s.currentPage === page ? s : { ...s, currentPage: page }));
    };
    adopt();
    window.addEventListener('hashchange', adopt);
    return () => window.removeEventListener('hashchange', adopt);
  }, [ready, numPages, setState]);

  useEffect(() => {
    if (!ready) return;
    const pending = pendingRef.current;
    if (pending !== null) {
      if (currentPage !== pending) return;
      pendingRef.current = null;
    }
    if (pdfPageFromFragment(window.location.hash) !== currentPage) replaceUrlFragment(pdfPageFragment(currentPage));
  }, [ready, currentPage]);
}
