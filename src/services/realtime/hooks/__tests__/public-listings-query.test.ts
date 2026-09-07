/**
 * @fileoverview ΑΓΚΥΡΕΣ ΣΤΟ ΣΥΝΟΡΟ ΜΕ ΤΟ FIRESTORE — **τι ΡΩΤΑΕΙ πραγματικά η οθόνη 2**.
 * @related ADR-777 §8.65 · services/realtime/hooks/public-listings-query.ts
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΜΕ ΨΕΥΤΙΚΗ ΒΙΒΛΙΟΘΗΚΗ ΚΑΙ ΟΧΙ ΜΕ EMULATOR
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η ερώτηση εδώ **δεν** είναι *«επιστρέφει το Firestore τα σωστά έγγραφα;»* — αυτό το
 * απαντούν τα rules tests και, τελικά, η **οθόνη**. Η ερώτηση είναι *«ρωτάμε αυτό που
 * νομίζουμε ότι ρωτάμε;»*, και είναι ακριβώς η κλάση που κόστισε δύο ελαττώματα στο
 * Βήμα 3: **η δήλωση ήταν λάθος και τίποτα δεν έσκασε**.
 *
 * Τρία πράγματα εδώ αποτυγχάνουν **σιωπηλά** στην παραγωγή:
 *   1. λάθος διαδρομή πεδίου ⇒ **μηδέν** έγγραφα *(«δεν υπάρχει τίποτα εδώ»)*
 *   2. `limit(CAP)` αντί για `CAP + 1` ⇒ η οθόνη **δεν ξέρει ποτέ** ότι κόπηκε
 *   3. καταμέτρηση στο **διευρυμένο** ορθογώνιο ⇒ μετρητής «συνεπής και ψεύτης» (§8.62)
 */

import {
  listingCountBox,
  listingReadBox,
  LISTING_POINT_FIELD,
  LISTING_READ_CAP,
} from '@/lib/listings/listing-geo-query';
import type { GeoBoundingBox, GeoCircle } from '@/types/geo/coordinates';

jest.mock('@/lib/firebase', () => ({ db: { __fake: 'db' } }));

interface FakeWhere {
  readonly type: 'where';
  readonly field: string;
  readonly op: string;
  readonly value: number;
}
interface FakeLimit {
  readonly type: 'limit';
  readonly n: number;
}
type FakeConstraint = FakeWhere | FakeLimit;
interface FakeQuery {
  readonly collectionName: string;
  readonly constraints: readonly FakeConstraint[];
}

const countResult = { count: 4312 };
let countShouldThrow = false;

jest.mock('firebase/firestore', () => ({
  collection: (_db: unknown, name: string) => ({ collectionName: name }),
  query: (source: { collectionName: string }, ...constraints: FakeConstraint[]) => ({
    collectionName: source.collectionName,
    constraints,
  }),
  where: (field: string, op: string, value: number) => ({ type: 'where', field, op, value }),
  limit: (n: number) => ({ type: 'limit', n }),
  getCountFromServer: jest.fn(async () => {
    if (countShouldThrow) throw new Error('permission-denied');
    return { data: () => countResult };
  }),
}));

// Εισάγεται ΜΕΤΑ τα mocks — αλλιώς κρατά τις αληθινές συναρτήσεις.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { countPublicListings, publicListingsQuery } = require('../public-listings-query') as {
  countPublicListings: (near: GeoBoundingBox | GeoCircle | null) => Promise<number | null>;
  publicListingsQuery: (near: GeoBoundingBox | GeoCircle | null) => FakeQuery;
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getCountFromServer } = require('firebase/firestore') as {
  getCountFromServer: jest.Mock;
};

const FRAME: GeoBoundingBox = { south: 37.97, north: 37.99, west: 23.72, east: 23.75 };
const CIRCLE: GeoCircle = { center: { lat: 37.98, lng: 23.73 }, radiusKm: 3 };

function wheres(q: FakeQuery): readonly FakeWhere[] {
  return q.constraints.filter((c): c is FakeWhere => c.type === 'where');
}
function limits(q: FakeQuery): readonly FakeLimit[] {
  return q.constraints.filter((c): c is FakeLimit => c.type === 'limit');
}
function bound(q: FakeQuery, field: string, op: string): number {
  const found = wheres(q).find((w) => w.field === field && w.op === op);
  if (!found) throw new Error(`λείπει ο περιορισμός ${field} ${op}`);
  return found.value;
}

beforeEach(() => {
  countShouldThrow = false;
  getCountFromServer.mockClear();
});

// ============================================================================
// Κ1 — ΤΟ ΟΡΙΟ ΙΣΧΥΕΙ ΠΑΝΤΑ, ΚΑΙ ΕΙΝΑΙ «ΕΝΑ ΠΑΡΑΠΑΝΩ»  🔴 ΚΡΙΣΙΜΗ
// ============================================================================

describe('Κ1 — καμία ανάγνωση χωρίς όριο', () => {
  it.each([
    ['χωρίς περιοχή', null],
    ['με κάδρο', FRAME],
    ['με κύκλο', CIRCLE],
  ] as const)('%s: υπάρχει ακριβώς ένα limit', (_label, near) => {
    const applied = limits(publicListingsQuery(near));
    expect(applied).toHaveLength(1);
  });

  it('🔴 ΖΗΤΑΕΙ ΕΝΑ ΠΑΡΑΠΑΝΩ — αλλιώς η οθόνη δεν μαθαίνει ΠΟΤΕ ότι κόπηκε', () => {
    // Με σκέτο `limit(CAP)`, ένα αποτέλεσμα ακριβώς `CAP` είναι αμφίσημο: «τόσα
    // υπάρχουν» ή «τόσα χώρεσαν». Η οθόνη θα έλεγε «ζουμάρετε» άλλοτε ναι, άλλοτε όχι.
    expect(limits(publicListingsQuery(FRAME))[0].n).toBe(LISTING_READ_CAP + 1);
  });

  it('χωρίς περιοχή δεν μπαίνει ΚΑΝΕΝΑ γεωγραφικό φίλτρο', () => {
    expect(wheres(publicListingsQuery(null))).toEqual([]);
  });
});

// ============================================================================
// Κ2 — Η ΠΕΡΙΟΧΗ ΦΤΑΝΕΙ ΣΤΟ ΕΡΩΤΗΜΑ, ΔΙΕΥΡΥΜΕΝΗ  🔴 ΚΡΙΣΙΜΗ
// ============================================================================

describe('Κ2 — τέσσερα εύρη σε ΔΥΟ πεδία — ένα ερώτημα, όχι 4-9', () => {
  it('τα τέσσερα όρια δηλώνονται με τις σωστές διαδρομές πεδίων', () => {
    const q = publicListingsQuery(FRAME);
    const fields = wheres(q).map((w) => w.field);

    expect(fields.filter((f) => f === LISTING_POINT_FIELD.lat)).toHaveLength(2);
    expect(fields.filter((f) => f === LISTING_POINT_FIELD.lng)).toHaveLength(2);
    expect(wheres(q).map((w) => w.op).sort()).toEqual(['<=', '<=', '>=', '>=']);
  });

  it('🔴 ΤΑ ΟΡΙΑ ΕΙΝΑΙ ΤΟΥ ΔΙΕΥΡΥΜΕΝΟΥ ΟΡΘΟΓΩΝΙΟΥ — εκεί ζει η «τρίτη κατηγορία»', () => {
    const q = publicListingsQuery(FRAME);
    const read = listingReadBox(FRAME);

    expect(bound(q, LISTING_POINT_FIELD.lat, '>=')).toBeCloseTo(read.south, 9);
    expect(bound(q, LISTING_POINT_FIELD.lat, '<=')).toBeCloseTo(read.north, 9);
    expect(bound(q, LISTING_POINT_FIELD.lng, '>=')).toBeCloseTo(read.west, 9);
    expect(bound(q, LISTING_POINT_FIELD.lng, '<=')).toBeCloseTo(read.east, 9);

    // Και είναι ΓΝΗΣΙΑ φαρδύτερα από το ίδιο το κάδρο.
    expect(bound(q, LISTING_POINT_FIELD.lat, '<=')).toBeGreaterThan(FRAME.north);
  });

  it('ο κύκλος γίνεται κι αυτός ορθογώνιο — κανένα δίλημμα «κύκλος ή ορθογώνιο»', () => {
    expect(wheres(publicListingsQuery(CIRCLE))).toHaveLength(4);
  });
});

// ============================================================================
// Κ3 — Η ΚΑΤΑΜΕΤΡΗΣΗ ΡΩΤΑ ΑΛΛΟ ΟΡΘΟΓΩΝΙΟ  🔴 Ο ΜΕΤΡΗΤΗΣ ΔΕΝ ΨΕΥΔΕΤΑΙ
// ============================================================================

describe('Κ3 — μετράμε την ερώτηση του ανθρώπου', () => {
  it('η καταμέτρηση τρέχει στο ΑΔΙΕΥΡΥΝΤΟ ορθογώνιο, και ΧΩΡΙΣ όριο', async () => {
    await countPublicListings(FRAME);

    expect(getCountFromServer).toHaveBeenCalledTimes(1);
    const q = getCountFromServer.mock.calls[0][0] as FakeQuery;
    const box = listingCountBox(FRAME);

    expect(limits(q)).toEqual([]);
    expect(bound(q, LISTING_POINT_FIELD.lat, '<=')).toBeCloseTo(box.north, 9);
    // 🔴 Το κρίσιμο: ΜΙΚΡΟΤΕΡΟ από το ορθογώνιο ανάγνωσης.
    expect(bound(q, LISTING_POINT_FIELD.lat, '<=')).toBeLessThan(listingReadBox(FRAME).north);
  });

  it('επιστρέφει τον αριθμό όταν η ερώτηση είναι ορθογώνιο', async () => {
    await expect(countPublicListings(FRAME)).resolves.toBe(4312);
  });

  it('χωρίς περιοχή μετρά ΟΛΗ τη συλλογή, χωρίς φίλτρα', async () => {
    await countPublicListings(null);
    const q = getCountFromServer.mock.calls[0][0] as FakeQuery;
    expect(wheres(q)).toEqual([]);
  });

  it('🔴 ΓΙΑ ΚΥΚΛΟ ΔΕΝ ΜΕΤΡΑΕΙ ΚΑΝ — σιωπή αντί για ψεύτικη ακρίβεια', async () => {
    // Το περιγεγραμμένο ορθογώνιο είναι έως 21,5% μεγαλύτερο· ένα «4.312» εκεί θα
    // ήταν ψέμα με τρία ψηφία ακρίβειας.
    await expect(countPublicListings(CIRCLE)).resolves.toBeNull();
    expect(getCountFromServer).not.toHaveBeenCalled();
  });

  it('αποτυχία καταμέτρησης ΔΕΝ ρίχνει την οθόνη — γυρίζει null', async () => {
    countShouldThrow = true;
    await expect(countPublicListings(FRAME)).resolves.toBeNull();
  });
});
