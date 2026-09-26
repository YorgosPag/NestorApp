/**
 * @jest-environment jsdom
 *
 * ADR-882 §3.7 — οι αναζητήσεις ΠΕΡΙΟΧΗΣ στο ιστορικό: σχήμα, ταυτότητα (`area:<id>`),
 * αναβάθμιση σημείου → περιοχής, συμβατότητα με τις παλιές εγγραφές, συσκευή ΚΑΙ λογαριασμός.
 */

import {
  forgetPlaceSearch,
  parseRecentPlaceSearches,
  readRecentPlaceSearches,
  recentPlaceKey,
  rememberAreaSearch,
  rememberPlaceSearch,
  withRecentPlaceSearch,
  type RecentAreaSearch,
  type RecentPlaceSearch,
} from '../recent-place-searches';
import { supersededPointKeys, toRecentPlace } from '../recent-place-searches-model';
import {
  EMPTY_ACCOUNT_PLACE_SEARCHES,
  applyAccountPatch,
  forgetAccountPatch,
  guestMergePatch,
  liveAccountPlaceSearches,
  parseAccountPlaceSearches,
  rememberAccountPatch,
  type AccountPlaceSearchState,
} from '../recent-place-searches-account-model';
import { STORAGE_KEYS } from '@/lib/storage';

const CENTER = { lat: 39.36, lng: 22.94 };
const VOLOS = { id: 'municipality:0801', name: 'ΔΗΜΟΣ ΒΟΛΟΥ' };

function area(areaId: string, label: string, savedAt: number): RecentAreaSearch {
  return { kind: 'area', label, areaId, savedAt };
}

function point(label: string, savedAt: number): RecentPlaceSearch {
  return { label, center: CENTER, savedAt };
}

beforeEach(() => window.localStorage.clear());

describe('σχήμα και επικύρωση', () => {
  it('η περιοχή διαβάζεται ΧΩΡΙΣ κέντρο· το παλιό σημείο (χωρίς `kind`) διαβάζεται αυτούσιο', () => {
    expect(toRecentPlace(area('municipality:1', 'ΔΗΜΟΣ Α', 1))).toEqual(area('municipality:1', 'ΔΗΜΟΣ Α', 1));
    expect(toRecentPlace(point('Βόλος', 1))).toEqual(point('Βόλος', 1));
  });

  it.each([
    ['χωρίς areaId', { kind: 'area', label: 'Χ', savedAt: 1 }],
    ['κενό areaId', { kind: 'area', label: 'Χ', areaId: '', savedAt: 1 }],
    ['άγνωστο είδος', { kind: 'polygon', label: 'Χ', center: CENTER, savedAt: 1 }],
  ])('%s ⇒ απορρίπτεται', (_name, raw) => {
    expect(toRecentPlace(raw)).toBeNull();
  });
});

describe('ταυτότητα', () => {
  it('🔑 δύο ομώνυμες περιοχές είναι ΔΥΟ εγγραφές — η ταυτότητα είναι το id, όχι το όνομα', () => {
    const list = withRecentPlaceSearch([area('community:1', 'ΚΑΛΛΙΘΕΑ', 1)], area('community:2', 'ΚΑΛΛΙΘΕΑ', 2));
    expect(list.map(recentPlaceKey)).toEqual(['area:community:2', 'area:community:1']);
  });

  it('ίδια περιοχή δύο φορές ⇒ μία, η νεότερη πρώτη (ιδεμπότητα)', () => {
    const once = withRecentPlaceSearch([area('community:1', 'Α', 1)], area('community:1', 'Α', 5));
    expect(once).toEqual([area('community:1', 'Α', 5)]);
  });

  it('το κλειδί είναι σταθερό σημείο της κανονικοποίησης (δέχεται ξανά τον εαυτό του)', () => {
    const key = recentPlaceKey(area('municipality:0801', 'Χ', 1));
    expect(recentPlaceKey(point(key, 1))).toBe(key);
  });
});

describe('αναβάθμιση σημείου → περιοχής', () => {
  it('🔑 «Βόλος» (σημείο) φεύγει όταν μπαίνει η περιοχή που πληκτρολογήθηκε ως «Βόλος»', () => {
    const entry = area(VOLOS.id, VOLOS.name, 2);
    const list = withRecentPlaceSearch([point('Βόλος', 1), point('Λάρισα', 1)], entry, supersededPointKeys(entry, 'βολος'));
    expect(list.map((p) => p.label)).toEqual([VOLOS.name, 'Λάρισα']);
  });

  it('μια περιοχή ΔΕΝ σβήνει ποτέ άλλη περιοχή, και ένα σημείο δεν αντικαθιστά τίποτα', () => {
    const entry = area('community:2', 'ΚΑΛΛΙΘΕΑ', 2);
    const list = withRecentPlaceSearch([area('community:1', 'ΚΑΛΛΙΘΕΑ', 1)], entry, supersededPointKeys(entry, 'Καλλιθέα'));
    expect(list).toHaveLength(2);
    expect(supersededPointKeys(point('Βόλος', 1), 'Βόλος')).toEqual([]);
  });
});

describe('συσκευή (ανώνυμος)', () => {
  it('γράφει την περιοχή, την ξαναδιαβάζει, και την ξεχνά με την ταυτότητά της', () => {
    rememberPlaceSearch('Βόλος', CENTER, 1);
    rememberAreaSearch(VOLOS, 2, 'Βόλος');
    const stored = readRecentPlaceSearches();
    expect(stored).toEqual([area(VOLOS.id, VOLOS.name, 2)]);
    forgetPlaceSearch(stored[0]);
    expect(readRecentPlaceSearches()).toEqual([]);
  });

  it('συνυπάρχει με παλιές εγγραφές στον δίσκο (ίδια έκδοση 1, καμία μετάβαση)', () => {
    window.localStorage.setItem(
      STORAGE_KEYS.RECENT_PLACE_SEARCHES,
      JSON.stringify({ version: 1, entries: [point('Αθήνα', 1)] }),
    );
    rememberAreaSearch(VOLOS, 2);
    expect(readRecentPlaceSearches().map((p) => p.label)).toEqual([VOLOS.name, 'Αθήνα']);
    expect(parseRecentPlaceSearches({ version: 1, entries: [area('a:1', 'Α', 1), area('a:1', 'Α', 1)] })).toHaveLength(1);
  });
});

describe('λογαριασμός (LWW ανά εγγραφή)', () => {
  const apply = (state: AccountPlaceSearchState, patch: ReturnType<typeof rememberAccountPatch>) =>
    patch === null ? state : applyAccountPatch(state, patch);

  it('η περιοχή ζει με κλειδί `area:<id>` και περνά τον έλεγχο ακεραιότητας στην ανάγνωση', () => {
    const state = apply(EMPTY_ACCOUNT_PLACE_SEARCHES, rememberAccountPatch(EMPTY_ACCOUNT_PLACE_SEARCHES, area(VOLOS.id, VOLOS.name, 1)));
    expect(Object.keys(state.entries)).toEqual([`area:${VOLOS.id}`]);
    const reread = parseAccountPlaceSearches({ entries: state.entries, tombstones: {}, clearedAt: 0 });
    expect(liveAccountPlaceSearches(reread)).toEqual([area(VOLOS.id, VOLOS.name, 1)]);
    // Κλειδί που ΔΕΝ είναι η ταυτότητα της εγγραφής ⇒ απορρίπτεται.
    expect(liveAccountPlaceSearches(parseAccountPlaceSearches({ entries: { 'δημος βολου': area(VOLOS.id, VOLOS.name, 1) } }))).toEqual([]);
  });

  it('🔑 η αναβάθμιση ΘΑΒΕΙ το σημείο — άλλη συσκευή που το κρατά δεν μπορεί να το αναστήσει', () => {
    let state = apply(EMPTY_ACCOUNT_PLACE_SEARCHES, rememberAccountPatch(EMPTY_ACCOUNT_PLACE_SEARCHES, point('Βόλος', 1)));
    const entry = area(VOLOS.id, VOLOS.name, 5);
    state = apply(state, rememberAccountPatch(state, entry, supersededPointKeys(entry, 'Βόλος')));
    expect(liveAccountPlaceSearches(state)).toEqual([entry]);
    expect(state.tombstones.βολος).toBe(5);
    // Η παλιά συσκευή (ίδιο σημείο, παλαιότερο) υιοθετείται στη σύνδεση — και ΔΕΝ ξαναγυρίζει.
    expect(guestMergePatch(state, [point('Βόλος', 3)], 6)).toBeNull();
  });

  it('η αφαίρεση με την ταυτότητα σβήνει ΜΟΝΟ τη μία από δύο ομώνυμες', () => {
    let state = EMPTY_ACCOUNT_PLACE_SEARCHES;
    state = apply(state, rememberAccountPatch(state, area('community:1', 'ΚΑΛΛΙΘΕΑ', 1)));
    state = apply(state, rememberAccountPatch(state, area('community:2', 'ΚΑΛΛΙΘΕΑ', 2)));
    state = apply(state, forgetAccountPatch(state, recentPlaceKey(area('community:1', 'ΚΑΛΛΙΘΕΑ', 1)), 3));
    expect(liveAccountPlaceSearches(state).map(recentPlaceKey)).toEqual(['area:community:2']);
  });

  it('η υιοθεσία στη σύνδεση ανεβάζει και τις περιοχές της συσκευής', () => {
    const patch = guestMergePatch(EMPTY_ACCOUNT_PLACE_SEARCHES, [area(VOLOS.id, VOLOS.name, 100)], 200);
    expect(patch?.put).toEqual({ [`area:${VOLOS.id}`]: area(VOLOS.id, VOLOS.name, 100) });
  });
});
