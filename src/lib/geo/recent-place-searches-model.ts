/**
 * **Το μοντέλο του ιστορικού αναζητήσεων τόπου** — καθαρές συναρτήσεις, χωρίς Ι/Ο (ADR-882).
 *
 * Κοινό λεξιλόγιο των **δύο** αποθηκών: της συσκευής (`recent-place-searches-device`, ο
 * ανώνυμος) και του λογαριασμού (`recent-place-searches-account`, ο συνδεδεμένος). Μία
 * ταυτότητα (`placeSearchKey`), ένας επικυρωτής (`toRecentPlace`), ένα όριο — αλλιώς οι δύο
 * αποθήκες θα διαφωνούσαν για το «είναι η ίδια αναζήτηση;».
 *
 * 🏆 **ΤΙ ΚΡΑΤΑΜΕ ΠΕΡΙΣΣΟΤΕΡΟ ΑΠΟ ΤΟ ZILLOW: ΤΗΝ ΑΠΑΝΤΗΣΗ, ΟΧΙ ΜΟΝΟ ΤΗΝ ΕΡΩΤΗΣΗ.** Κάθε
 * εγγραφή κουβαλά το **κέντρο που ήδη εντοπίστηκε** ⇒ η επανεπιλογή πηγαίνει κατευθείαν στα
 * αποτελέσματα, **χωρίς** δεύτερη κλήση στον geocoder.
 *
 * 🔒 **Η θέση GPS του ανθρώπου ΔΕΝ γράφεται ποτέ** — εδώ ζουν μόνο κέντρα **περιοχών που
 * πληκτρολόγησε**.
 */

import type { GeoPoint } from '@/types/geo/coordinates';

export interface RecentPlaceSearch {
  /** Ό,τι έγραψε ο άνθρωπος — αναγνωρίζει τις δικές του λέξεις (το Zillow δείχνει «NY»). */
  readonly label: string;
  /** Το κέντρο που επέστρεψε ο geocoder για αυτό το κείμενο. */
  readonly center: GeoPoint;
  /** ms από epoch — για τη σειρά και για τη συγχώνευση συσκευής ↔ λογαριασμού. */
  readonly savedAt: number;
}

/** Όσες χωρούν στη λίστα χωρίς κύλιση — το Google Maps/Zillow μένουν σε μονοψήφιο πλήθος. */
export const RECENT_PLACE_SEARCHES_LIMIT = 8;

/**
 * **Στιγμιότυπο «κανένα» με σταθερή ταυτότητα** για το `useSyncExternalStore`: ένας νέος
 * πίνακας σε κάθε ανάγνωση θα ήταν ατέρμονος βρόχος απόδοσης (ADR-040/366).
 */
export const NO_RECENT_PLACE_SEARCHES: readonly RecentPlaceSearch[] = Object.freeze([]);

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

/** Ό,τι κι αν ήρθε (δίσκος ή Firestore) → έγκυρη εγγραφή, ή `null`. Ποτέ δεν ρίχνει. */
export function toRecentPlace(value: unknown): RecentPlaceSearch | null {
  if (typeof value !== 'object' || value === null) return null;
  const { label, center, savedAt } = value as Record<string, unknown>;
  if (typeof label !== 'string' || label.trim() === '') return null;
  if (typeof savedAt !== 'number' || !Number.isFinite(savedAt)) return null;
  if (typeof center !== 'object' || center === null) return null;
  const { lat, lng } = center as Record<string, unknown>;
  if (!isFiniteCoordinate(lat, 90) || !isFiniteCoordinate(lng, 180)) return null;
  return { label, center: { lat, lng }, savedAt };
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
