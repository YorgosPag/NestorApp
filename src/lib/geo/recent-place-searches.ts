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
import type { RecentPlaceSearch } from './recent-place-searches-model';

export {
  NO_RECENT_PLACE_SEARCHES,
  RECENT_PLACE_SEARCHES_LIMIT,
  matchRecentPlaceSearches,
  placeSearchKey,
  withRecentPlaceSearch,
  withoutRecentPlaceSearch,
  type RecentPlaceSearch,
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

export function rememberPlaceSearch(label: string, center: GeoPoint, now: number): void {
  const trimmed = label.trim();
  if (trimmed === '') return;
  const entry: RecentPlaceSearch = { label: trimmed, center, savedAt: now };
  if (isAccountPlaceSearchesActive()) rememberAccountPlaceSearch(entry);
  else rememberDevicePlaceSearch(entry);
}

export function forgetPlaceSearch(label: string): void {
  if (isAccountPlaceSearchesActive()) forgetAccountPlaceSearch(label);
  else forgetDevicePlaceSearch(label);
}

/** «Καθαρισμός ιστορικού» — στον λογαριασμό σβήνει **και** στον server, σε κάθε συσκευή. */
export function clearPlaceSearches(): void {
  if (isAccountPlaceSearchesActive()) clearAccountPlaceSearches();
  else writeDevicePlaceSearches([]);
}
