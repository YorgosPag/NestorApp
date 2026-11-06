/**
 * ADR-929 Φ5.2γ (ADR-340) — το «καθολικό» εγγραφών του υποβάθρου: τι **ξέρει** ο server για κάθε όροφο, και
 * μία σειριακή ουρά για ό,τι του στέλνουμε.
 *
 * 🔴 **Γιατί υπάρχει.** Δύο δρόμοι γράφουν το ίδιο έγγραφο: το debounced autosave (θέση, διαφάνεια,
 * ορατότητα, κλείδωμα) και η βαθμονόμηση (θέση + βαθμονόμηση + αναπροσαρμογή overlays). Η βαθμονόμηση
 * χρειάζεται τη θέση **που έχει ο server** (`oldTransform`), γιατί με αυτήν μετακινεί τα overlays. Αν
 * ένα autosave πρόφταινε να γράψει την ήδη βαθμονομημένη θέση, ο server θα έβλεπε `old == new` και τα
 * overlays θα έμεναν σιωπηλά λάθος. Πριν, το «τι έχει ο server» ζούσε σε `useRef` μέσα στο hook του
 * autosave, όπου η βαθμονόμηση δεν μπορούσε καν να το διαβάσει.
 *
 * Τώρα:
 * - **ΜΙΑ** αλήθεια για το δεσμευμένο στιγμιότυπο ανά όροφο (`getCommittedBackground`).
 * - **ΜΙΑ** ουρά ανά όροφο (`enqueueBackgroundWrite`): οι εγγραφές εκτελούνται με τη σειρά που ζητήθηκαν,
 *   ποτέ ταυτόχρονα — μηδέν αγώνας, χωρίς κλειδώματα.
 * - Όσο εκκρεμεί βαθμονόμηση, **ιδιοκτήτης της θέσης είναι η βαθμονόμηση**: το autosave στέλνει τη
 *   δεσμευμένη θέση (`transformForAutosave`), όχι την αισιόδοξη.
 *
 * Ο server ελέγχει επιπλέον σύγκρουση (`oldTransform` ≠ αποθηκευμένο ⇒ 409) για άλλες καρτέλες/χρήστες.
 *
 * Καθαρό module χωρίς React. Module-level κατάσταση (όπως το `_floorProviders` του store): ζει όσο η σελίδα.
 */

import { transformsEqual, type BackgroundTransform, type FloorplanBackground } from '../providers/types';

/** Ό,τι γράφει το autosave — και ό,τι συγκρίνουμε για να ξέρουμε αν υπάρχει κάτι να σταλεί. */
export interface PersistableSnapshot {
  readonly id: string;
  readonly transform: BackgroundTransform;
  readonly opacity: number;
  readonly visible: boolean;
  readonly locked: boolean;
}

export function snapshotOf(bg: FloorplanBackground): PersistableSnapshot {
  return {
    id: bg.id,
    transform: { ...bg.transform },
    opacity: bg.opacity,
    visible: bg.visible,
    locked: bg.locked,
  };
}

export function snapshotsEqual(a: PersistableSnapshot, b: PersistableSnapshot): boolean {
  return a.id === b.id
    && a.opacity === b.opacity
    && a.visible === b.visible
    && a.locked === b.locked
    && transformsEqual(a.transform, b.transform);
}

// ── Committed state («τι έχει ο server») ──────────────────────────────────────

const committed = new Map<string, PersistableSnapshot>();

export function getCommittedBackground(floorId: string): PersistableSnapshot | null {
  return committed.get(floorId) ?? null;
}

/** Το καλούν μόνο όσοι **άκουσαν** τον server: ενυδάτωση και επιτυχημένες εγγραφές. */
export function setCommittedBackground(floorId: string, snapshot: PersistableSnapshot | null): void {
  if (snapshot) committed.set(floorId, snapshot);
  else committed.delete(floorId);
}

// ── Transform ownership while a calibration is in flight ──────────────────────

const calibrationPending = new Set<string>();

export function setCalibrationPending(floorId: string, pending: boolean): void {
  if (pending) calibrationPending.add(floorId);
  else calibrationPending.delete(floorId);
}

/**
 * Η θέση που επιτρέπεται να στείλει το autosave: η τρέχουσα, εκτός αν εκκρεμεί βαθμονόμηση — τότε η
 * δεσμευμένη (τη νέα θέση τη γράφει η βαθμονόμηση, μαζί με την αναπροσαρμογή των overlays).
 */
export function transformForAutosave(floorId: string, current: BackgroundTransform): BackgroundTransform {
  const known = committed.get(floorId);
  return calibrationPending.has(floorId) && known ? known.transform : current;
}

// ── One serial write queue per floor ──────────────────────────────────────────

const queues = new Map<string, Promise<unknown>>();

/**
 * Εκτελεί την εγγραφή **μετά** από όσες ζητήθηκαν νωρίτερα για τον ίδιο όροφο. Μια αποτυχημένη εγγραφή
 * δεν μπλοκάρει τις επόμενες (η ουρά συνεχίζει), αλλά ο καλών της παίρνει το σφάλμα της.
 */
export function enqueueBackgroundWrite<T>(floorId: string, write: () => Promise<T>): Promise<T> {
  const previous = queues.get(floorId) ?? Promise.resolve();
  const run = previous.catch(() => undefined).then(write);
  const tail = run.catch(() => undefined);
  queues.set(floorId, tail);
  void tail.then(() => {
    if (queues.get(floorId) === tail) queues.delete(floorId);
  });
  return run;
}
