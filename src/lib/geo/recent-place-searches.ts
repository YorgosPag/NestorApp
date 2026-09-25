/**
 * **Το ιστορικό αναζητήσεων τόπου** — ό,τι βρήκε ο άνθρωπος, για να το ξαναβρεί με ένα πάτημα.
 *
 * @related ADR-882 · `hooks/geo/useRecentPlaceSearches` (η React όψη) ·
 *          `components/search/PlaceSearchBox` (ο μόνος γραφέας σήμερα)
 *
 * 🏆 **ΤΙ ΚΡΑΤΑΜΕ ΠΕΡΙΣΣΟΤΕΡΟ ΑΠΟ ΤΟ ZILLOW: ΤΗΝ ΑΠΑΝΤΗΣΗ, ΟΧΙ ΜΟΝΟ ΤΗΝ ΕΡΩΤΗΣΗ.** Κάθε
 * εγγραφή κουβαλά το **κέντρο που ήδη εντοπίστηκε** ⇒ η επανεπιλογή πηγαίνει κατευθείαν στα
 * αποτελέσματα, **χωρίς** δεύτερη κλήση στον geocoder (λιγότερη αναμονή, λιγότερος ρυθμιστής).
 *
 * 🔴 **ΜΠΑΙΝΕΙ ΜΟΝΟ Ο,ΤΙ ΕΝΤΟΠΙΣΤΗΚΕ.** Ένα κείμενο που έδωσε `not-found` δεν γράφεται ποτέ:
 * ιστορικό γεμάτο τυπογραφικά λάθη θα πρότεινε στον άνθρωπο ακριβώς ό,τι απέτυχε.
 *
 * 🔒 **Η θέση GPS του ανθρώπου ΔΕΝ γράφεται εδώ** — η «Τρέχουσα τοποθεσία» δεν μπαίνει στο
 * ιστορικό. Εδώ ζουν μόνο κέντρα **περιοχών που πληκτρολόγησε**.
 *
 * Το αρχείο χωρίζεται σε **καθαρές** συναρτήσεις (ελέγξιμες χωρίς browser) και σε **λίγες**
 * πράξεις Ι/Ο πάνω στο `safe-storage` — το ΜΟΝΟ σημείο που αγγίζει το `localStorage`.
 */

import { STORAGE_KEYS, safeGetItem, safeSetItem, safeRemoveItem } from '@/lib/storage';
import type { GeoPoint } from '@/types/geo/coordinates';
import { createExternalStore } from '@/lib/state/createExternalStore';

export interface RecentPlaceSearch {
  /** Ό,τι έγραψε ο άνθρωπος — αναγνωρίζει τις δικές του λέξεις (το Zillow δείχνει «NY»). */
  readonly label: string;
  /** Το κέντρο που επέστρεψε ο geocoder για αυτό το κείμενο. */
  readonly center: GeoPoint;
  /** ms από epoch — για τη σειρά και για μελλοντική συγχώνευση με τον λογαριασμό. */
  readonly savedAt: number;
}

/** Όσες χωρούν στη λίστα χωρίς κύλιση — το Google Maps/Zillow μένουν σε μονοψήφιο πλήθος. */
export const RECENT_PLACE_SEARCHES_LIMIT = 8;

const SCHEMA_VERSION = 1;

interface StoredShape {
  readonly version: number;
  readonly entries: readonly unknown[];
}

// ─── Καθαρές συναρτήσεις ────────────────────────────────────────────────────

/**
 * Η ταυτότητα μιας εγγραφής: **χωρίς τόνους, πεζά, ενιαία κενά**. «Αθήνα», «αθηνα» και
 * « ΑΘΗΝΑ » είναι η ίδια αναζήτηση — τρεις γραμμές για αυτήν θα ήταν θόρυβος.
 */
export function placeSearchKey(label: string): string {
  return label
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('el')
    .replace(/\s+/g, ' ')
    .trim();
}

function isFiniteCoordinate(value: unknown, limit: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= limit;
}

function toRecentPlace(value: unknown): RecentPlaceSearch | null {
  if (typeof value !== 'object' || value === null) return null;
  const { label, center, savedAt } = value as Record<string, unknown>;
  if (typeof label !== 'string' || label.trim() === '') return null;
  if (typeof savedAt !== 'number' || !Number.isFinite(savedAt)) return null;
  if (typeof center !== 'object' || center === null) return null;
  const { lat, lng } = center as Record<string, unknown>;
  if (!isFiniteCoordinate(lat, 90) || !isFiniteCoordinate(lng, 180)) return null;
  return { label, center: { lat, lng }, savedAt };
}

/**
 * Ό,τι κι αν βρίσκεται στον δίσκο → **έγκυρη** λίστα. Χαλασμένη εγγραφή (χειροκίνητη
 * επέμβαση, παλιό σχήμα, άλλη καρτέλα σε μέση εγγραφής) **πέφτει σιωπηλά**· ποτέ δεν ρίχνει
 * την οθόνη.
 */
export function parseRecentPlaceSearches(raw: unknown): RecentPlaceSearch[] {
  if (typeof raw !== 'object' || raw === null) return [];
  const { version, entries } = raw as Partial<StoredShape>;
  if (version !== SCHEMA_VERSION || !Array.isArray(entries)) return [];
  const seen = new Set<string>();
  const result: RecentPlaceSearch[] = [];
  for (const entry of entries) {
    const place = toRecentPlace(entry);
    if (place === null) continue;
    const key = placeSearchKey(place.label);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(place);
  }
  return result.slice(0, RECENT_PLACE_SEARCHES_LIMIT);
}

/** Η νέα μπαίνει **πρώτη**· η παλιά ίδια εγγραφή φεύγει (ιδεμπότητα: δύο φορές = μία). */
export function withRecentPlaceSearch(
  list: readonly RecentPlaceSearch[],
  entry: RecentPlaceSearch,
): RecentPlaceSearch[] {
  const key = placeSearchKey(entry.label);
  const rest = list.filter((place) => placeSearchKey(place.label) !== key);
  return [entry, ...rest].slice(0, RECENT_PLACE_SEARCHES_LIMIT);
}

export function withoutRecentPlaceSearch(
  list: readonly RecentPlaceSearch[],
  label: string,
): RecentPlaceSearch[] {
  const key = placeSearchKey(label);
  return list.filter((place) => placeSearchKey(place.label) !== key);
}

/** Φιλτράρισμα καθώς γράφει — ίδιος κανόνας ταυτότητας (χωρίς τόνους, πεζά). */
export function matchRecentPlaceSearches(
  list: readonly RecentPlaceSearch[],
  query: string,
): readonly RecentPlaceSearch[] {
  const needle = placeSearchKey(query);
  if (needle === '') return list;
  return list.filter((place) => placeSearchKey(place.label).includes(needle));
}

// ─── Ι/Ο ────────────────────────────────────────────────────────────────────

export function readRecentPlaceSearches(): RecentPlaceSearch[] {
  return parseRecentPlaceSearches(safeGetItem<unknown>(STORAGE_KEYS.RECENT_PLACE_SEARCHES, null));
}

/**
 * **Στιγμιότυπο με σταθερή ταυτότητα** για το `useSyncExternalStore`: ίδιο ωμό κείμενο στον
 * δίσκο ⇒ **ίδιος** πίνακας. Ένας νέος πίνακας σε κάθε ανάγνωση θα ήταν ατέρμονος βρόχος
 * απόδοσης (το ίδιο σχήμα με το `?? []` στους selectors — βλ. ADR-040/366).
 */
export const NO_RECENT_PLACE_SEARCHES: readonly RecentPlaceSearch[] = Object.freeze([]);

let snapshotRaw: string | null = null;
let snapshot: readonly RecentPlaceSearch[] = NO_RECENT_PLACE_SEARCHES;

export function getRecentPlaceSearchesSnapshot(): readonly RecentPlaceSearch[] {
  const raw = safeGetItem(STORAGE_KEYS.RECENT_PLACE_SEARCHES, '');
  if (raw === snapshotRaw) return snapshot;
  snapshotRaw = raw;
  snapshot = raw === '' ? NO_RECENT_PLACE_SEARCHES : parseRawRecentPlaceSearches(raw);
  return snapshot;
}

function parseRawRecentPlaceSearches(raw: string): readonly RecentPlaceSearch[] {
  try {
    return parseRecentPlaceSearches(JSON.parse(raw));
  } catch {
    return NO_RECENT_PLACE_SEARCHES;
  }
}

/**
 * **Ποιος ακούει.** Το συμβάν `storage` του browser φτάνει **μόνο στις ΑΛΛΕΣ καρτέλες** — η
 * καρτέλα που έγραψε δεν ειδοποιείται ποτέ. Γι' αυτό κάθε εγγραφή εδώ ειδοποιεί **και** τους
 * τοπικούς ακροατές: αλλιώς δύο κουτιά στην ίδια σελίδα θα έδειχναν διαφορετικό ιστορικό.
 */
const localWrites = createExternalStore<number>(0);

function notify(): void {
  localWrites.set(localWrites.get() + 1);
}

export function subscribeRecentPlaceSearches(listener: () => void): () => void {
  const unsubscribeLocal = localWrites.subscribe(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === STORAGE_KEYS.RECENT_PLACE_SEARCHES) listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    unsubscribeLocal();
    window.removeEventListener('storage', onStorage);
  };
}

function writeRecentPlaceSearches(entries: readonly RecentPlaceSearch[]): void {
  if (entries.length === 0) {
    safeRemoveItem(STORAGE_KEYS.RECENT_PLACE_SEARCHES);
  } else {
    const stored: StoredShape = { version: SCHEMA_VERSION, entries };
    safeSetItem(STORAGE_KEYS.RECENT_PLACE_SEARCHES, stored);
  }
  notify();
}

/** Διαβάζει **φρέσκο** από τον δίσκο πριν γράψει — άλλη καρτέλα μπορεί να έγραψε ενδιάμεσα. */
export function rememberPlaceSearch(label: string, center: GeoPoint, now: number): void {
  const trimmed = label.trim();
  if (trimmed === '') return;
  writeRecentPlaceSearches(
    withRecentPlaceSearch(readRecentPlaceSearches(), { label: trimmed, center, savedAt: now }),
  );
}

export function forgetPlaceSearch(label: string): void {
  writeRecentPlaceSearches(withoutRecentPlaceSearch(readRecentPlaceSearches(), label));
}

export function clearPlaceSearches(): void {
  writeRecentPlaceSearches([]);
}
