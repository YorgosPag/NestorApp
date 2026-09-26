/**
 * **Το ιστορικό αναζητήσεων τόπου** — ό,τι βρήκε ο άνθρωπος, για να το ξαναβρεί με ένα πάτημα.
 *
 * @related ADR-882 · `hooks/geo/useRecentPlaceSearches` (η React όψη + ο δεσμός λογαριασμού) ·
 *          `components/search/PlaceSearchBox` (ο μόνος γραφέας)
 *
 * 🔑 **Η ΠΡΟΣΟΨΗ — ΕΝΑ ΣΗΜΕΙΟ, ΔΥΟ ΑΠΟΘΗΚΕΣ.** Οι καταναλωτές ρωτούν «ποιο είναι το
 * ιστορικό;» και «θυμήσου αυτό»· **εδώ** αποφασίζεται πού ζει:
 * - **ανώνυμος** → η συσκευή (`recent-place-searches-device`, `localStorage`)·
 * - **συνδεδεμένος** → ο λογαριασμός (`recent-place-searches-account`, Firestore), σε κάθε
 *   συσκευή του· αν ο λογαριασμός δεν απαντά, πέφτει ήσυχα στη συσκευή.
 *
 * Κανένας καταναλωτής δεν ξέρει ποια αποθήκη μίλησε — αλλιώς κάθε κουτί θα ξανάγραφε την
 * ίδια απόφαση, ελεύθερο να αποκλίνει.
 */

import type { GeoPoint } from '@/types/geo/coordinates';
import {
  forgetDevicePlaceSearch,
  getDevicePlaceSearchesSnapshot,
  readDevicePlaceSearches,
  rememberDevicePlaceSearch,
  subscribeDevicePlaceSearches,
  writeDevicePlaceSearches,
} from './recent-place-searches-device';
import {
  clearAccountPlaceSearches,
  forgetAccountPlaceSearch,
  getAccountPlaceSearchesSnapshot,
  isAccountPlaceSearchesActive,
  rememberAccountPlaceSearch,
  subscribeAccountPlaceSearches,
} from './recent-place-searches-account';
import {
  recentPlaceKey,
  supersededPointKeys,
  type RecentAreaSearch,
  type RecentPlaceSearch,
} from './recent-place-searches-model';

export {
  NO_RECENT_PLACE_SEARCHES,
  RECENT_PLACE_SEARCHES_LIMIT,
  matchRecentPlaceSearches,
  placeSearchKey,
  recentPlaceKey,
  withRecentPlaceSearch,
  withoutRecentPlaceSearch,
  type RecentAreaSearch,
  type RecentPlaceSearch,
  type RecentPointSearch,
} from './recent-place-searches-model';
export { parseRecentPlaceSearches } from './recent-place-searches-device';
export { bindAccountPlaceSearches } from './recent-place-searches-account';

/** Το ιστορικό **της συσκευής** (ο ανώνυμος) — φρέσκο από τον δίσκο. */
export function readRecentPlaceSearches(): RecentPlaceSearch[] {
  return readDevicePlaceSearches();
}

/** Σταθερή ταυτότητα και από τις δύο πλευρές ⇒ ασφαλές για `useSyncExternalStore`. */
export function getRecentPlaceSearchesSnapshot(): readonly RecentPlaceSearch[] {
  return isAccountPlaceSearchesActive() ? getAccountPlaceSearchesSnapshot() : getDevicePlaceSearchesSnapshot();
}

/**
 * Ακούει **και** τις δύο αποθήκες: η αποθήκη λογαριασμού ειδοποιεί και για την αλλαγή δεσμού
 * (σύνδεση/αποσύνδεση αλλάζει πηγή), ώστε το κουτί να το δει χωρίς να ξανανοίξει.
 */
export function subscribeRecentPlaceSearches(listener: () => void): () => void {
  const unsubscribeDevice = subscribeDevicePlaceSearches(listener);
  const unsubscribeAccount = subscribeAccountPlaceSearches(listener);
  return () => {
    unsubscribeDevice();
    unsubscribeAccount();
  };
}

/** Ο ΕΝΑΣ δρόμος εγγραφής — συσκευή ή λογαριασμός, με τα σημεία που η εγγραφή αντικαθιστά. */
function rememberEntry(entry: RecentPlaceSearch, superseded: readonly string[]): void {
  if (isAccountPlaceSearchesActive()) rememberAccountPlaceSearch(entry, superseded);
  else rememberDevicePlaceSearch(entry, superseded);
}

export function rememberPlaceSearch(label: string, center: GeoPoint, now: number): void {
  const trimmed = label.trim();
  if (trimmed === '') return;
  rememberEntry({ label: trimmed, center, savedAt: now }, []);
}

/**
 * ADR-882 §3.7 — **η περιοχή μπαίνει με την ταυτότητά της**, όχι με σημείο. `typed` = ό,τι
 * πληκτρολόγησε ο άνθρωπος (όταν η περιοχή ήρθε από το Enter): το παλιό σημείο με το ίδιο
 * κείμενο **αναβαθμίζεται** σε αυτήν την εγγραφή — ένας τόπος, μία γραμμή.
 */
export function rememberAreaSearch(area: { readonly id: string; readonly name: string }, now: number, typed?: string): void {
  const label = area.name.trim();
  if (label === '' || area.id === '') return;
  const entry: RecentAreaSearch = { kind: 'area', label, areaId: area.id, savedAt: now };
  rememberEntry(entry, supersededPointKeys(entry, typed));
}

/** Αφαίρεση μίας εγγραφής — με την **ταυτότητά** της, ώστε δύο ομώνυμες περιοχές να μη σβήνουν μαζί. */
export function forgetPlaceSearch(place: RecentPlaceSearch): void {
  const key = recentPlaceKey(place);
  if (isAccountPlaceSearchesActive()) forgetAccountPlaceSearch(key);
  else forgetDevicePlaceSearch(key);
}

/** «Καθαρισμός ιστορικού» — στον λογαριασμό σβήνει **και** στον server, σε κάθε συσκευή. */
export function clearPlaceSearches(): void {
  if (isAccountPlaceSearchesActive()) clearAccountPlaceSearches();
  else writeDevicePlaceSearches([]);
}
