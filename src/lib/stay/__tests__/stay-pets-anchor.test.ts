/**
 * @fileoverview **ΑΓΚΥΡΑ — ΚΑΤΟΙΚΙΔΙΑ ΣΤΗ ΔΙΑΜΟΝΗ** (ADR-777 §8.60.21).
 *
 * 🔴 **Τι φυλάει**: ως τις 2026-09-18 καμία αγγελία βραχυχρόνιας δεν μπορούσε να πει αν
 * δέχεται κατοικίδια, και κανένας ζητών να πει ότι φέρνει. Εδώ ασκείται η αλυσίδα από τον
 * κάτοχο: όρια → invariants → σύνορο δικτύου → αναγνώστης → φόρμα.
 *
 * ⛔ **Και το αρνητικό**: ο σκύλος βοήθειας **δεν** έχει καμία διαδρομή — κανένα πεδίο να τον
 * αποκλείσει ή να τον χρεώσει.
 *
 * 🔑 **Δεύτερη φωνή**: οι προσδοκίες είναι χειρόγραφοι αριθμοί, όχι αντίγραφα των σταθερών.
 */

import {
  offerMaxPetsInvalid,
  offerPetFeeInvalid,
  STAY_PETS_CEILING,
} from '@/lib/offers/offer-amount';
import { readStayPetPolicy } from '@/lib/offers/stay-pet-policy';
import { ownerPropertyDraftFromRequest } from '@/lib/owner-property/owner-property-draft-schema';
import {
  EMPTY_OWNER_PROPERTY_FORM,
  ownerPropertyDraftFrom,
  ownerPropertyFormFrom,
  ownerPropertyFormSchema,
  type OwnerPropertyFormValues,
} from '@/lib/owner-property/owner-property-form-values';
import { validDraft, validOwnerProperty } from '@/lib/owner-property/__tests__/owner-property-fixtures';
import { ownerPropertyInvariantViolations } from '@/types/owner-property-invariants';
import type { ShortLeaseOffer, StayPetPolicy } from '@/types/property-offers';
import { petsVerdict, stayAvailabilityFor } from '@/lib/stay/stay-availability';
import { isStayable } from '@/lib/stay/stay-availability-vocabulary';
import type { PublicStayAnswer } from '@/lib/stay/stay-public-request';
import { computeStayLedger, stayLedgerBalances } from '@/lib/listings/stay-ledger';
import { stayTotalOf, stayTotalsOf } from '@/lib/listings/listing-stay-total';
import type { MinorAmount } from '@/lib/money/money';
import { stayQuoteOf } from '@/lib/stay/stay-nightly-quote';

import { judgeStayTerms } from '@/lib/demand/demand-match-stay';
import {
  ABSENCE_BLOCKERS,
  isCategoricalBlocker,
  isUncertainBlocker,
} from '@/lib/demand/demand-match-vocabulary';
import { IGNORANCE_BLOCKERS } from '@/lib/demand/demand-answer';
import { readStoredSeeks } from '@/lib/demand/demand-seeks-read';
import { listingFiltersFromDemand } from '@/lib/demand/demand-listing-filters';
import { demandDraftFrom, demandFormSchema, EMPTY_DEMAND_FORM } from '@/lib/demand/demand-form-values';
import { demandFormFrom } from '@/lib/demand/demand-form-load';
import { demand } from '@/lib/demand/__tests__/demand-fixtures';
import {
  demandInvariantViolations,
  NO_AMOUNT_RANGE,
  NO_NIGHTS_RANGE,
  shortStaySeek,
  stayHeadcount,
  stayPartySize,
  type StayParty,
} from '@/types/property-demand';

import { bookingEntry, calendarOf, listingOf } from './stay-rules-fixtures';

/** Βραχυχρόνια 60 €/νύχτα με τη δοσμένη πολιτική. */
function stayOffer(pets: StayPetPolicy | null | undefined, nightlyRate: number | null = 60): ShortLeaseOffer {
  return {
    id: 'offr_stay',
    kind: 'leaseShort',
    lifecycle: 'active',
    nightlyRate,
    minNights: null,
    maxGuests: 4,
    ...(pets === undefined ? {} : { pets }),
  };
}

const welcomes = (maxPets: number | null, fee: { amount: number; per: 'stay' | 'night' | 'pet' | 'petNight' } | null = null): StayPetPolicy =>
  ({ accepts: 'yes', maxPets, fee });

// =============================================================================
// Ο — ΤΑ ΟΡΙΑ (lib/offers/offer-amount.ts)
// =============================================================================

describe('Ο — όριο κατοικιδίων: ακέραιος 1..5, και «χωρίς όριο» είναι νόμιμο', () => {
  it('Ο1 — το ταβάνι είναι το 5 του Airbnb', () => {
    expect(STAY_PETS_CEILING).toBe(5);
  });

  it.each([
    [null, false],
    [1, false],
    [5, false],
    [0, true],
    [6, true],
    [1.5, true],
    [-1, true],
  ])('Ο2 — maxPets=%p ⇒ άκυρο=%p', (maxPets, invalid) => {
    expect(offerMaxPetsInvalid(stayOffer(welcomes(maxPets)))).toBe(invalid);
  });

  it('Ο3 — «όχι» και «δεν δηλώθηκε» δεν κρίνονται (δεν υπάρχει όριο να κριθεί)', () => {
    expect(offerMaxPetsInvalid(stayOffer({ accepts: 'no' }))).toBe(false);
    expect(offerMaxPetsInvalid(stayOffer(null))).toBe(false);
    expect(offerMaxPetsInvalid(stayOffer(undefined))).toBe(false);
  });
});

describe('Χ — χρέωση: θετική και ΟΧΙ πάνω από την τιμή νύχτας (Airbnb Help 3623)', () => {
  it.each([
    [{ amount: 15, per: 'night' as const }, 60, false],
    [{ amount: 60, per: 'stay' as const }, 60, false],
    [{ amount: 61, per: 'stay' as const }, 60, true],
    [{ amount: 0, per: 'pet' as const }, 60, true],
    [{ amount: -5, per: 'pet' as const }, 60, true],
    [{ amount: 500, per: 'stay' as const }, null, false],
  ])('Χ1 — χρέωση %p σε τιμή νύχτας %p ⇒ άκυρη=%p', (fee, rate, invalid) => {
    expect(offerPetFeeInvalid(stayOffer(welcomes(2, fee), rate))).toBe(invalid);
  });

  it('Χ2 — χωρίς χρέωση (`fee: null`) = δωρεάν, όχι σφάλμα', () => {
    expect(offerPetFeeInvalid(stayOffer(welcomes(2, null)))).toBe(false);
  });
});

// =============================================================================
// Ι — INVARIANTS: ΔΥΟ ΚΩΔΙΚΟΙ, ΓΙΑ ΝΑ ΞΕΡΕΙ Η ΟΘΟΝΗ ΠΟΙΟ ΠΕΔΙΟ
// =============================================================================

describe('Ι — invariants του κατόχου', () => {
  const codes = (pets: StayPetPolicy): string[] =>
    ownerPropertyInvariantViolations(validDraft({ offers: [stayOffer(pets)] }));

  it('Ι1 — έγκυρη πολιτική ⇒ κανένας κωδικός κατοικιδίων', () => {
    expect(codes(welcomes(2, { amount: 10, per: 'petNight' }))).toEqual([]);
    expect(codes({ accepts: 'no' })).toEqual([]);
  });

  it('Ι2 — κάθε λάθος πεδίο έχει ΤΟΝ ΔΙΚΟ του κωδικό', () => {
    expect(codes(welcomes(9))).toEqual(['short-lease-max-pets-invalid']);
    expect(codes(welcomes(2, { amount: 900, per: 'stay' }))).toEqual(['short-lease-pet-fee-invalid']);
  });
});

// =============================================================================
// Σ — ΤΟ ΣΥΝΟΡΟ ΔΙΚΤΥΟΥ ΚΑΙ Ο ΑΝΑΓΝΩΣΤΗΣ: ΕΝΑ ΣΧΗΜΑ
// =============================================================================

describe('Σ — σύνορο δικτύου (ownerPropertyDraftFromRequest)', () => {
  const body = (pets: unknown): unknown => ({ ...validDraft(), offers: [{ ...stayOffer(undefined), pets }] });

  it('Σ1 — η πολιτική περνά αυτούσια', () => {
    const parsed = ownerPropertyDraftFromRequest(body(welcomes(3, { amount: 20, per: 'pet' })));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect((parsed.draft.offers[0] as ShortLeaseOffer).pets).toEqual(welcomes(3, { amount: 20, per: 'pet' }));
  });

  it('Σ2 — πελάτης που ΔΕΝ στέλνει `pets` (πριν τις 2026-09-18) περνά', () => {
    const { pets: _absent, ...legacy } = stayOffer(undefined);
    expect(ownerPropertyDraftFromRequest({ ...validDraft(), offers: [legacy] }).ok).toBe(true);
  });

  it('🔴 Σ3 — «όχι» ΜΕ χρέωση είναι αντίφαση ⇒ απορρίπτεται στο σύνορο', () => {
    expect(ownerPropertyDraftFromRequest(body({ accepts: 'no', fee: { amount: 5, per: 'stay' } })).ok).toBe(false);
  });

  it('Σ4 — άγνωστη απάντηση ⇒ απορρίπτεται', () => {
    expect(ownerPropertyDraftFromRequest(body({ accepts: 'maybe', maxPets: 1, fee: null })).ok).toBe(false);
  });
});

describe('Α — αναγνώστης: χαλασμένο ⇒ «δεν δηλώθηκε», ΠΟΤΕ «όχι»', () => {
  it.each([undefined, null, 'yes', { accepts: 'maybe' }, { accepts: 'yes' }])('Α1 — %p ⇒ null', (raw) => {
    expect(readStayPetPolicy(raw)).toBeNull();
  });

  it('Α2 — έγκυρη πολιτική διαβάζεται', () => {
    expect(readStayPetPolicy({ accepts: 'onRequest', maxPets: null, fee: null })).toEqual({
      accepts: 'onRequest',
      maxPets: null,
      fee: null,
    });
  });
});

// =============================================================================
// Φ — Η ΦΟΡΜΑ ΤΟΥ ΚΑΤΟΧΟΥ
// =============================================================================

describe('Φ — φόρμα κατόχου ⇄ πολιτική', () => {
  const source = { previous: [], mintOfferId: () => 'offr_new' };
  const stayForm = (overrides: Partial<OwnerPropertyFormValues>): OwnerPropertyFormValues => ({
    ...EMPTY_OWNER_PROPERTY_FORM,
    title: 'Στούντιο',
    type: 'apartment',
    areaSqm: 40,
    offerKinds: ['leaseShort'],
    nightlyRate: 60,
    placeAnswer: 'declined',
    ...overrides,
  });
  const petsOf = (overrides: Partial<OwnerPropertyFormValues>): StayPetPolicy | null | undefined => {
    const draft = ownerPropertyDraftFrom(ownerPropertyFormSchema.parse(stayForm(overrides)), source);
    return (draft.offers[0] as ShortLeaseOffer).pets;
  };

  it('Φ1 — κενή φόρμα ⇒ «δεν το ορίζω» ⇒ `null` (δεν δηλώθηκε)', () => {
    expect(EMPTY_OWNER_PROPERTY_FORM.petsAccepts).toBe('unset');
    expect(petsOf({})).toBeNull();
  });

  it('Φ2 — «ναι» + όριο + χρέωση ταξιδεύουν μαζί', () => {
    expect(petsOf({ petsAccepts: 'yes', maxPets: 2, petFeeAmount: 10, petFeePer: 'night' })).toEqual(
      welcomes(2, { amount: 10, per: 'night' }),
    );
  });

  it('🔴 Φ3 — «όχι» ⇒ όριο και χρέωση που έμειναν στη μνήμη ΔΕΝ ταξιδεύουν', () => {
    expect(petsOf({ petsAccepts: 'no', maxPets: 2, petFeeAmount: 10 })).toEqual({ accepts: 'no' });
  });

  it('Φ4 — κενό ποσό ⇒ `fee: null` (δωρεάν)· ο τρόπος χωρίς ποσό δεν γράφεται', () => {
    expect(petsOf({ petsAccepts: 'onRequest', petFeePer: 'petNight' })).toEqual({
      accepts: 'onRequest',
      maxPets: null,
      fee: null,
    });
  });

  it('Φ5 — επεξεργασία: η αποθηκευμένη πολιτική ξαναγεμίζει τη φόρμα', () => {
    const property = validOwnerProperty({
      offers: [stayOffer(welcomes(3, { amount: 25, per: 'pet' }))],
    });
    expect(ownerPropertyFormFrom(property)).toMatchObject({
      petsAccepts: 'yes',
      maxPets: 3,
      petFeeAmount: 25,
      petFeePer: 'pet',
    });
  });

  it('Φ6 — παλιό έγγραφο χωρίς `pets` ⇒ «δεν το ορίζω»', () => {
    const property = validOwnerProperty({ offers: [stayOffer(undefined)] });
    expect(ownerPropertyFormFrom(property).petsAccepts).toBe('unset');
  });
});

// =============================================================================
// Κ — Ο ΕΝΑΣ ΚΡΙΤΗΣ (lib/stay/stay-availability.ts)
// =============================================================================

describe('Κ — petsVerdict: τέσσερα ονόματα, κανένα σιωπηλό', () => {
  const onRequest: StayPetPolicy = { accepts: 'onRequest', maxPets: null, fee: null };
  it.each([
    [null, 1, { kind: 'pets-unknown' }],
    [{ accepts: 'no' } as StayPetPolicy, 1, { kind: 'pets-not-allowed' }],
    [welcomes(1), 2, { kind: 'over-pet-limit', maxPets: 1, asked: 2 }],
    [onRequest, 3, { kind: 'pets-on-request' }],
    [welcomes(null), 5, null],
    [welcomes(2), 2, null],
  ])('Κ1 — πολιτική %p, φέρνει %p ⇒ %p', (policy, pets, expected) => {
    expect(petsVerdict(policy, pets)).toEqual(expected);
  });

  it('Κ2 — χωρίς κατοικίδιο ο όρος ΔΕΝ κρίνεται — ούτε καν «άγνωστο»', () => {
    expect(petsVerdict(null, null)).toBeNull();
    expect(petsVerdict(null, 0)).toBeNull();
    expect(petsVerdict({ accepts: 'no' }, null)).toBeNull();
  });
});

describe('Ρ — η σειρά της σύνθεσης στην αναζήτηση (stayAvailabilityFor)', () => {
  const QUERY = { checkIn: '2026-09-10', checkOut: '2026-09-13', guests: 2 };
  const lodge = (pets: StayPetPolicy | null, maxGuests: number | null = 4) =>
    listingOf({ minNights: null, maxGuests, pets, nextAvailableFrom: null });
  const answer = (pets: StayPetPolicy | null, petsAsked: number | null, cal = calendarOf([])) =>
    stayAvailabilityFor(lodge(pets), { ...QUERY, pets: petsAsked }, cal, null).kind;
  const onRequest: StayPetPolicy = { accepts: 'onRequest', maxPets: null, fee: null };

  it('Ρ1 — «δεν δέχεται» / «δεν δηλώθηκε» / «λιγότερα» κόβουν ΠΡΙΝ το ημερολόγιο', () => {
    expect(answer({ accepts: 'no' }, 1)).toBe('pets-not-allowed');
    expect(answer(null, 1)).toBe('pets-unknown');
    expect(answer(welcomes(1), 2)).toBe('over-pet-limit');
  });

  it('Ρ2 — τα ΑΤΟΜΑ κρίνονται πρώτα: δεν χωράει ⇒ over-capacity, όχι κατοικίδια', () => {
    const tight = stayAvailabilityFor(lodge({ accepts: 'no' }, 1), { ...QUERY, pets: 1 }, calendarOf([]), null);
    expect(tight.kind).toBe('over-capacity');
  });

  it('🔴 Ρ3 — «κατόπιν συνεννόησης» ΔΕΝ κρύβει το ημερολόγιο: πιασμένο μένει πιασμένο', () => {
    expect(answer(onRequest, 1)).toBe('pets-on-request');
    const booked = calendarOf([bookingEntry('stb_1', '2026-09-11', '2026-09-12')]);
    expect(answer(onRequest, 1, booked)).toBe('occupied');
  });

  it('Ρ4 — «κατόπιν συνεννόησης» είναι stayable (μπορείς να μείνεις, με ερώτηση)', () => {
    expect(isStayable('pets-on-request')).toBe(true);
    expect(isStayable('pets-not-allowed')).toBe(false);
  });

  it('Ρ5 — χωρίς κατοικίδιο στο ερώτημα, η πολιτική δεν αλλάζει τίποτα', () => {
    expect(answer({ accepts: 'no' }, null)).toBe('free');
    expect(answer(null, null)).toBe('free');
  });
});

describe('Λ — η λογιστική κλείνει και με τους νέους κάδους', () => {
  it('Λ1 — κάθε νέα απάντηση μετριέται σε ΔΙΚΟ της κάδο, και το άθροισμα κλείνει', () => {
    const kinds = ['pets-unknown', 'pets-not-allowed', 'over-pet-limit', 'pets-on-request'] as const;
    const listings = kinds.map((kind) => ({ ...listingOf(), id: kind }));
    const ledger = computeStayLedger(listings, (l) =>
      l.id === 'over-pet-limit'
        ? { kind: 'over-pet-limit', maxPets: 1, asked: 2 }
        : { kind: l.id as Exclude<(typeof kinds)[number], 'over-pet-limit'> },
    );
    expect(stayLedgerBalances(ledger)).toBe(true);
    for (const kind of kinds) expect(ledger.byKind[kind]).toBe(1);
  });
});

describe('Τ — σύνολο διαμονής: ΟΛΟΚΛΗΡΟ, ποτέ μερικό άθροισμα (Φ5, §8.60.21.7)', () => {
  const priced = (kind: 'free' | 'pets-on-request' | 'pets-not-allowed'): PublicStayAnswer => ({
    answer: { kind },
    quote: {
      kind: 'priced',
      nights: [{ date: '2026-09-10', amountMinor: 8000 as MinorAmount, source: 'base' }],
      nightsMinor: 8000 as MinorAmount,
      fees: [],
      totalMinor: 8000 as MinorAmount,
    },
    hold: null,
  });
  const lodgeWith = (id: string, pets: StayPetPolicy) => ({
    ...listingOf({ minNights: null, maxGuests: 4, pets, nextAvailableFrom: null }),
    id,
  });

  it('Τ1 — `pets-on-request` δείχνει σύνολο (η τιμή ισχύει)· `pets-not-allowed` όχι', () => {
    expect(stayTotalOf(priced('pets-on-request'))).toEqual({ totalMinor: 8000, nights: 1 });
    expect(stayTotalOf(priced('pets-not-allowed'))).toBeNull();
  });

  it('🔴 Τ2 — κατοικίδιο + χρέωση κατόχου ⇒ ΠΛΗΡΕΣ σύνολο: νύχτες + χρέωση, από την ΙΔΙΑ τιμολόγηση', () => {
    // 80 €/νύχτα × 3 νύχτες = 240 € · 10 €/νύχτα κατοικίδιο × 3 = 30 € ⇒ 270 €.
    const charged = lodgeWith('charged', welcomes(2, { amount: 10, per: 'night' }));
    const window = { checkIn: '2026-09-10', checkOut: '2026-09-13' };
    const withPet = stayQuoteOf(charged, {}, { ...window, pets: 1 });
    const answers = { charged: { answer: { kind: 'free' as const }, quote: withPet, hold: null } };
    expect(stayTotalsOf(answers)).toEqual({ charged: { totalMinor: 27000, nights: 3 } });
    // Χωρίς κατοικίδιο στο ερώτημα, η χρέωση δεν αφορά ⇒ μόνο οι νύχτες.
    expect(stayQuoteOf(charged, {}, { ...window, pets: null })).toMatchObject({ totalMinor: 24000, fees: [] });
  });
});

// =============================================================================
// Ζ — Η ΖΗΤΗΣΗ (πρότυπο §8.60.19)
// =============================================================================

const partyOf = (adults: number, pets: number): StayParty => ({ adults, children: 0, infants: 0, pets });

describe('Ζ1 — κάθε εμπόδιο κατοικιδίων στην ΤΑΞΗ του', () => {
  it('«όχι» και «λιγότερα» ⇒ κατηγορικά', () => {
    expect(isCategoricalBlocker('stay-pets-not-allowed')).toBe(true);
    expect(isCategoricalBlocker('stay-pets-over-limit')).toBe(true);
  });

  it('🔴 «δεν δηλώθηκε» και «κατόπιν συνεννόησης» ⇒ ΑΒΕΒΑΙΑ, όχι απουσία (αλλιώς κρύβεται ΚΑΘΕ κατάλυμα)', () => {
    for (const blocker of ['stay-pets-undeclared', 'stay-pets-on-request'] as const) {
      expect(isUncertainBlocker(blocker)).toBe(true);
      expect(isCategoricalBlocker(blocker)).toBe(false);
      expect((ABSENCE_BLOCKERS as readonly string[]).includes(blocker)).toBe(false);
      expect((IGNORANCE_BLOCKERS as readonly string[]).includes(blocker)).toBe(true);
    }
  });
});

describe('Ζ2 — η μηχανή ρωτά τον ΙΔΙΟ κριτή', () => {
  const lodge = (pets: StayPetPolicy | null) => listingOf({ minNights: null, maxGuests: 4, pets, nextAvailableFrom: null });
  const seek = (pets: number) => shortStaySeek(NO_AMOUNT_RANGE, NO_NIGHTS_RANGE, partyOf(2, pets));
  const blockersOf = (policy: StayPetPolicy | null, pets: number) => judgeStayTerms(lodge(policy), seek(pets)).blockers;

  it.each([
    [{ accepts: 'no' } as StayPetPolicy, 1, ['stay-pets-not-allowed']],
    [welcomes(1), 2, ['stay-pets-over-limit']],
    [null, 1, ['stay-pets-undeclared']],
    [{ accepts: 'onRequest', maxPets: null, fee: null } as StayPetPolicy, 1, ['stay-pets-on-request']],
    [welcomes(2), 2, []],
  ])('Ζ2.1 — πολιτική %p, φέρνει %p ⇒ %p', (policy, pets, expected) => {
    expect(blockersOf(policy, pets)).toEqual(expected);
  });

  it('Ζ2.2 — χωρίς κατοικίδιο: ούτε το «όχι» ούτε το «δεν δηλώθηκε» εμποδίζουν', () => {
    expect(blockersOf({ accepts: 'no' }, 0)).toEqual([]);
    expect(blockersOf(null, 0)).toEqual([]);
  });

  it('Ζ2.3 — τα κατοικίδια ΔΕΝ είναι άτομα: ούτε η χωρητικότητα ούτε η παρέα τα μετρούν', () => {
    expect(stayHeadcount(partyOf(2, 3))).toBe(2);
    expect(stayPartySize(partyOf(2, 3))).toBe(2);
  });
});

describe('Ζ3 — ανάγνωση: η παλιά παρέα είναι σωστή ως έχει (καμία μετανάστευση)', () => {
  const price = { min: null, max: 90 };
  const readParty = (party: unknown) => {
    const read = readStoredSeeks([{ kind: 'leaseShort', price, nights: NO_NIGHTS_RANGE, party }], {});
    return read.kind === 'read' ? (read.seeks[0] as { party: StayParty | null }).party : 'unreadable';
  };

  it('παρέα χωρίς `pets` (πριν τις 2026-09-18) ⇒ 0 κατοικίδια', () => {
    expect(readParty({ adults: 2, children: 0, infants: 0 })).toEqual(partyOf(2, 0));
  });

  it('χαλασμένα `pets` ⇒ αδιάβαστο, ΠΟΤΕ σιωπηλό 0', () => {
    expect(readParty({ adults: 2, children: 0, infants: 0, pets: 'δύο' })).toBe('unreadable');
  });
});

describe('Ζ4 — αναλλοίωτα: 0..5, και κατοικίδιο ΧΩΡΙΣ ενήλικα δεν γίνεται', () => {
  const violations = (party: StayParty) =>
    demandInvariantViolations({ ...demand(), seeks: [shortStaySeek(NO_AMOUNT_RANGE, NO_NIGHTS_RANGE, party)] });

  it.each([6, 1.5, -1])('pets=%p ⇒ stay-party-invalid', (pets) => {
    expect(violations(partyOf(2, pets))).toContain('stay-party-invalid');
  });

  it('pets 0 ή 5 ⇒ έγκυρα· κατοικίδιο χωρίς ενήλικα ⇒ άκυρο', () => {
    expect(violations(partyOf(2, 0))).not.toContain('stay-party-invalid');
    expect(violations(partyOf(2, 5))).not.toContain('stay-party-invalid');
    expect(violations(partyOf(0, 1))).toContain('stay-party-invalid');
  });
});

describe('Ζ5 — ο σύνδεσμος προς την αναζήτηση', () => {
  const filtersFor = (pets: number) =>
    listingFiltersFromDemand(demand({ seeks: [shortStaySeek(NO_AMOUNT_RANGE, NO_NIGHTS_RANGE, partyOf(2, pets))] }));

  it('τα κατοικίδια ταξιδεύουν ως `pets`· 0 ⇒ `null` (καμία ερώτηση)', () => {
    expect(filtersFor(2).pets).toBe(2);
    expect(filtersFor(0).pets).toBeNull();
    expect(filtersFor(2).guests).toBe(2);
  });
});

describe('Ζ6 — η φόρμα ζήτησης: γύρος χωρίς απώλεια', () => {
  const values = (pets: number | null) => ({
    ...EMPTY_DEMAND_FORM,
    seeks: ['leaseShort'],
    stayParty: { adults: 2, children: null, infants: null, pets },
  });
  const seekOf = (pets: number | null) => demandDraftFrom(demandFormSchema.parse(values(pets))).seeks[0];

  it('2 κατοικίδια ⇒ η παρέα τα κουβαλά', () => {
    expect(seekOf(2)).toEqual(shortStaySeek(NO_AMOUNT_RANGE, NO_NIGHTS_RANGE, partyOf(2, 2)));
  });

  it('κενό ⇒ 0· και στο φόρτωμα το 0 ξαναγίνεται ΚΕΝΟ (όχι «0» που δεν έγραψε κανείς)', () => {
    const seeks = demandDraftFrom(demandFormSchema.parse(values(null))).seeks;
    expect((seeks[0] as { party: StayParty }).party.pets).toBe(0);
    const loaded = demandFormFrom(demand({ seeks }));
    expect(loaded.kind === 'editable' ? loaded.values.stayParty.pets : 'not-editable').toBeNull();
  });
});
