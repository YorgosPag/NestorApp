/**
 * **Το ιστορικό αναζητήσεων τόπου ΤΗΣ ΣΥΣΚΕΥΗΣ** — η αποθήκη του ανώνυμου επισκέπτη (ADR-882).
 *
 * Το ΜΟΝΟ σημείο που αγγίζει το `localStorage` για το ιστορικό (μέσω `safe-storage`). Ο
 * συνδεδεμένος άνθρωπος **δεν** γράφει εδώ: το ιστορικό του ζει στον λογαριασμό
 * (`recent-place-searches-account`) και **ποτέ** στον δίσκο — ώστε μετά την αποσύνδεση ο
 * επόμενος στην ίδια συσκευή να μη βλέπει τι έψαξε (Google: signed-out history ≠ account).
 *
 * 🔴 **ΜΠΑΙΝΕΙ ΜΟΝΟ Ο,ΤΙ ΕΝΤΟΠΙΣΤΗΚΕ** — ο γραφέας (`PlaceSearchBox`) καλεί μόνο μετά από
 * επιτυχή εντοπισμό· ιστορικό γεμάτο τυπογραφικά θα πρότεινε ό,τι απέτυχε.
 */

import { STORAGE_KEYS, safeGetItem, safeSetItem, safeRemoveItem } from '@/lib/storage';
import { createExternalStore } from '@/lib/state/createExternalStore';
import {
  NO_RECENT_PLACE_SEARCHES,
  RECENT_PLACE_SEARCHES_LIMIT,
  placeSearchKey,
  toRecentPlace,
  withRecentPlaceSearch,
  withoutRecentPlaceSearch,
  type RecentPlaceSearch,
} from './recent-place-searches-model';

const SCHEMA_VERSION = 1;

interface StoredShape {
  readonly version: number;
  readonly entries: readonly unknown[];
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

export function readDevicePlaceSearches(): RecentPlaceSearch[] {
  return parseRecentPlaceSearches(safeGetItem<unknown>(STORAGE_KEYS.RECENT_PLACE_SEARCHES, null));
}

let snapshotRaw: string | null = null;
let snapshot: readonly RecentPlaceSearch[] = NO_RECENT_PLACE_SEARCHES;

/** **Στιγμιότυπο με σταθερή ταυτότητα**: ίδιο ωμό κείμενο στον δίσκο ⇒ **ίδιος** πίνακας. */
export function getDevicePlaceSearchesSnapshot(): readonly RecentPlaceSearch[] {
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

export function subscribeDevicePlaceSearches(listener: () => void): () => void {
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

export function writeDevicePlaceSearches(entries: readonly RecentPlaceSearch[]): void {
  if (entries.length === 0) {
    safeRemoveItem(STORAGE_KEYS.RECENT_PLACE_SEARCHES);
  } else {
    const stored: StoredShape = { version: SCHEMA_VERSION, entries };
    safeSetItem(STORAGE_KEYS.RECENT_PLACE_SEARCHES, stored);
  }
  notify();
}

/** Διαβάζει **φρέσκο** από τον δίσκο πριν γράψει — άλλη καρτέλα μπορεί να έγραψε ενδιάμεσα. */
export function rememberDevicePlaceSearch(entry: RecentPlaceSearch): void {
  writeDevicePlaceSearches(withRecentPlaceSearch(readDevicePlaceSearches(), entry));
}

export function forgetDevicePlaceSearch(label: string): void {
  writeDevicePlaceSearches(withoutRecentPlaceSearch(readDevicePlaceSearches(), label));
}
