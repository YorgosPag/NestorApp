/**
 * @jest-environment jsdom
 *
 * ADR-882 — το ιστορικό αναζητήσεων τόπου: ταυτότητα, σειρά, όριο, ανθεκτικότητα, Ι/Ο.
 */

import {
  RECENT_PLACE_SEARCHES_LIMIT,
  clearPlaceSearches,
  forgetPlaceSearch,
  getRecentPlaceSearchesSnapshot,
  matchRecentPlaceSearches,
  parseRecentPlaceSearches,
  placeSearchKey,
  readRecentPlaceSearches,
  rememberPlaceSearch,
  subscribeRecentPlaceSearches,
  withRecentPlaceSearch,
  type RecentPlaceSearch,
} from '../recent-place-searches';
import { STORAGE_KEYS } from '@/lib/storage';

const ATHENS = { lat: 37.98, lng: 23.73 };
const THESSALONIKI = { lat: 40.64, lng: 22.94 };

function place(label: string, savedAt = 1): RecentPlaceSearch {
  return { label, center: ATHENS, savedAt };
}

beforeEach(() => window.localStorage.clear());

describe('ταυτότητα εγγραφής', () => {
  it('αγνοεί τόνους, πεζά/κεφαλαία και κενά', () => {
    expect(placeSearchKey('  ΑΘΉΝΑ ')).toBe(placeSearchKey('αθηνα'));
    expect(placeSearchKey('Νέα   Σμύρνη')).toBe('νεα σμυρνη');
  });
});

describe('καθαρές πράξεις', () => {
  it('η νέα μπαίνει πρώτη και η ίδια δεν διπλασιάζεται (ιδεμπότητα)', () => {
    const once = withRecentPlaceSearch([place('Πάτρα'), place('Αθήνα')], place('αθηνα', 2));
    expect(once.map((p) => p.label)).toEqual(['αθηνα', 'Πάτρα']);
    expect(withRecentPlaceSearch(once, place('αθηνα', 2))).toEqual(once);
  });

  it(`κρατά το πολύ ${RECENT_PLACE_SEARCHES_LIMIT}`, () => {
    let list: RecentPlaceSearch[] = [];
    for (let i = 0; i < RECENT_PLACE_SEARCHES_LIMIT + 3; i++) {
      list = withRecentPlaceSearch(list, place(`τόπος ${i}`, i));
    }
    expect(list).toHaveLength(RECENT_PLACE_SEARCHES_LIMIT);
    expect(list[0].label).toBe(`τόπος ${RECENT_PLACE_SEARCHES_LIMIT + 2}`);
  });

  it('φιλτράρει χωρίς τόνους· κενό φίλτρο = όλη η λίστα', () => {
    const list = [place('Θεσσαλονίκη'), place('Αθήνα')];
    expect(matchRecentPlaceSearches(list, 'θεσ').map((p) => p.label)).toEqual(['Θεσσαλονίκη']);
    expect(matchRecentPlaceSearches(list, '  ')).toBe(list);
  });
});

describe('ανθεκτικότητα στον δίσκο', () => {
  it.each([
    ['null', null],
    ['λάθος έκδοση', { version: 99, entries: [place('Αθήνα')] }],
    ['όχι πίνακας', { version: 1, entries: 'x' }],
  ])('%s ⇒ άδειο, ποτέ εξαίρεση', (_name, raw) => {
    expect(parseRecentPlaceSearches(raw)).toEqual([]);
  });

  it('πετά μόνο τις χαλασμένες εγγραφές', () => {
    const raw = {
      version: 1,
      entries: [
        place('Αθήνα'),
        { label: '', center: ATHENS, savedAt: 1 },
        { label: 'Άκυρη', center: { lat: 200, lng: 0 }, savedAt: 1 },
        { label: 'Χωρίς κέντρο', savedAt: 1 },
      ],
    };
    expect(parseRecentPlaceSearches(raw).map((p) => p.label)).toEqual(['Αθήνα']);
  });

  it('χαλασμένο JSON στον δίσκο ⇒ άδειο στιγμιότυπο', () => {
    window.localStorage.setItem(STORAGE_KEYS.RECENT_PLACE_SEARCHES, '{oops');
    expect(getRecentPlaceSearchesSnapshot()).toEqual([]);
  });
});

describe('Ι/Ο', () => {
  it('γράφει, ξαναδιαβάζει, ξεχνά, καθαρίζει', () => {
    rememberPlaceSearch('Αθήνα', ATHENS, 1);
    rememberPlaceSearch('Θεσσαλονίκη', THESSALONIKI, 2);
    expect(readRecentPlaceSearches().map((p) => p.label)).toEqual(['Θεσσαλονίκη', 'Αθήνα']);

    forgetPlaceSearch('ΑΘΗΝΑ');
    expect(readRecentPlaceSearches().map((p) => p.label)).toEqual(['Θεσσαλονίκη']);

    clearPlaceSearches();
    expect(window.localStorage.getItem(STORAGE_KEYS.RECENT_PLACE_SEARCHES)).toBeNull();
  });

  it('κενό κείμενο δεν γράφεται ποτέ', () => {
    rememberPlaceSearch('   ', ATHENS, 1);
    expect(readRecentPlaceSearches()).toEqual([]);
  });

  it('το στιγμιότυπο κρατά ταυτότητα όσο ο δίσκος δεν αλλάζει (όχι βρόχος απόδοσης)', () => {
    rememberPlaceSearch('Αθήνα', ATHENS, 1);
    expect(getRecentPlaceSearchesSnapshot()).toBe(getRecentPlaceSearchesSnapshot());
  });

  it('ειδοποιεί τους ακροατές της ίδιας καρτέλας και σταματά μετά την απεγγραφή', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeRecentPlaceSearches(listener);
    rememberPlaceSearch('Αθήνα', ATHENS, 1);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    clearPlaceSearches();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('ακούει εγγραφές ΑΛΛΗΣ καρτέλας (συμβάν storage)', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeRecentPlaceSearches(listener);
    window.dispatchEvent(new StorageEvent('storage', { key: 'άλλο κλειδί' }));
    expect(listener).not.toHaveBeenCalled();
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEYS.RECENT_PLACE_SEARCHES }));
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });
});
