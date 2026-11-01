/**
 * @jest-environment node
 *
 * ΑΓΚΥΡΑ — **ποιος μπαίνει στο ευρετήριο** (ADR-829 §7).
 *
 * Τον ίδιο κανόνα τρέχουν ο trigger και το backfill, και την ίδια σφραγίδα ελέγχει η διαδρομή.
 * Η σταθερά του core είναι literal, γιατί το `container-read-reach` δεν προβάλλεται στα functions:
 * η Τ1 την κρατά δεμένη με τον πίνακα των φάσεων, αλλιώς θα απέκλινε σιωπηλά.
 */

import * as fs from 'fs';

import {
  READ_REACH_BY_PHASE,
  readReachForState,
} from '@/lib/auth/container-read-reach';
import { SEARCH_ENTITY_TYPES } from '@/types/search-core';
import {
  SEARCH_INDEX_CORE,
  SEARCH_READABLE_REACH,
  SEARCH_REQUIRED_PERMISSIONS,
  isSearchResultAdmissible,
  searchIndexExclusion,
  searchReadReachStamp,
} from '../search-index-core';

const FILE = SEARCH_INDEX_CORE[SEARCH_ENTITY_TYPES.FILE];
const PROJECT = SEARCH_INDEX_CORE[SEARCH_ENTITY_TYPES.PROJECT];

describe('Τ1 — η σταθερά είναι ο φράχτης των κοινοποιημένων', () => {
  it('Τ1.1 — ίση με την εμβέλεια της λίστας γραφείου', () => {
    expect(SEARCH_READABLE_REACH).toBe(readReachForState('SHARED'));
  });

  // Χειρόγραφο: αν αλλάξει η εμβέλεια μιας φάσης, η αναζήτηση πρέπει να ρωτηθεί, όχι να ακολουθήσει.
  it.each([
    ['pre-cde', null],
    ['WIP', 'outside-reach'],
    ['SHARED', null],
    ['PUBLISHED', null],
    ['SUPERSEDED', null],
    ['unreadable', 'outside-reach'],
  ] as const)('Τ1.2 — φάση %s ⇒ %s', (phase, expected) => {
    expect(searchIndexExclusion({ cdeReadReach: READ_REACH_BY_PHASE[phase] }, FILE)).toBe(expected);
  });
});

describe('Τ2 — κλειστό σε αμφιβολία', () => {
  it.each([[undefined], [null], [''], ['company'], [true]])('Τ2.1 — εμβέλεια %s μένει έξω', (cdeReadReach) => {
    expect(searchIndexExclusion({ cdeReadReach }, FILE)).toBe('outside-reach');
  });

  it('Τ2.2 — αρχείο χωρίς το πεδίο μένει έξω', () => {
    expect(searchIndexExclusion({ displayName: 'Κάτοψη' }, FILE)).toBe('outside-reach');
  });

  it('Τ2.3 — τύπος χωρίς φράχτη δεν ρωτά εμβέλεια', () => {
    expect(searchIndexExclusion({ name: 'Έργο' }, PROJECT)).toBeNull();
  });

  it('Τ2.4 — μόνο τα αρχεία έχουν φράχτη ανά έγγραφο', () => {
    const fenced = Object.entries(SEARCH_INDEX_CORE).filter(([, config]) => config.readReach).map(([type]) => type);
    expect(fenced).toEqual([SEARCH_ENTITY_TYPES.FILE]);
  });
});

describe('Τ3 — ό,τι αποσύρθηκε, ο κοινός κανόνας του trigger και του backfill', () => {
  it.each([
    ['κάδος με σημαία', { isDeleted: true }],
    ['κάδος με χρόνο', { deletedAt: '2026-01-01' }],
    ['κάδος με κατάσταση', { status: 'deleted' }],
    ['αρχείο', { status: 'archived' }],
  ])('Τ3.1 — %s', (_label, doc) => {
    expect(searchIndexExclusion(doc, PROJECT)).toBe('soft-deleted');
  });

  it('Τ3.2 — το αποσυρμένο υπερισχύει της εμβέλειας', () => {
    expect(searchIndexExclusion({ isDeleted: true, cdeReadReach: 'author' }, FILE)).toBe('soft-deleted');
  });
});

describe('Τ5 — ο πίνακας δικαιωμάτων λέει ό,τι η διαδρομή λίστας του κάθε τύπου', () => {
  // Αποτέλεσμα που βρίσκεται αλλά δεν ανοίγει είναι πόρτα σε τοίχο. Ο πίνακας ρόλων δεν το βλέπει:
  // ο `internal_user` έχει και το `buildings:buildings:view` και το `projects:floors:view`.
  it.each([
    [SEARCH_ENTITY_TYPES.BUILDING, 'src/app/api/buildings/buildings-list.handler.ts'],
    [SEARCH_ENTITY_TYPES.FLOOR, 'src/app/api/floors/route.ts'],
    [SEARCH_ENTITY_TYPES.PARKING, 'src/app/api/parking/route.ts'],
    [SEARCH_ENTITY_TYPES.STORAGE, 'src/app/api/storages/route.ts'],
  ])('Τ5.1 — %s ζητά το δικαίωμα του %s', (entityType, routeFile) => {
    const source = fs.readFileSync(routeFile, 'utf8');
    expect(source).toContain(`'${SEARCH_REQUIRED_PERMISSIONS[entityType]}'`);
  });
});

describe('Τ4 — η σφραγίδα και η είσοδος στα αποτελέσματα', () => {
  it('Τ4.1 — το αρχείο σφραγίζεται, το έργο όχι (το Firestore απορρίπτει `undefined`)', () => {
    expect(searchReadReachStamp(FILE)).toEqual({ readReach: 'tenant' });
    expect(searchReadReachStamp(PROJECT)).toEqual({});
  });

  it('Τ4.2 — ό,τι γράφει η σφραγίδα περνά την πύλη των αποτελεσμάτων', () => {
    expect(isSearchResultAdmissible(searchReadReachStamp(FILE), FILE)).toBe(true);
  });

  it('Τ4.3 — παλιά εγγραφή αρχείου δεν περνά, κανενός άλλου τύπου περνά', () => {
    expect(isSearchResultAdmissible({}, FILE)).toBe(false);
    expect(isSearchResultAdmissible({ readReach: 'author' }, FILE)).toBe(false);
    expect(isSearchResultAdmissible({}, PROJECT)).toBe(true);
  });
});
