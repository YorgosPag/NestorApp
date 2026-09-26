/**
 * ADR-882 Φάση 2 — το μοντέλο του ιστορικού του λογαριασμού: σύγκλιση, καμία ανάσταση,
 * όριο, ιδεμπότητα, παράθυρο υιοθεσίας.
 */

import {
  ACCOUNT_TOMBSTONES_LIMIT,
  EMPTY_ACCOUNT_PLACE_SEARCHES,
  GUEST_MERGE_WINDOW_MS,
  accountKeyOf,
  applyAccountPatch,
  clearAccountPatch,
  forgetAccountPatch,
  guestMergePatch,
  liveAccountPlaceSearches,
  parseAccountPlaceSearches,
  rememberAccountPatch,
  type AccountPatch,
  type AccountPlaceSearchState,
} from '../recent-place-searches-account-model';
import { RECENT_PLACE_SEARCHES_LIMIT, type RecentPlaceSearch } from '../recent-place-searches-model';

const CENTER = { lat: 37.98, lng: 23.73 };

function place(label: string, savedAt: number): RecentPlaceSearch {
  return { label, center: CENTER, savedAt };
}

function apply(state: AccountPlaceSearchState, patch: AccountPatch | null): AccountPlaceSearchState {
  return patch === null ? state : applyAccountPatch(state, patch);
}

function labels(state: AccountPlaceSearchState): string[] {
  return liveAccountPlaceSearches(state).map((p) => p.label);
}

describe('ανάγνωση εγγράφου', () => {
  it('χαλασμένα φύλλα πέφτουν· κλειδί που δεν είναι η ταυτότητα της ετικέτας απορρίπτεται', () => {
    const state = parseAccountPlaceSearches({
      entries: {
        'αθηνα': place('Αθήνα', 1),
        'ψεμα': place('Πάτρα', 2),
        'κακο': { label: 'Κακό', center: { lat: 999, lng: 0 }, savedAt: 3 },
      },
      tombstones: { 'x': 'όχι αριθμός', 'y': 4 },
      clearedAt: 'χθες',
    });
    expect(Object.keys(state.entries)).toEqual(['αθηνα']);
    expect(state.tombstones).toEqual({ y: 4 });
    expect(state.clearedAt).toBe(0);
  });

  it('απόν έγγραφο ⇒ άδεια κατάσταση', () => {
    expect(parseAccountPlaceSearches(null)).toBe(EMPTY_ACCOUNT_PLACE_SEARCHES);
  });
});

describe('κανόνας ανάγνωσης', () => {
  it('νεότερη πρώτη, έως το όριο', () => {
    let state = EMPTY_ACCOUNT_PLACE_SEARCHES;
    for (let i = 0; i < RECENT_PLACE_SEARCHES_LIMIT + 3; i += 1) {
      state = apply(state, rememberAccountPatch(state, place(`Τόπος ${i}`, i + 1)));
    }
    expect(labels(state)).toHaveLength(RECENT_PLACE_SEARCHES_LIMIT);
    expect(labels(state)[0]).toBe(`Τόπος ${RECENT_PLACE_SEARCHES_LIMIT + 2}`);
    // Το νοικοκυριό έσβησε στο έγγραφο ό,τι έπεσε εκτός ορίου.
    expect(Object.keys(state.entries)).toHaveLength(RECENT_PLACE_SEARCHES_LIMIT);
  });

  it('ίδια αναζήτηση με άλλους τόνους = μία γραμμή, με το νεότερο savedAt', () => {
    let state = apply(EMPTY_ACCOUNT_PLACE_SEARCHES, rememberAccountPatch(EMPTY_ACCOUNT_PLACE_SEARCHES, place('Αθήνα', 1)));
    state = apply(state, rememberAccountPatch(state, place('ΑΘΗΝΑ', 5)));
    expect(liveAccountPlaceSearches(state)).toEqual([place('ΑΘΗΝΑ', 5)]);
  });
});

describe('καμία ανάσταση (σύγκλιση ανεξάρτητη από τη σειρά)', () => {
  const seeded = apply(EMPTY_ACCOUNT_PLACE_SEARCHES, rememberAccountPatch(EMPTY_ACCOUNT_PLACE_SEARCHES, place('Αθήνα', 10)));

  it('διαγραφή σε συσκευή Α, παλιά γραφή από συσκευή Β χωρίς δίκτυο ⇒ μένει διαγραμμένη', () => {
    const stale = rememberAccountPatch(seeded, place('Αθήνα', 15));
    const forgotten = apply(seeded, forgetAccountPatch(seeded, 'Αθήνα', 20));
    // Η καθυστερημένη γραφή της Β φτάνει ΜΕΤΑ τη διαγραφή.
    expect(labels(apply(forgotten, stale))).toEqual([]);
  });

  it('καθαρισμός, και μετά παλιά γραφή ⇒ τίποτα· νέα αναζήτηση μετά τον καθαρισμό ⇒ ζει', () => {
    const cleared = apply(seeded, clearAccountPatch(20));
    expect(labels(apply(cleared, rememberAccountPatch(seeded, place('Πάτρα', 15))))).toEqual([]);
    expect(labels(apply(cleared, rememberAccountPatch(cleared, place('Πάτρα', 25))))).toEqual(['Πάτρα']);
  });

  it('διαγραμμένη αναζήτηση ξαναζεί αν ο άνθρωπος την ξαναψάξει, και η διαγραφή της ξεχνιέται', () => {
    const forgotten = apply(seeded, forgetAccountPatch(seeded, 'Αθήνα', 20));
    const again = apply(forgotten, rememberAccountPatch(forgotten, place('Αθήνα', 30)));
    expect(labels(again)).toEqual(['Αθήνα']);
    expect(again.tombstones).toEqual({});
  });

  it('οι διαγραφές δεν μεγαλώνουν απεριόριστα', () => {
    let state = seeded;
    for (let i = 0; i < ACCOUNT_TOMBSTONES_LIMIT + 5; i += 1) {
      state = apply(state, forgetAccountPatch(state, `Τόπος ${i}`, 100 + i));
    }
    expect(Object.keys(state.tombstones)).toHaveLength(ACCOUNT_TOMBSTONES_LIMIT);
  });
});

describe('υιοθεσία των αναζητήσεων της συσκευής στη σύνδεση', () => {
  const NOW = 10 * GUEST_MERGE_WINDOW_MS;

  it('ανεβαίνουν μόνο όσες έγιναν τις τελευταίες 24 ώρες (κοινή συσκευή)', () => {
    const guest = [place('Βόλος', NOW - 1000), place('Λάρισα', NOW - GUEST_MERGE_WINDOW_MS - 1)];
    const merged = apply(EMPTY_ACCOUNT_PLACE_SEARCHES, guestMergePatch(EMPTY_ACCOUNT_PLACE_SEARCHES, guest, NOW));
    expect(labels(merged)).toEqual(['Βόλος']);
  });

  it('ιδεμποτική: δεύτερη εκτέλεση δεν γράφει τίποτα', () => {
    const guest = [place('Βόλος', NOW - 1000)];
    const once = apply(EMPTY_ACCOUNT_PLACE_SEARCHES, guestMergePatch(EMPTY_ACCOUNT_PLACE_SEARCHES, guest, NOW));
    expect(guestMergePatch(once, guest, NOW)).toBeNull();
  });

  it('δεν γράφει πάνω από νεότερη εγγραφή του λογαριασμού, ούτε ανασταίνει διαγραμμένη', () => {
    let account = apply(EMPTY_ACCOUNT_PLACE_SEARCHES, rememberAccountPatch(EMPTY_ACCOUNT_PLACE_SEARCHES, place('Βόλος', NOW - 10)));
    account = apply(account, forgetAccountPatch(account, 'Λάρισα', NOW - 5));
    const guest = [place('ΒΟΛΟΣ', NOW - 1000), place('Λάρισα', NOW - 900)];
    expect(guestMergePatch(account, guest, NOW)).toBeNull();
  });
});

describe('ταυτότητα ως όνομα πεδίου', () => {
  it('απορρίπτει κενό, δεσμευμένο και υπερβολικά μακρύ κείμενο', () => {
    expect(accountKeyOf('   ')).toBeNull();
    expect(accountKeyOf('__name__')).toBeNull();
    expect(accountKeyOf('α'.repeat(201))).toBeNull();
    expect(accountKeyOf('Νέα Σμύρνη')).toBe('νεα σμυρνη');
  });
});
