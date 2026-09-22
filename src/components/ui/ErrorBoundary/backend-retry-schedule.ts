/**
 * **ΠΟΤΕ ΞΑΝΑΔΟΚΙΜΑΖΟΥΜΕ** όταν το backend δεν απάντησε — καθαρό, ελέγξιμο, χωρίς React.
 *
 * 🔑 **ΓΙΑΤΙ ΜΕΤΡΗΤΗΣ ΣΤΟ `sessionStorage`**: η επανάληψη είναι **πλήρης επαναφόρτωση**
 * (το σφάλμα ήρθε από τον server, και όταν πέφτει το κέλυφος το έγγραφο είναι το
 * `__next_error__` — μετρημένο 2026-09-22 σε Next 15.5.22). Η μνήμη του module χάνεται
 * σε κάθε επαναφόρτωση ⇒ χωρίς αποθηκευμένο μετρητή κάθε προσπάθεια θα ήταν η «πρώτη»,
 * δηλαδή βρόχος ανά 5″ **για πάντα** πάνω σε server που ήδη υποφέρει.
 *
 * 🔑 **ΓΙΑΤΙ JITTER**: η καθυστέρηση βγαίνει από το ΥΠΑΡΧΟΝ SSoT `retryDelayMs` (equal
 * jitter). Όταν το backend επανέλθει, χίλιοι ανοιχτοί browsers δεν χτυπούν **μαζί**.
 *
 * ⚠️ Μετρητής παλαιότερος από `STALE_AFTER_MS` αγνοείται: μια βλάβη πριν από μισή ώρα
 * δεν κάνει τη σημερινή πρώτη προσπάθεια να περιμένει ένα λεπτό.
 *
 * @module components/ui/ErrorBoundary/backend-retry-schedule
 */

import { retryDelayMs, type RetryPolicy } from '@/lib/app-version/chunk-recovery/retry-policy';

/** 5″ · 10″ · 20″ · 40″ · 60″ (±jitter) — μετά ο άνθρωπος αποφασίζει. */
export const BACKEND_RETRY_POLICY: RetryPolicy = {
  maxRetries: 5,
  baseDelayMs: 5_000,
  factor: 2,
  maxDelayMs: 60_000,
};

const STORAGE_PREFIX = 'nestor:backend-retry:';
const STALE_AFTER_MS = 5 * 60_000;

interface StoredAttempt {
  readonly attempt: number;
  readonly at: number;
}

/** Όλο το I/O περνά από εδώ — στα tests αντικαθίσταται με `Map`. */
export interface AttemptStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function parseStored(raw: string | null, now: number): number {
  if (raw === null) return 0;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredAttempt>;
    if (typeof parsed.attempt !== 'number' || typeof parsed.at !== 'number') return 0;
    return now - parsed.at > STALE_AFTER_MS ? 0 : parsed.attempt;
  } catch {
    return 0;
  }
}

/** Πόσες αυτόματες επαναλήψεις έχουν ήδη γίνει για αυτή τη διεύθυνση. */
export function readAttempt(store: AttemptStore | null, path: string, now: number): number {
  if (store === null) return 0;
  try {
    return parseStored(store.getItem(STORAGE_PREFIX + path), now);
  } catch {
    return 0;
  }
}

/** Καταγράφει ότι ξεκινά η επόμενη προσπάθεια — **πριν** την επαναφόρτωση. */
export function recordAttempt(store: AttemptStore | null, path: string, attempt: number, now: number): void {
  if (store === null) return;
  try {
    store.setItem(STORAGE_PREFIX + path, JSON.stringify({ attempt, at: now } satisfies StoredAttempt));
  } catch {
    // Ιδιωτικό παράθυρο / αποκλεισμένη αποθήκευση: η επανάληψη συνεχίζει, απλώς χωρίς μνήμη.
  }
}

/** Δευτερόλεπτα ως την επόμενη προσπάθεια, ή `null` όταν εξαντλήθηκε το πρόγραμμα. */
export function secondsUntilRetry(attempt: number, random: () => number = Math.random): number | null {
  if (attempt >= BACKEND_RETRY_POLICY.maxRetries) return null;
  return Math.max(1, Math.round(retryDelayMs(attempt, BACKEND_RETRY_POLICY, random) / 1000));
}
