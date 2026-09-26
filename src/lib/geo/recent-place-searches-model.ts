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
 * αποτελέσματα, **χωρίς** δεύτερη κλήση στον geocoder. Οι **περιοχές** (Φάση 3, §3.7) κρατούν
 * αντί για κέντρο την **ταυτότητά** τους — το όριο είναι ήδη γνωστό, και ξαναδιαβάζεται φρέσκο.
 *
 * 🔒 **Η θέση GPS του ανθρώπου ΔΕΝ γράφεται ποτέ** — εδώ ζουν μόνο κέντρα **περιοχών που
 * πληκτρολόγησε**.
 */

import type { GeoPoint } from '@/types/geo/coordinates';

/**
 * **Αναζήτηση ΣΗΜΕΙΟΥ** — οδός, POI, ό,τι εντόπισε ο geocoder. Χωρίς `kind` (το σχήμα της
 * Φάσης 1/2 αυτούσιο): οι εγγραφές που ήδη υπάρχουν σε δίσκο και λογαριασμό **είναι** σημεία.
 */
export interface RecentPointSearch {
  readonly kind?: 'point';
  /** Ό,τι έγραψε ο άνθρωπος — αναγνωρίζει τις δικές του λέξεις (το Zillow δείχνει «NY»). */
  readonly label: string;
  /** Το κέντρο που επέστρεψε ο geocoder για αυτό το κείμενο. */
  readonly center: GeoPoint;
  /** ms από epoch — για τη σειρά και για τη συγχώνευση συσκευής ↔ λογαριασμού. */
  readonly savedAt: number;
}

/**
 * **Αναζήτηση ΠΕΡΙΟΧΗΣ** (ADR-882 §3.7 × ADR-883) — «Βόλος», «Π.Ε. Θεσσαλονίκης».
 *
 * 🔑 **Ταυτότητα, ΟΧΙ γεωμετρία** (Google Place ID · Zillow `regionId` · Rightmove `REGION^…`):
 * κρατάμε το `areaId` και το όνομα της στιγμής· το **όριο** ξαναδιαβάζεται στην επανεπιλογή,
 * ώστε ποτέ να μη δείξουμε μπαγιάτικο σχήμα. Ούτε το `adminId` της στιγμής: εξαρτάται από τη
 * λειτουργία (`boundaryOwnerId` — οικισμός ⇒ ο γονέας για τους επαγγελματίες).
 */
export interface RecentAreaSearch {
  readonly kind: 'area';
  /** Το επίσημο όνομα τη στιγμή της αναζήτησης — ό,τι έδειξε και το πεδίο. */
  readonly label: string;
  /** Η ταυτότητα στο ευρετήριο περιοχών (`municipality:0708`). */
  readonly areaId: string;
  readonly savedAt: number;
}

export type RecentPlaceSearch = RecentPointSearch | RecentAreaSearch;

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

/** Όσο μπορεί να είναι ένα αναγνωριστικό περιοχής — πιο μακρύ δεν είναι δικό μας. */
const AREA_ID_MAX_LENGTH = 64;

function toRecentArea(label: string, savedAt: number, areaId: unknown): RecentAreaSearch | null {
  if (typeof areaId !== 'string' || areaId === '' || areaId.length > AREA_ID_MAX_LENGTH) return null;
  return { kind: 'area', label, areaId, savedAt };
}

/** Ό,τι κι αν ήρθε (δίσκος ή Firestore) → έγκυρη εγγραφή, ή `null`. Ποτέ δεν ρίχνει. */
export function toRecentPlace(value: unknown): RecentPlaceSearch | null {
  if (typeof value !== 'object' || value === null) return null;
  const { kind, label, center, savedAt, areaId } = value as Record<string, unknown>;
  if (typeof label !== 'string' || label.trim() === '') return null;
  if (typeof savedAt !== 'number' || !Number.isFinite(savedAt)) return null;
  if (kind === 'area') return toRecentArea(label, savedAt, areaId);
  if (kind !== undefined && kind !== 'point') return null;
  if (typeof center !== 'object' || center === null) return null;
  const { lat, lng } = center as Record<string, unknown>;
  if (!isFiniteCoordinate(lat, 90) || !isFiniteCoordinate(lng, 180)) return null;
  return { label, center: { lat, lng }, savedAt };
}

/**
 * **Η ταυτότητα μιας εγγραφής** — η ΜΙΑ απάντηση στο «είναι η ίδια αναζήτηση;» για συσκευή,
 * λογαριασμό, αφαίρεση και υιοθεσία.
 *
 * - σημείο → οι λέξεις του (`placeSearchKey`): «Αθήνα» = «αθηνα».
 * - περιοχή → `area:<id>`: δύο «Καλλιθέα» (Αττική, Χαλκιδική) μένουν **δύο** — το όνομα
 *   συγκρούεται, η ταυτότητα όχι.
 *
 * 🔑 Το κλειδί είναι **σταθερό σημείο** του `placeSearchKey` (τα ids είναι ASCII πεζά) ⇒ όποιος
 * κανονικοποιήσει ξανά ένα κλειδί παίρνει το ίδιο κλειδί.
 */
export function recentPlaceKey(place: RecentPlaceSearch): string {
  return place.kind === 'area' ? placeSearchKey(`area:${place.areaId}`) : placeSearchKey(place.label);
}

/**
 * **Ποιες εγγραφές-σημεία ΑΝΤΙΚΑΘΙΣΤΑ μια περιοχή** — η αναβάθμιση «Βόλος» (σημείο, πριν το
 * ADR-883) → «ΔΗΜΟΣ ΒΟΛΟΥ» (περιοχή). Χωρίς αυτό το ιστορικό θα έδειχνε τον ίδιο τόπο δύο
 * φορές. `typed` = ό,τι έγραψε ο άνθρωπος, όταν η περιοχή ήρθε από πληκτρολόγηση.
 */
export function supersededPointKeys(place: RecentPlaceSearch, typed?: string): readonly string[] {
  if (place.kind !== 'area') return [];
  const keys = [placeSearchKey(place.label), placeSearchKey(typed ?? '')].filter((key) => key !== '');
  return [...new Set(keys)];
}

/**
 * Η νέα μπαίνει **πρώτη**· η παλιά ίδια εγγραφή φεύγει (ιδεμποτότητα: δύο φορές = μία) — και
 * όσα σημεία αντικαθιστά (`superseded`, μόνο σημεία: μια περιοχή δεν σβήνει ποτέ άλλη περιοχή).
 */
export function withRecentPlaceSearch(
  list: readonly RecentPlaceSearch[],
  entry: RecentPlaceSearch,
  superseded: readonly string[] = [],
): RecentPlaceSearch[] {
  const key = recentPlaceKey(entry);
  const replaced = new Set(superseded);
  const rest = list.filter(
    (place) => recentPlaceKey(place) !== key && !(place.kind !== 'area' && replaced.has(recentPlaceKey(place))),
  );
  return [entry, ...rest].slice(0, RECENT_PLACE_SEARCHES_LIMIT);
}

/** Αφαίρεση με **κλειδί** (`recentPlaceKey`) — δέχεται και ετικέτα σημείου (ίδια κανονικοποίηση). */
export function withoutRecentPlaceSearch(
  list: readonly RecentPlaceSearch[],
  key: string,
): RecentPlaceSearch[] {
  const normalized = placeSearchKey(key);
  return list.filter((place) => recentPlaceKey(place) !== normalized);
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
