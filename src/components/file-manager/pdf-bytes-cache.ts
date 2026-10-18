/**
 * ADR-912 §12.16 — **Τα bytes ενός PDF, μία φορά** — ώστε το «επόμενο αρχείο» του θεατή να είναι έτοιμο πριν πατηθεί.
 *
 * 🔑 **Γιατί μνήμη και όχι HTTP cache**: το PDF έρχεται από τον proxy `/api/download` ή από βραχύβια υπογεγραμμένη άδεια
 *   (`pdfFetchTarget`, ADR-901 §14.9)· καμία από τις δύο δεν υπόσχεται ότι ο browser θα το κρατήσει. Ένα `prefetch` θα
 *   ήταν ελπίδα· εδώ ο θεατής **ρωτά το ίδιο αίτημα** που ξεκίνησε η προφόρτωση — αν τρέχει ακόμη, το περιμένει.
 * 🔑 **Μικρό LRU (3)**: τρέχον + γείτονες. Και το «πίσω» είναι στιγμιαίο, χωρίς να μεγαλώνει η μνήμη με τη διαδρομή.
 * ⚠️ **Αντίγραφο σε κάθε ανάγνωση**: το pdf.js **μεταφέρει** τον πίνακα στον worker του (detached buffer) — αν έδινε το
 *   ίδιο, η δεύτερη ανάγνωση θα έβρισκε άδειο buffer.
 */

import type { PdfFetchTarget } from './pdf-fetch-target';

const MAX_ENTRIES = 3;

const entries = new Map<string, Promise<ArrayBuffer>>();

const keyOf = (target: PdfFetchTarget) => `${target.credentials} ${target.url}`;

function remember(target: PdfFetchTarget): Promise<ArrayBuffer> {
  const key = keyOf(target);
  const hit = entries.get(key);
  if (hit) {
    entries.delete(key); // πιο πρόσφατο ⇒ στο τέλος της σειράς εκτόπισης
    entries.set(key, hit);
    return hit;
  }
  const pending = fetch(target.url, { credentials: target.credentials }).then((response) => {
    if (!response.ok) throw new Error(`PDF fetch: HTTP ${response.status}`);
    return response.arrayBuffer();
  });
  // Αποτυχία ⇒ καμία μνήμη της: η επόμενη ανάγνωση ξαναδοκιμάζει (μόνο αν δεν την αντικατέστησε ήδη άλλη).
  pending.catch(() => {
    if (entries.get(key) === pending) entries.delete(key);
  });
  entries.set(key, pending);
  while (entries.size > MAX_ENTRIES) entries.delete(entries.keys().next().value as string);
  return pending;
}

/** Τα bytes για το pdf.js — από τη μνήμη αν υπάρχουν ή έρχονται ήδη, αλλιώς τώρα. */
export async function loadPdfBytes(target: PdfFetchTarget): Promise<Uint8Array> {
  return new Uint8Array((await remember(target)).slice(0));
}

/** Ξεκινά τη λήψη χωρίς να περιμένει κανείς· η αποτυχία δεν είναι σφάλμα κανενός (θα ξαναζητηθεί στο άνοιγμα). */
export function preloadPdfBytes(target: PdfFetchTarget): void {
  remember(target).catch(() => undefined);
}

/** Μόνο για tests. */
export function __resetPdfBytesCacheForTests(): void {
  entries.clear();
}
