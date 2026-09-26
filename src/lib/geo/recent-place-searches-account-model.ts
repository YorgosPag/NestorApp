/**
 * **Το μοντέλο του ιστορικού ΤΟΥ ΛΟΓΑΡΙΑΣΜΟΥ** — καθαρές συναρτήσεις (ADR-882 Φάση 2).
 *
 * @related `recent-place-searches-account` (η αποθήκη + η σύνδεση) ·
 *          `recent-place-searches-account-transport` (το Firestore)
 *
 * 🏆 **ΓΙΑΤΙ ΟΧΙ «ΓΡΑΨΕ ΟΛΗ ΤΗ ΛΙΣΤΑ»** (η συνηθισμένη λύση): δύο συσκευές που γράφουν
 * ταυτόχρονα θα έσβηναν η μία τη δουλειά της άλλης, και μια παλιά γραφή από συσκευή χωρίς
 * δίκτυο θα ανάσταινε ό,τι σβήστηκε αλλού. Εδώ το έγγραφο είναι **σύνολο «κερδίζει ο
 * νεότερος» ΑΝΑ ΕΓΓΡΑΦΗ** (LWW-element-set):
 *
 * - `entries[k]`    — η αναζήτηση με ταυτότητα `k` (`placeSearchKey`), με το `savedAt` της.
 * - `tombstones[k]` — «ο άνθρωπος τη διέγραψε τη στιγμή Τ».
 * - `clearedAt`     — «καθάρισε ΟΛΟ το ιστορικό τη στιγμή Τ».
 *
 * 🔑 **Ο κανόνας ανάγνωσης είναι ο ΜΟΝΟΣ κριτής**: μια εγγραφή ζει ανν
 * `savedAt > max(tombstones[k], clearedAt)`. Επειδή δεν εξαρτάται από τη ΣΕΙΡΑ των γραφών,
 * όλες οι συσκευές συγκλίνουν στο ίδιο αποτέλεσμα — και μια καθυστερημένη γραφή **δεν μπορεί
 * δομικά** να αναστήσει διαγραμμένη αναζήτηση. Κάθε γραφή αγγίζει μόνο τα δικά της φύλλα.
 *
 * ⚠️ Το `savedAt` είναι το ρολόι της συσκευής: συσκευή με ρολόι μπροστά κερδίζει. Αποδεκτό
 * για ιστορικό (το χειρότερο: λάθος σειρά σε μία γραμμή)· το `serverTimestamp()` δεν θα
 * μπορούσε να συγκριθεί χωρίς δίκτυο.
 */

import {
  RECENT_PLACE_SEARCHES_LIMIT,
  placeSearchKey,
  toRecentPlace,
  type RecentPlaceSearch,
} from './recent-place-searches-model';

export const ACCOUNT_PLACE_SEARCHES_SCHEMA_VERSION = 1;

/**
 * 🔒 **Κοινή συσκευή**: στη σύνδεση ανεβαίνουν στον λογαριασμό μόνο όσες αναζητήσεις της
 * συσκευής έγιναν τις τελευταίες 24 ώρες — όχι όσα έψαξε ο προηγούμενος ανώνυμος άνθρωπος
 * την περασμένη εβδομάδα στον ίδιο υπολογιστή (απόφαση Giorgio, 2026-09-26).
 */
export const GUEST_MERGE_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Όσες διαγραφές χρειάζεται να θυμόμαστε — οι παλαιότερες δεν αντιστοιχούν πια σε τίποτα. */
export const ACCOUNT_TOMBSTONES_LIMIT = 16;

/** Όνομα πεδίου Firestore: ≤1500 bytes και όχι `__x__`. Πιο μακρύ κείμενο δεν είναι τόπος. */
const ACCOUNT_KEY_MAX_LENGTH = 200;
const RESERVED_FIELD_NAME = /^__.*__$/;

export interface AccountPlaceSearchState {
  readonly entries: Readonly<Record<string, RecentPlaceSearch>>;
  readonly tombstones: Readonly<Record<string, number>>;
  readonly clearedAt: number;
}

export const EMPTY_ACCOUNT_PLACE_SEARCHES: AccountPlaceSearchState = Object.freeze({
  entries: Object.freeze({}),
  tombstones: Object.freeze({}),
  clearedAt: 0,
});

/**
 * **Η πράξη, πριν γίνει Firestore** — η μεταφορά τη μεταφράζει σε φύλλα `merge`. Ίδια
 * αναπαράσταση εφαρμόζεται και τοπικά (`applyAccountPatch`), ώστε η οθόνη να αλλάζει αμέσως.
 */
export interface AccountPatch {
  readonly put: Readonly<Record<string, RecentPlaceSearch>>;
  readonly drop: readonly string[];
  readonly tomb: Readonly<Record<string, number>>;
  readonly untomb: readonly string[];
  /** Παρόν ⇒ «καθαρισμός»: σβήνει ΟΛΑ τα `entries` και `tombstones`. */
  readonly clearedAt?: number;
}

/** Η ταυτότητα ως όνομα πεδίου — ή `null` όταν το κείμενο δεν μπορεί να γίνει πεδίο. */
export function accountKeyOf(label: string): string | null {
  const key = placeSearchKey(label);
  if (key === '' || key.length > ACCOUNT_KEY_MAX_LENGTH || RESERVED_FIELD_NAME.test(key)) return null;
  return key;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function parseEntries(raw: unknown): Record<string, RecentPlaceSearch> {
  const entries: Record<string, RecentPlaceSearch> = {};
  if (typeof raw !== 'object' || raw === null) return entries;
  for (const [key, value] of Object.entries(raw)) {
    const place = toRecentPlace(value);
    // Ακεραιότητα: το κλειδί ΠΡΕΠΕΙ να είναι η ταυτότητα της ετικέτας του.
    if (place !== null && accountKeyOf(place.label) === key) entries[key] = place;
  }
  return entries;
}

function parseTombstones(raw: unknown): Record<string, number> {
  const tombstones: Record<string, number> = {};
  if (typeof raw !== 'object' || raw === null) return tombstones;
  for (const [key, value] of Object.entries(raw)) {
    if (isFiniteNumber(value)) tombstones[key] = value;
  }
  return tombstones;
}

/** Ό,τι κι αν ήρθε από το Firestore → έγκυρη κατάσταση. Χαλασμένο φύλλο πέφτει σιωπηλά. */
export function parseAccountPlaceSearches(raw: unknown): AccountPlaceSearchState {
  if (typeof raw !== 'object' || raw === null) return EMPTY_ACCOUNT_PLACE_SEARCHES;
  const doc = raw as Record<string, unknown>;
  return {
    entries: parseEntries(doc.entries),
    tombstones: parseTombstones(doc.tombstones),
    clearedAt: isFiniteNumber(doc.clearedAt) ? doc.clearedAt : 0,
  };
}

/** Η στιγμή πριν από την οποία η εγγραφή `key` είναι νεκρή. */
function horizonOf(state: AccountPlaceSearchState, key: string): number {
  return Math.max(state.tombstones[key] ?? Number.NEGATIVE_INFINITY, state.clearedAt);
}

function liveKeys(state: AccountPlaceSearchState): string[] {
  return Object.keys(state.entries)
    .filter((key) => state.entries[key].savedAt > horizonOf(state, key))
    .sort((a, b) => state.entries[b].savedAt - state.entries[a].savedAt)
    .slice(0, RECENT_PLACE_SEARCHES_LIMIT);
}

/** **Ο κανόνας ανάγνωσης** — νεότερη πρώτη, μόνο ζωντανές, έως το όριο. */
export function liveAccountPlaceSearches(state: AccountPlaceSearchState): RecentPlaceSearch[] {
  return liveKeys(state).map((key) => state.entries[key]);
}

export function applyAccountPatch(
  state: AccountPlaceSearchState,
  patch: AccountPatch,
): AccountPlaceSearchState {
  const cleared = patch.clearedAt !== undefined;
  const entries: Record<string, RecentPlaceSearch> = cleared ? {} : { ...state.entries };
  const tombstones: Record<string, number> = cleared ? {} : { ...state.tombstones };
  for (const key of patch.drop) delete entries[key];
  for (const key of patch.untomb) delete tombstones[key];
  Object.assign(entries, patch.put);
  Object.assign(tombstones, patch.tomb);
  const clearedAt = cleared ? Math.max(state.clearedAt, patch.clearedAt ?? 0) : state.clearedAt;
  return { entries, tombstones, clearedAt };
}

/**
 * **Νοικοκυριό** μετά από κάθε πράξη: ό,τι δεν είναι πια ορατό (νεκρό ή πέρα από το όριο)
 * σβήνεται, και οι διαγραφές περιορίζονται. Ιδεμποτικό — δεύτερη εφαρμογή δεν βρίσκει τίποτα.
 */
function housekeeping(state: AccountPlaceSearchState): Pick<AccountPatch, 'drop' | 'untomb'> {
  const live = new Set(liveKeys(state));
  const drop = Object.keys(state.entries).filter((key) => !live.has(key));
  const untomb = Object.keys(state.tombstones)
    .sort((a, b) => state.tombstones[b] - state.tombstones[a])
    .filter((key, index) => index >= ACCOUNT_TOMBSTONES_LIMIT || state.tombstones[key] <= state.clearedAt);
  return { drop, untomb };
}

function withHousekeeping(state: AccountPlaceSearchState, base: AccountPatch): AccountPatch {
  const after = housekeeping(applyAccountPatch(state, base));
  const drop = new Set([...base.drop, ...after.drop]);
  // Ό,τι μπαίνει και αμέσως πέφτει πέρα από το όριο δεν γράφεται καθόλου — ποτέ set ΚΑΙ delete.
  const put = Object.fromEntries(Object.entries(base.put).filter(([key]) => !drop.has(key)));
  return {
    ...base,
    put,
    drop: [...drop],
    untomb: [...new Set([...base.untomb, ...after.untomb])],
  };
}

export function isEmptyAccountPatch(patch: AccountPatch): boolean {
  return patch.clearedAt === undefined
    && Object.keys(patch.put).length === 0 && patch.drop.length === 0
    && Object.keys(patch.tomb).length === 0 && patch.untomb.length === 0;
}

/** Νέα αναζήτηση: ζωντανεύει ακόμη κι αν είχε διαγραφεί (νεότερο `savedAt` από τη διαγραφή). */
export function rememberAccountPatch(
  state: AccountPlaceSearchState,
  entry: RecentPlaceSearch,
): AccountPatch | null {
  const key = accountKeyOf(entry.label);
  if (key === null) return null;
  const untomb = key in state.tombstones ? [key] : [];
  return withHousekeeping(state, { put: { [key]: entry }, drop: [], tomb: {}, untomb });
}

export function forgetAccountPatch(
  state: AccountPlaceSearchState,
  label: string,
  now: number,
): AccountPatch | null {
  const key = accountKeyOf(label);
  if (key === null) return null;
  const drop = key in state.entries ? [key] : [];
  return withHousekeeping(state, { put: {}, drop, tomb: { [key]: now }, untomb: [] });
}

export function clearAccountPatch(now: number): AccountPatch {
  return { put: {}, drop: [], tomb: {}, untomb: [], clearedAt: now };
}

/** Οι αναζητήσεις της συσκευής που **υιοθετεί** ο λογαριασμός στη σύνδεση (παράθυρο 24 ωρών). */
export function guestEntriesToAdopt(
  guest: readonly RecentPlaceSearch[],
  now: number,
): RecentPlaceSearch[] {
  return guest.filter((place) => place.savedAt >= now - GUEST_MERGE_WINDOW_MS && accountKeyOf(place.label) !== null);
}

/**
 * **Συγχώνευση στη σύνδεση** — ιδεμποτική: ανεβαίνει μόνο ό,τι είναι ΝΕΟΤΕΡΟ από την
 * εγγραφή του λογαριασμού και από κάθε διαγραφή του. Δεύτερη εκτέλεση ⇒ `null`.
 */
export function guestMergePatch(
  state: AccountPlaceSearchState,
  guest: readonly RecentPlaceSearch[],
  now: number,
): AccountPatch | null {
  const put: Record<string, RecentPlaceSearch> = {};
  for (const place of guestEntriesToAdopt(guest, now)) {
    const key = accountKeyOf(place.label) as string;
    const current = put[key]?.savedAt ?? state.entries[key]?.savedAt ?? Number.NEGATIVE_INFINITY;
    if (place.savedAt > current && place.savedAt > horizonOf(state, key)) put[key] = place;
  }
  if (Object.keys(put).length === 0) return null;
  return withHousekeeping(state, { put, drop: [], tomb: {}, untomb: [] });
}
