/**
 * ADR-900 — το συμβόλαιο URL, η μετάφραση φόρμας → ερωτήματος, και η προβολή «ακίνητο χωρίς διάθεση».
 *
 * 🔑 Ο parser και ο συνθέτης ζουν σε ΕΝΑ module και ελέγχονται ΜΑΖΙ (round-trip): αν κάποιος
 * μετονομάσει παράμετρο στη μία πλευρά, κοκκινίζει εδώ — όχι σιωπηλά στο `/offers/new`.
 */

import {
  EMPTY_PROSPECT_FORM,
  PROSPECT_INTEREST_API,
  PROSPECT_LIMITS,
  parseProspectQuery,
  prospectInterestUrl,
  prospectProjectable,
  prospectQueryFrom,
  prospectQueryParams,
  type ProspectQuery,
} from '../prospect-interest';
import { stanceOfListing } from '../demand-interest';
import { projectListingShape } from '@/services/listings/public-listing-projection';
import { ownerFormFromProspect } from '@/lib/owner-property/owner-property-prospect-prefill';

const REF = { landId: 'land_abc', buildingId: 'pbld_xyz' } as const;
const FULL: ProspectQuery = { ref: REF, description: { type: 'apartment', areaSqm: 85, floor: 3 } };

describe('U — συμβόλαιο URL: ό,τι γράφει ο ένας, το διαβάζει ο άλλος', () => {
  it('round-trip πλήρους ερωτήματος', () => {
    expect(parseProspectQuery(prospectQueryParams(FULL))).toEqual({ kind: 'ok', query: FULL });
  });

  it('round-trip με κενά: χωρίς κτίριο, εμβαδόν, όροφο — τα `null` ΛΕΙΠΟΥΝ από το URL', () => {
    const bare: ProspectQuery = { ref: { landId: 'land_abc', buildingId: null }, description: { type: 'plot', areaSqm: null, floor: null } };
    const params = prospectQueryParams(bare);
    expect([...params.keys()].sort()).toEqual(['landId', 'type']);
    expect(parseProspectQuery(params)).toEqual({ kind: 'ok', query: bare });
  });

  it('το URL του API είναι η διαδρομή + οι ίδιες παράμετροι', () => {
    expect(prospectInterestUrl(FULL)).toBe(`${PROSPECT_INTEREST_API}?${prospectQueryParams(FULL).toString()}`);
  });

  it.each([
    ['missing-land', 'type=apartment'],
    ['bad-type', 'landId=land_abc&type=castle'],
    ['bad-area', 'landId=land_abc&type=apartment&areaSqm=0'],
    ['bad-area', `landId=land_abc&type=apartment&areaSqm=${PROSPECT_LIMITS.areaSqmMax + 1}`],
    ['bad-area', 'landId=land_abc&type=apartment&areaSqm=abc'],
    ['bad-floor', 'landId=land_abc&type=apartment&floor=2.5'],
    ['bad-floor', `landId=land_abc&type=apartment&floor=${PROSPECT_LIMITS.floorMin - 1}`],
  ])('απόρριψη `%s` για «%s»', (defect, query) => {
    expect(parseProspectQuery(new URLSearchParams(query))).toEqual({ kind: 'invalid', defect });
  });

  it('το υπόγειο (−1) και το ισόγειο (0) είναι έγκυροι όροφοι', () => {
    for (const floor of ['-1', '0']) {
      expect(parseProspectQuery(new URLSearchParams(`landId=land_abc&type=apartment&floor=${floor}`)).kind).toBe('ok');
    }
  });
});

describe('Φ — φόρμα → ερώτημα', () => {
  it('χωρίς κτίριο ή χωρίς είδος ⇒ `null` (το κουμπί μένει ανενεργό)', () => {
    expect(prospectQueryFrom(null, { ...EMPTY_PROSPECT_FORM, type: 'apartment' })).toBeNull();
    expect(prospectQueryFrom(REF, EMPTY_PROSPECT_FORM)).toBeNull();
  });

  it('🔴 η γη ΔΕΝ έχει όροφο — η τιμή που επέζησε στη φόρμα πέφτει στη μετάφραση', () => {
    expect(prospectQueryFrom(REF, { type: 'plot', areaSqm: 400, floor: 3 })?.description.floor).toBeNull();
  });

  it('τιμή εκτός ορίων ⇒ `null` — ο πελάτης δεν στέλνει ό,τι ο διακομιστής θα απέρριπτε', () => {
    expect(prospectQueryFrom(REF, { type: 'apartment', areaSqm: -5, floor: null })).toBeNull();
    expect(prospectQueryFrom(REF, { type: 'apartment', areaSqm: 80, floor: 1.5 })).toBeNull();
  });

  it('έγκυρη φόρμα ⇒ ερώτημα που περνά τον parser της διαδρομής', () => {
    const query = prospectQueryFrom(REF, { type: 'apartment', areaSqm: 85, floor: 3 });
    expect(query).toEqual(FULL);
    expect(parseProspectQuery(prospectQueryParams(FULL)).kind).toBe('ok');
  });
});

describe('Π — η προβολή: «ακίνητο χωρίς διάθεση», κριμένο από τον ΥΠΑΡΧΟΝΤΑ κριτή', () => {
  it('🔑 η στάση βγαίνει `dormant` — ποτέ εφευρημένη διάθεση', () => {
    const place = { candidates: [], ref: REF };
    const shape = projectListingShape(prospectProjectable(FULL.description), place, '2026-10-02T10:00:00.000Z');
    expect(stanceOfListing(shape)).toBe('dormant');
    expect(shape.offerKinds).toEqual([]);
  });
});

describe('Κ — προσυμπλήρωση του `/offers/new` από το ίδιο ερώτημα', () => {
  it('είδος, εμβαδόν, όροφος, κτίριο — και ΚΑΜΙΑ διεύθυνση/σημείο (Α5)', () => {
    const values = ownerFormFromProspect(prospectQueryParams(FULL));
    expect(values).not.toBeNull();
    expect(values).toMatchObject({ type: 'apartment', areaSqm: 85, floor: 3, placeRef: REF, placePoint: null, placeQuery: '' });
  });

  it('χαλασμένο URL ⇒ `null` (η φόρμα ανοίγει κενή, η καταχώριση δεν μπλοκάρει)', () => {
    expect(ownerFormFromProspect(new URLSearchParams('type=apartment'))).toBeNull();
  });
});
