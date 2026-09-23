/**
 * @fileoverview **Η ουρά και η μνήμη των στιγμιοτύπων χάρτη** — καθαρή κατάσταση, κανένας χάρτης.
 * @related ADR-777 §8.70 (Φάση 2) · components/listing-map-snapshot/*
 * @module lib/maps/map-snapshot-store
 *
 * 🔑 **ΕΝΑΣ χάρτης WebGL για Ν κάρτες.** Οι περιηγητές κρατούν ~16 ζωντανά WebGL contexts, και
 * μια λίστα ακινήτων με χάρτη ανά κάρτα θα τα εξαντλούσε — οι παλιότεροι χάρτες θα έσβηναν
 * σιωπηλά (`webglcontextlost`). Εδώ **ένας** κρυφός χάρτης ζωγραφίζει τις κάρτες **μία-μία** και
 * κρατά την εικόνα. Είναι το «static map API» των μεγάλων, μόνο που τρέχει στον περιηγητή με το
 * **ίδιο** στυλ και τον **ίδιο** ζωγράφο του δημόσιου χάρτη: 0 €, κανένα κλειδί, καμία απόκλιση.
 *
 * ⚠️ **Ιδεμποτία**: το ίδιο κλειδί ζητημένο Ν φορές ζωγραφίζεται **μία**. Το κλειδί είναι το
 * περιεχόμενο (σημάδι + χρώματα), άρα αλλαγή θέματος ⇒ νέο κλειδί ⇒ νέα εικόνα, χωρίς ακύρωση.
 *
 * ⚠️ **Τα `blob:` URL αποδεσμεύονται ΜΟΝΟ στο `dispose`** (όταν φεύγει η σελίδα), όχι με LRU:
 * μια αποδέσμευση όσο η εικόνα είναι ακόμη στην οθόνη θα έδινε σπασμένη εικόνα. Το κόστος
 * μνήμης είναι ~20-40 KB ανά κάρτα, φραγμένο από το πλήθος των ακινήτων του κατόχου.
 */

import { createExternalStore } from '@/lib/state/createExternalStore';
import type { MapAttributionSegment } from './map-attribution';

export type MapSnapshotState =
  | { readonly status: 'queued' }
  | { readonly status: 'ready'; readonly url: string; readonly attribution: readonly MapAttributionSegment[] }
  | { readonly status: 'failed' };

export interface MapSnapshotJob<TPayload> {
  readonly key: string;
  readonly payload: TPayload;
}

export interface MapSnapshotResult {
  readonly blob: Blob;
  readonly attribution: readonly MapAttributionSegment[];
}

export interface MapSnapshotStore<TPayload> {
  /** Ζήτα στιγμιότυπο. Ιδεμποτές: υπάρχον κλειδί (σε οποιαδήποτε κατάσταση) ⇒ τίποτα. */
  request(key: string, payload: TPayload): void;
  get(key: string): MapSnapshotState | undefined;
  /** Πόσα κλειδιά ζητήθηκαν ποτέ — για όποιον εγγράφεται **μετά** τα πρώτα αιτήματα. */
  size(): number;
  /** Η επόμενη εργασία για τον ζωγράφο — ή `null` όταν η ουρά άδειασε. */
  takeNext(): MapSnapshotJob<TPayload> | null;
  /** `null` ⇒ αποτυχία (λήξη χρόνου, σφάλμα απόδοσης). Άγνωστο κλειδί ⇒ αγνοείται. */
  settle(key: string, result: MapSnapshotResult | null): void;
  subscribe(listener: () => void): () => void;
  /** Αποδεσμεύει κάθε URL και απορρίπτει ό,τι εκκρεμεί. Μετά από αυτό το κατάστημα είναι νεκρό. */
  dispose(): void;
}

export interface MapSnapshotUrlFactory {
  create(blob: Blob): string;
  revoke(url: string): void;
}

const BROWSER_URLS: MapSnapshotUrlFactory = {
  create: (blob) => URL.createObjectURL(blob),
  revoke: (url) => URL.revokeObjectURL(url),
};

export function createMapSnapshotStore<TPayload>(
  urls: MapSnapshotUrlFactory = BROWSER_URLS,
): MapSnapshotStore<TPayload> {
  const states = new Map<string, MapSnapshotState>();
  const queue: MapSnapshotJob<TPayload>[] = [];
  // Σήμα έκδοσης: η κατάσταση ζει στο `states`· το SSoT store κρατά μόνο το «άλλαξε κάτι».
  const version = createExternalStore(0);
  let disposed = false;

  const emit = (): void => version.set(version.get() + 1);

  return {
    request(key, payload) {
      if (disposed || states.has(key)) return;
      states.set(key, { status: 'queued' });
      queue.push({ key, payload });
      emit();
    },
    get: (key) => states.get(key),
    size: () => states.size,
    takeNext: () => (disposed ? null : (queue.shift() ?? null)),
    settle(key, result) {
      if (disposed) return;
      if (states.get(key)?.status !== 'queued') return;
      states.set(
        key,
        result === null
          ? { status: 'failed' }
          : { status: 'ready', url: urls.create(result.blob), attribution: result.attribution },
      );
      emit();
    },
    subscribe: version.subscribe,
    dispose() {
      disposed = true;
      states.forEach((state) => {
        if (state.status === 'ready') urls.revoke(state.url);
      });
      states.clear();
      queue.length = 0;
      version.reset(0);
    },
  };
}
