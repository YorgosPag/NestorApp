/**
 * @fileoverview **ΑΓΚΥΡΑ — Η ΧΡΕΩΣΗ ΚΑΤΟΙΚΙΔΙΟΥ ΜΕΣΑ ΣΤΟ ΣΥΝΟΛΟ** (ADR-777 §8.60.21.7, Φ5).
 *
 * 🔴 **Τι φυλάει**: ως τις 2026-09-19 το `stayQuoteOf` αγνοούσε τα κατοικίδια — η αναζήτηση
 * **έκρυβε** το σύνολο και το αίτημα δεν ρωτούσε καν. Εδώ ασκείται η αλυσίδα της τιμής:
 * αριθμητική των τεσσάρων τρόπων → ολόκληρο σύνολο → σχήμα αιτήματος → στιγμιότυπο κράτησης.
 *
 * 🔑 **Δεύτερη φωνή**: κάθε προσδοκία είναι χειρόγραφος αριθμός σε λεπτά («10 € × 2 × 3 = 60 €»),
 * ποτέ αντίγραφο του τύπου της μηχανής.
 */

import { stayCalendarCommandFrom } from '@/lib/stay/stay-calendar-command';
import { stayBookingFromDocument } from '@/lib/stay/stay-calendar-from-document';
import { stayQuoteOf, type StayPricedQuote } from '@/lib/stay/stay-nightly-quote';
import { petFeeOf, petFeeUnits } from '@/lib/stay/stay-quote-fees';
import { stayBookingPriceFrom, stayBookingPriceOf } from '@/lib/stay/stay-quote-record';
import type { PetFeeBasis, StayPetPolicy } from '@/types/property-offers';

import { listingOf } from './stay-rules-fixtures';

const IN = '2026-09-10';
const OUT = '2026-09-13'; // 3 νύχτες

const charging = (amount: number, per: PetFeeBasis, accepts: 'yes' | 'onRequest' = 'yes'): StayPetPolicy =>
  ({ accepts, maxPets: 3, fee: { amount, per } });

/** 80 €/νύχτα (`listingOf`) με τη δοσμένη πολιτική. */
const lodge = (pets: StayPetPolicy | null) => listingOf({ minNights: null, maxGuests: 4, pets, nextAvailableFrom: null });

// =============================================================================
// Π — Η ΑΡΙΘΜΗΤΙΚΗ ΤΩΝ ΤΕΣΣΑΡΩΝ ΤΡΟΠΩΝ (Airbnb Help 3623)
// =============================================================================

describe('Π — χρέωση κατοικιδίου: τιμή μονάδας × μονάδες, σε ακέραια λεπτά', () => {
  it.each<[PetFeeBasis, number, number]>([
    // τρόπος · μονάδες για 2 κατοικίδια × 3 νύχτες · ποσό με 10 €
    ['stay', 1, 1000],
    ['night', 3, 3000],
    ['pet', 2, 2000],
    ['petNight', 6, 6000],
  ])('Π1 — %s: %i μονάδες ⇒ %i λεπτά', (basis, units, amountMinor) => {
    expect(petFeeUnits(basis, 2, 3)).toBe(units);
    expect(petFeeOf(charging(10, basis), 2, 3)).toEqual({
      kind: 'fee', fee: { kind: 'pet', basis, unitMinor: 1000, units, pets: 2, amountMinor },
    });
  });

  it('Π2 — ΜΙΑ στρογγύλευση, στη μονάδα: 1,005 € × 3 νύχτες = 303 λεπτά (όχι 301,5 → 302)', () => {
    expect(petFeeOf(charging(1.005, 'night'), 1, 3)).toMatchObject({ kind: 'fee', fee: { unitMinor: 101, amountMinor: 303 } });
  });

  it('Π3 — «κατόπιν συνεννόησης» ΧΡΕΩΝΕΙ: ο επισκέπτης μαθαίνει το ποσό ΠΡΙΝ ζητήσει', () => {
    expect(petFeeOf(charging(15, 'stay', 'onRequest'), 1, 3)).toMatchObject({ kind: 'fee', fee: { amountMinor: 1500 } });
  });

  it.each<[string, StayPetPolicy | null, number | null]>([
    ['κανένα κατοικίδιο (null)', charging(10, 'night'), null],
    ['κανένα κατοικίδιο (0)', charging(10, 'night'), 0],
    ['πολιτική αδήλωτη (το εμπόδιο το λέει ο κριτής)', null, 1],
    ['«όχι» (το εμπόδιο το λέει ο κριτής)', { accepts: 'no' }, 1],
    ['δέχεται χωρίς χρέωση', { accepts: 'yes', maxPets: null, fee: null }, 2],
  ])('Π4 — %s ⇒ καμία γραμμή', (_label, policy, pets) => {
    expect(petFeeOf(policy, pets, 3)).toEqual({ kind: 'none' });
  });

  it('🔴 Π5 — χρέωση που δεν γίνεται λεπτά ⇒ `unpriced`, ΠΟΤΕ σιωπηλό 0', () => {
    expect(petFeeOf(charging(0, 'stay'), 1, 3)).toEqual({ kind: 'unpriced' });
    expect(petFeeOf(charging(-5, 'stay'), 1, 3)).toEqual({ kind: 'unpriced' });
  });
});

// =============================================================================
// Ο — ΤΟ ΣΥΝΟΛΟ: ΝΥΧΤΕΣ + ΧΡΕΩΣΕΙΣ, ΑΠΟ ΤΗΝ ΙΔΙΑ ΣΥΝΑΡΤΗΣΗ
// =============================================================================

describe('Ο — stayQuoteOf: το σύνολο είναι ΟΛΟΚΛΗΡΟ', () => {
  it('Ο1 — 80 € × 3 νύχτες + 10 € × 2 κατοικίδια × 3 νύχτες = 240 € + 60 € = 300 €', () => {
    const quote = stayQuoteOf(lodge(charging(10, 'petNight')), {}, { checkIn: IN, checkOut: OUT, pets: 2 });
    expect(quote).toMatchObject({
      kind: 'priced',
      nightsMinor: 24000,
      fees: [{ kind: 'pet', basis: 'petNight', unitMinor: 1000, units: 6, pets: 2, amountMinor: 6000 }],
      totalMinor: 30000,
    });
  });

  it('Ο2 — αναλλοίωτο: σύνολο = νύχτες + χρεώσεις, για κάθε τρόπο', () => {
    for (const basis of ['stay', 'night', 'pet', 'petNight'] as const) {
      const quote = stayQuoteOf(lodge(charging(7.5, basis)), {}, { checkIn: IN, checkOut: OUT, pets: 3 });
      if (quote === null || quote.kind !== 'priced') throw new Error(basis);
      expect(quote.totalMinor).toBe(quote.nightsMinor + quote.fees.reduce((sum, fee) => sum + fee.amountMinor, 0));
    }
  });

  it('🔴 Ο3 — χρέωση που δεν διαβάζεται ⇒ `unpriced` με ΟΝΟΜΑ (`missingFees`), ποτέ σύνολο χωρίς αυτήν', () => {
    expect(stayQuoteOf(lodge(charging(0, 'night')), {}, { checkIn: IN, checkOut: OUT, pets: 1 }))
      .toEqual({ kind: 'unpriced', missing: [], missingFees: ['pet'] });
  });
});

// =============================================================================
// Ε — ΤΟ ΣΧΗΜΑ ΤΟΥ ΑΙΤΗΜΑΤΟΣ: ΚΑΤΟΙΚΙΔΙΑ ΚΑΙ ΤΟ ΣΥΝΟΛΟ ΠΟΥ ΕΙΔΕ Ο ΕΠΙΣΚΕΠΤΗΣ
// =============================================================================

describe('Ε — αίτημα: `pets` και `expectedTotalMinor` ΥΠΟΧΡΕΩΤΙΚΑ, ποτέ σιωπηλά', () => {
  const base = { action: 'request', checkIn: '2027-10-10', checkOut: '2027-10-12', guests: 2, riskAcknowledged: false };

  it('Ε1 — έγκυρο: 0..5 κατοικίδια, σύνολο σε λεπτά ή ρητό null', () => {
    expect(stayCalendarCommandFrom({ ...base, pets: 2, expectedTotalMinor: 16000 })).toMatchObject({
      ok: true, command: { pets: 2, expectedTotalMinor: 16000 },
    });
    expect(stayCalendarCommandFrom({ ...base, pets: 0, expectedTotalMinor: null }).ok).toBe(true);
  });

  it.each<[string, Record<string, unknown>, string]>([
    ['χωρίς `pets`', { expectedTotalMinor: 100 }, 'pets'],
    ['6 κατοικίδια', { pets: 6, expectedTotalMinor: 100 }, 'pets'],
    ['1,5 κατοικίδιο', { pets: 1.5, expectedTotalMinor: 100 }, 'pets'],
    ['χωρίς σύνολο', { pets: 0 }, 'expectedTotalMinor'],
    ['σύνολο σε ευρώ με υποδιαστολή', { pets: 0, expectedTotalMinor: 160.5 }, 'expectedTotalMinor'],
  ])('Ε2 — %s ⇒ malformed', (_label, extra, field) => {
    expect(stayCalendarCommandFrom({ ...base, ...extra })).toEqual({ ok: false, malformed: [field] });
  });
});

// =============================================================================
// Σ — ΤΟ ΣΤΙΓΜΙΟΤΥΠΟ ΤΗΣ ΚΡΑΤΗΣΗΣ
// =============================================================================

function pricedQuote(): StayPricedQuote {
  const quote = stayQuoteOf(lodge(charging(10, 'pet')), {}, { checkIn: IN, checkOut: OUT, pets: 2 });
  if (quote === null || quote.kind !== 'priced') throw new Error('unpriced');
  return quote;
}

describe('Σ — στιγμιότυπο τιμής: διαβάζεται ΜΟΝΟ αν η αριθμητική κλείνει', () => {
  it('Σ1 — γύρος χωρίς απώλεια: γράφεται ⇒ διαβάζεται ίδιο (μέσω JSON, όπως ο δίσκος)', () => {
    const price = stayBookingPriceOf(pricedQuote());
    expect(price).toMatchObject({ currency: 'EUR', nightsMinor: 24000, totalMinor: 26000 });
    expect(stayBookingPriceFrom(JSON.parse(JSON.stringify(price)))).toEqual(price);
  });

  it('Σ2 — απόν / null ⇒ «δεν τιμολογήθηκε» (null), ποτέ χαλασμένο', () => {
    expect(stayBookingPriceFrom(undefined)).toBeNull();
    expect(stayBookingPriceFrom(null)).toBeNull();
  });

  it.each<[string, (raw: Record<string, unknown>) => Record<string, unknown>]>([
    ['σύνολο ≠ νύχτες + χρεώσεις', (raw) => ({ ...raw, totalMinor: 99999 })],
    ['νύχτες ≠ Σ νυχτών', (raw) => ({ ...raw, nightsMinor: 1 })],
    ['χρέωση ≠ μονάδα × μονάδες', (raw) => ({ ...raw, fees: [{ ...(raw.fees as object[])[0], amountMinor: 1 }] })],
    ['άλλο νόμισμα', (raw) => ({ ...raw, currency: 'USD' })],
    ['ποσό σε ευρώ με υποδιαστολή', (raw) => ({ ...raw, totalMinor: 260.5 })],
  ])('🔴 Σ3 — %s ⇒ χαλασμένο (undefined), ποτέ «σχεδόν σωστό»', (_label, corrupt) => {
    const raw = JSON.parse(JSON.stringify(stayBookingPriceOf(pricedQuote()))) as Record<string, unknown>;
    expect(stayBookingPriceFrom(corrupt(raw))).toBeUndefined();
  });
});

// =============================================================================
// Κ — Η ΚΡΑΤΗΣΗ ΣΤΟΝ ΔΙΣΚΟ: ΠΑΛΙΑ ΕΓΓΡΑΦΑ ΧΩΡΙΣ ΜΕΤΑΝΑΣΤΕΥΣΗ
// =============================================================================

describe('Κ — αναγνώστης κράτησης: `pets` και `price`', () => {
  const STAMP = '2026-09-01T10:00:00.000Z';
  const stored = (extra: Record<string, unknown> = {}) => ({
    propertyId: 'prop_1', offerKind: 'leaseShort', covers: [{ propertyId: 'prop_1', spaceId: null }],
    checkIn: '2027-10-10', checkOut: '2027-10-12', holder: { kind: 'offline', label: 'Μαρία' }, channel: 'direct',
    authorUserId: 'user-1', guests: 2, lifecycle: 'confirmed', riskDisclosedAt: null, hold: null, resolution: null,
    guestUserId: null, createdAt: STAMP, updatedAt: STAMP, ...extra,
  });

  it('Κ1 — κράτηση πριν τη Φ5 ⇒ `pets: null` («δεν ρωτήθηκε»), `price: null` — ΚΑΜΙΑ μετανάστευση', () => {
    expect(stayBookingFromDocument(stored(), 'stay_1')).toMatchObject({ pets: null, price: null });
  });

  it('Κ2 — `0` κατοικίδια είναι ΡΗΤΗ απάντηση, όχι απουσία', () => {
    expect(stayBookingFromDocument(stored({ pets: 0 }), 'stay_1')).toMatchObject({ pets: 0 });
  });

  it('🔴 Κ3 — χαλασμένα `pets` ή `price` ⇒ η κράτηση δεν διαβάζεται (αυστηρό δόγμα), ποτέ σιωπηλό «κανένα»', () => {
    expect(stayBookingFromDocument(stored({ pets: 9 }), 'stay_1')).toBeNull();
    expect(stayBookingFromDocument(stored({ price: { kind: 'priced', currency: 'EUR' } }), 'stay_1')).toBeNull();
  });
});
