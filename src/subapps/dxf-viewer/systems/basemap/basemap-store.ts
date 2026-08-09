/**
 * Runtime SSoT της κατάστασης του υποβάθρου χάρτη: **ανοιχτό;** · **πόσο διάφανο;** ·
 * **ποιος πάροχος;**
 *
 * Ένα store, **δύο** καταναλωτές (ο ζωγράφος του 2Δ και το έδαφος του 3Δ) — ίδιο σχήμα με το
 * `geo-reference-store`, που τροφοδοτεί ταυτόχρονα τις ισοϋψείς του 2Δ και το ανάγλυφο του 3Δ.
 * Ο λόγος είναι ο ίδιος: αν το 3Δ κρατούσε δικό του διακόπτη, ο χρήστης θα έσβηνε τον χάρτη σε
 * μία προβολή και θα τον έβρισκε αναμμένο στην άλλη, χωρίς να μπορεί να πει γιατί.
 *
 * Μηδέν React (ADR-040): οι διεπαφές το διαβάζουν με `useSyncExternalStore`, ο ζωγράφος με
 * σκέτο `get()` τη στιγμή του καρέ.
 */

import { createExternalStore } from '../../stores/createExternalStore';
import { DEFAULT_BASEMAP_SOURCE_ID, type BasemapSourceId } from './basemap-source';

export interface BasemapState {
  /** `true` όταν ο χρήστης έχει ανάψει το υπόβαθρο. */
  readonly enabled: boolean;
  /** Αδιαφάνεια ζωγραφικής, 0 … 1. */
  readonly opacity: number;
  readonly sourceId: BasemapSourceId;
}

/**
 * Προεπιλεγμένη αδιαφάνεια **0,55**, όχι 1.
 *
 * Ο χάρτης είναι **υπόβαθρο αναφοράς**, όχι περιεχόμενο: το σχέδιο πρέπει να παραμένει το
 * αναγνώσιμο στρώμα. Πλήρως αδιαφανές υπόβαθρο κάτω από λεπτές γραμμές CAD μειώνει την αντίθεσή
 * τους — ακριβώς το μέγεθος που έξι πύλες αυτού του αποθετηρίου (3.38-3.43) υπάρχουν για να
 * προστατεύσουν. Η τιμή είναι ρυθμιζόμενη· η **προεπιλογή** είναι που δεν επιτρέπεται να
 * βλάπτει.
 */
const DEFAULT_OPACITY = 0.55;

const INITIAL: BasemapState = {
  enabled: false,
  opacity: DEFAULT_OPACITY,
  sourceId: DEFAULT_BASEMAP_SOURCE_ID,
};

const store = createExternalStore<BasemapState>(INITIAL, {
  equals: (a, b) => a.enabled === b.enabled && a.opacity === b.opacity && a.sourceId === b.sourceId,
});

/** Η τρέχουσα κατάσταση. Καθαρή ανάγνωση — ασφαλής και ως `getSnapshot`. */
export function getBasemapState(): BasemapState {
  return store.get();
}

/** Εγγραφή σε αλλαγές· επιστρέφει την απεγγραφή (συμβατό με `useSyncExternalStore`). */
export function subscribeBasemap(listener: () => void): () => void {
  return store.subscribe(listener);
}

/** Άναμμα/σβήσιμο του υποβάθρου. */
export function setBasemapEnabled(enabled: boolean): void {
  store.set({ ...store.get(), enabled });
}

/** Εναλλαγή — η πράξη που κάνει το κουμπί «Χάρτης» της μπάρας ορόφων. */
export function toggleBasemapEnabled(): void {
  setBasemapEnabled(!store.get().enabled);
}

/** Αδιαφάνεια, περιορισμένη στο [0,1] ώστε καμία διεπαφή να μη γράψει άκυρη τιμή. */
export function setBasemapOpacity(opacity: number): void {
  store.set({ ...store.get(), opacity: Math.max(0, Math.min(1, opacity)) });
}

/** Επιλογή παρόχου. */
export function setBasemapSource(sourceId: BasemapSourceId): void {
  store.set({ ...store.get(), sourceId });
}

/** Επαναφορά για απομόνωση δοκιμών (δεν ειδοποιεί — δες `ExternalStore.reset`). */
export function resetBasemapStore(): void {
  store.reset(INITIAL);
}
