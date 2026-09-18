/**
 * @fileoverview **ΑΓΚΥΡΑ — ΟΡΟΙ ΔΙΑΜΟΝΗΣ ΣΤΗ ΖΗΤΗΣΗ** (ADR-777 §8.60.19): νύχτες και παρέα.
 *
 * 🔴 **Τι φυλάει**: ως τις 2026-09-18 ο ζητών «Διαμονή» δήλωνε **μόνο** €/νύχτα — ένα δυάρι «ταίριαζε» σε
 * πενταμελή οικογένεια, και ένα κατάλυμα με ελάχιστο 7 νύχτες σε ταξίδι τριών. Εδώ ασκείται ολόκληρη η
 * αλυσίδα: κοινός κριτής → μηχανή → υποχωρήσεις → σύνδεσμος → αναλλοίωτα → ανάγνωση → φόρμα.
 *
 * 🔑 **Δεύτερη φωνή**: οι προσδοκίες είναι χειρόγραφοι αριθμοί.
 */

import {
  NO_AMOUNT_RANGE,
  NO_NIGHTS_RANGE,
  demandInvariantViolations,
  demandSeek,
  shortStaySeek,
  type DemandNightsRange,
  type DemandSeek,
  type StayParty,
} from '@/types/property-demand';
import type { PublicListing } from '@/types/public-listing';
import { capacityVerdict, minNightsVerdict, stayAvailabilityFor } from '@/lib/stay/stay-availability';

import { matchDemandAgainstListing } from '../demand-matching';
import {
  ABSENCE_BLOCKERS,
  isCategoricalBlocker,
  isMeasurableBlocker,
  isUncertainBlocker,
} from '../demand-match-vocabulary';
import { buildConcessionReport, MAX_NIGHTS_CONCESSION } from '../demand-concessions';
import { axesLostProjectingDemand, listingFiltersFromDemand } from '../demand-listing-filters';
import { readStoredSeeks } from '../demand-seeks-read';
import { demandDraftFrom, demandFormSchema, EMPTY_DEMAND_FORM } from '../demand-form-values';
import { demandFormFrom } from '../demand-form-load';
import { TODAY, demand, facts, listing } from './demand-fixtures';

/** Κατάλυμα βραχυχρόνιας, 80 €/νύχτα, με τους όρους του κατόχου. */
function lodging(minNights: number | null, maxGuests: number | null): PublicListing {
  return listing({
    commercialStatus: 'unavailable',
    offerKinds: ['leaseShort'],
    commercial: { askingPrice: null, finalPrice: null, rentPrice: null, nightlyRate: 80 },
    stay: { minNights, maxGuests, nextAvailableFrom: null },
  });
}

const party = (adults: number, children = 0, infants = 0): StayParty => ({ adults, children, infants });

/** Ζητών: «Διαμονή», χωρίς όριο τιμής, με τις νύχτες και την παρέα του. */
function traveller(nights: DemandNightsRange, who: StayParty | null, extra: DemandSeek[] = []) {
  return demand({ seeks: [...extra, shortStaySeek(NO_AMOUNT_RANGE, nights, who)] });
}

const judge = (subject: ReturnType<typeof traveller>, item: PublicListing) =>
  matchDemandAgainstListing(subject, facts({ listing: item }), TODAY);

describe('Κ — ΕΝΑΣ κριτής: τα άτομα του `termsVerdict` της αναζήτησης', () => {
  it('χωρητικότητα: άγνωστη · υπέρβαση · χωρά · δεν ρωτήθηκε', () => {
    expect(capacityVerdict(null, 3)).toEqual({ kind: 'terms-unknown' });
    expect(capacityVerdict(4, 5)).toEqual({ kind: 'over-capacity', maxGuests: 4, asked: 5 });
    expect(capacityVerdict(4, 4)).toBeNull();
    expect(capacityVerdict(null, null)).toBeNull();
  });

  it('ελάχιστο νυχτών: `null` δεν εμποδίζει ΠΟΤΕ (όχι `?? 1`)· στο όριο περνά', () => {
    expect(minNightsVerdict(null, 1)).toBeNull();
    expect(minNightsVerdict(5, 5)).toBeNull();
    expect(minNightsVerdict(5, 3)).toEqual({ kind: 'below-min-nights', minNights: 5, asked: 3 });
  });

  it('🔑 η ΣΥΝΘΕΣΗ της αναζήτησης κρατά τη σειρά: η χωρητικότητα λέγεται ΠΡΙΝ τις νύχτες', () => {
    const query = { checkIn: '2027-03-01', checkOut: '2027-03-03', guests: 6 };
    const answer = stayAvailabilityFor(lodging(5, 4), query, { kind: 'undeclared' }, null);
    expect(answer).toEqual({ kind: 'over-capacity', maxGuests: 4, asked: 6 });
  });
});

describe('Τ — κάθε νέο εμπόδιο στην ΤΑΞΗ του (αλλιώς αλλάζει σιωπηλά τι λέγεται «κοντινό»)', () => {
  it('χωρητικότητα = κατηγορικό · αδήλωτη = απουσία · βρέφη = αβεβαιότητα · νύχτες = μετρήσιμο', () => {
    expect(isCategoricalBlocker('stay-over-capacity')).toBe(true);
    expect(ABSENCE_BLOCKERS).toContain('stay-capacity-undeclared');
    expect(isUncertainBlocker('stay-infants-uncertain')).toBe(true);
    expect(isMeasurableBlocker('stay-infants-uncertain')).toBe(false);
    expect(isMeasurableBlocker('stay-nights-below-minimum')).toBe(true);
  });
});

describe('Φ — η παρέα ΚΡΙΝΕΤΑΙ: ενήλικες + παιδιά, τα βρέφη ως ονομασμένη αμφισημία', () => {
  it('2 ενήλικες + 1 παιδί σε κατάλυμα για 4 ⇒ ταιριάζει, ως διαμονή', () => {
    const match = judge(traveller(NO_NIGHTS_RANGE, party(2, 1)), lodging(null, 4));
    expect(match.verdict).toBe('match');
    expect(match.metOn.map((met) => met.kind)).toEqual(['leaseShort']);
  });

  it('🔴 4 ενήλικες + 1 παιδί σε κατάλυμα για 4 ⇒ ΑΠΟΡΡΙΨΗ (κατηγορικό), όχι «κοντινό»', () => {
    const match = judge(traveller(NO_NIGHTS_RANGE, party(4, 1)), lodging(null, 4));
    expect(match.verdict).toBe('no-match');
    expect(match.blockers).toEqual(['stay-over-capacity']);
  });

  it('⚖️ 2 + 2 παιδιά + 1 βρέφος σε κατάλυμα για 4 ⇒ ΚΟΝΤΙΝΟ, «ρώτα τον κάτοχο»', () => {
    const match = judge(traveller(NO_NIGHTS_RANGE, party(2, 2, 1)), lodging(null, 4));
    expect(match.verdict).toBe('near-miss');
    expect(match.blockers).toEqual(['stay-infants-uncertain']);
  });

  it('η αμφισημία ΔΕΝ μαλακώνει την υπέρβαση: 4 + 1 + 1 βρέφος σε 4 ⇒ υπέρβαση', () => {
    const match = judge(traveller(NO_NIGHTS_RANGE, party(4, 1, 1)), lodging(null, 4));
    expect(match.blockers).toEqual(['stay-over-capacity']);
  });

  it('χωρητικότητα ΑΔΗΛΩΤΗ ⇒ απουσία (`stay-capacity-undeclared`), ποτέ «χωράει»', () => {
    const match = judge(traveller(NO_NIGHTS_RANGE, party(2)), lodging(null, null));
    expect(match.verdict).toBe('no-match');
    expect(match.blockers).toEqual(['stay-capacity-undeclared']);
  });

  it('χωρίς παρέα ⇒ η χωρητικότητα δεν κρίνεται, ούτε η αδήλωτη', () => {
    expect(judge(traveller(NO_NIGHTS_RANGE, null), lodging(null, null)).verdict).toBe('match');
  });
});

describe('Ν — οι νύχτες κρίνονται με το ΠΑΝΩ όριο του ζητούντα', () => {
  it('🔴 3–4 νύχτες απέναντι σε ελάχιστο 5 ⇒ κοντινό, 1 ΝΥΧΤΑ στο `nightsShortBy` — ΠΟΤΕ στο `priceOverBy`', () => {
    const match = judge(traveller({ min: 3, max: 4 }, null), lodging(5, null));
    expect(match.verdict).toBe('near-miss');
    expect(match.blockers).toEqual(['stay-nights-below-minimum']);
    expect(match.gaps.nightsShortBy).toBe(1);
    expect(match.gaps.priceOverBy).toBeNull();
    expect(match.metOn).toEqual([]);
  });

  it('4–6 νύχτες απέναντι σε ελάχιστο 6 ⇒ ταιριάζει (το όριο είναι συμπεριληπτικό)', () => {
    expect(judge(traveller({ min: 4, max: 6 }, null), lodging(6, null)).verdict).toBe('match');
  });

  it('«τουλάχιστον 2», χωρίς πάνω όριο ⇒ ΚΑΝΕΝΑ ελάχιστο δεν εμποδίζει', () => {
    expect(judge(traveller({ min: 2, max: null }, null), lodging(7, null)).verdict).toBe('match');
  });

  it('ελάχιστο ΑΔΗΛΩΤΟ ⇒ δεν εμποδίζει (ο κάτοχος δεν είπε `1`)', () => {
    expect(judge(traveller({ min: 1, max: 1 }, null), lodging(null, null)).verdict).toBe('match');
  });
});

describe('Ε — οι όροι ανήκουν στην ΕΝΑΛΛΑΚΤΙΚΗ, όχι στην αγγελία', () => {
  it('«αγορά ή διαμονή»: ακίνητο και προς πώληση που δεν χωρά ⇒ ταιριάζει ΩΣ ΑΓΟΡΑ μόνο', () => {
    const both = listing({ ...lodging(null, 2), offerKinds: ['sell', 'leaseShort'] });
    const match = judge(traveller(NO_NIGHTS_RANGE, party(5), [demandSeek('sell', NO_AMOUNT_RANGE)]), both);
    expect(match.verdict).toBe('match');
    expect(match.metOn.map((met) => met.kind)).toEqual(['sell']);
  });

  it('διαμονή χωρίς τιμή ΑΛΛΑ με παρέα δεν είναι «ανοιχτή»: δεν σώζει δυάρι για πέντε', () => {
    const match = judge(traveller(NO_NIGHTS_RANGE, party(5)), lodging(null, 2));
    expect(match.verdict).toBe('no-match');
  });

  it('ακίνητο ΜΟΝΟ προς πώληση ⇒ μόνο `offer-kind` — κανένας ψευδής λόγος χωρητικότητας', () => {
    const match = judge(traveller(NO_NIGHTS_RANGE, party(2)), listing());
    expect(match.blockers).toEqual(['offer-kind']);
  });
});

describe('Υπ — η υποχώρηση μιλά σε ΝΥΧΤΕΣ, με απόλυτο όριο', () => {
  it(`έως 3 νύχτες: +${MAX_NIGHTS_CONCESSION} ξεκλειδώνουν τα ελάχιστα 4 και 5 — όχι το 7`, () => {
    const subject = traveller({ min: null, max: 3 }, null);
    const nearMisses = [lodging(4, null), lodging(5, null), lodging(7, null)].map((item) => judge(subject, item));
    const [ladder] = buildConcessionReport(subject, nearMisses).ladders;
    expect(ladder.concession).toBe('stay-length');
    expect(ladder.unit).toBe('nights');
    expect(ladder.headline).toEqual({ amount: 2, unlocks: 2 });
  });
});

describe('Σ — ο σύνδεσμος: η παρέα ταξιδεύει ως `guests`, και ΛΕΓΕΤΑΙ τι αγνοείται', () => {
  it('νύχτες + παρέα ⇒ και οι δύο στις απώλειες· χωρίς όρους ⇒ καμία', () => {
    expect(axesLostProjectingDemand(traveller({ min: 3, max: 5 }, party(2)))).toEqual(
      expect.arrayContaining(['stayNights', 'stayParty']),
    );
    const lost = axesLostProjectingDemand(traveller(NO_NIGHTS_RANGE, null));
    expect(lost).not.toContain('stayNights');
    expect(lost).not.toContain('stayParty');
  });

  it('`guests` = ενήλικες + παιδιά, ΧΩΡΙΣ τα βρέφη· χωρίς παρέα ⇒ `null`, ποτέ `1`', () => {
    expect(listingFiltersFromDemand(traveller(NO_NIGHTS_RANGE, party(2, 1, 1))).guests).toBe(3);
    expect(listingFiltersFromDemand(traveller(NO_NIGHTS_RANGE, null)).guests).toBeNull();
  });
});

describe('Α — αναλλοίωτα: νύχτες που είναι νύχτες, παρέα που είναι παρέα', () => {
  const violations = (nights: DemandNightsRange, who: StayParty | null = null, timing = demand().timing) =>
    demandInvariantViolations({ ...traveller(nights, who), timing });

  it.each([
    [{ min: 0, max: null }, true],
    [{ min: 2.5, max: null }, true],
    [{ min: null, max: 1 }, false],
  ])('νύχτες %p ⇒ άκυρες: %p', (nights, invalid) => {
    expect(violations(nights).includes('stay-nights-invalid')).toBe(invalid);
  });

  it('5–3 νύχτες ⇒ `range-inverted`', () => {
    expect(violations({ min: 5, max: 3 })).toContain('range-inverted');
  });

  it('ελάχιστο 5 νύχτες μέσα σε 1–4 Μαρτίου (3 νύχτες) ⇒ δεν χωρά· 3 νύχτες ⇒ χωρά', () => {
    const march = { kind: 'window', fromDate: '2027-03-01', toDate: '2027-03-04' } as const;
    expect(violations({ min: 5, max: null }, null, march)).toContain('stay-nights-exceed-window');
    expect(violations({ min: 3, max: null }, null, march)).not.toContain('stay-nights-exceed-window');
  });

  it('παιδί χωρίς ενήλικα ⇒ `stay-party-invalid`· 2 ενήλικες ⇒ έγκυρη', () => {
    expect(violations(NO_NIGHTS_RANGE, party(0, 1))).toContain('stay-party-invalid');
    expect(violations(NO_NIGHTS_RANGE, party(2))).not.toContain('stay-party-invalid');
  });
});

describe('Δ — ανάγνωση: τα παλιά έγγραφα είναι σωστά ως έχουν (καμία μετανάστευση)', () => {
  const readStay = (stored: unknown) => {
    const read = readStoredSeeks([stored], {});
    return read.kind === 'read' ? read.seeks[0] : 'unreadable';
  };
  const price = { min: null, max: 90 };

  it('`{ kind, price }` (πριν την ερώτηση) ⇒ καμία συνθήκη διαμονής', () => {
    expect(readStay({ kind: 'leaseShort', price })).toEqual(shortStaySeek(price, NO_NIGHTS_RANGE, null));
  });

  it('νύχτες και παρέα διαβάζονται· χαλασμένα ⇒ αδιάβαστο, ποτέ σιωπηλό «καμία συνθήκη»', () => {
    const stored = { kind: 'leaseShort', price, nights: { min: 3, max: 5 }, party: party(2, 0, 1) };
    expect(readStay(stored)).toEqual(shortStaySeek(price, { min: 3, max: 5 }, party(2, 0, 1)));
    expect(readStay({ ...stored, party: { adults: 'δύο', children: 0, infants: 0 } })).toBe('unreadable');
    expect(readStay({ ...stored, nights: 'τρεις' })).toBe('unreadable');
  });
});

describe('Φο — η φόρμα: οι όροι ταξιδεύουν ΜΟΝΟ με επιλεγμένη Διαμονή, και γυρίζουν πίσω ίδιοι', () => {
  const values = (seeks: string[]) => ({
    ...EMPTY_DEMAND_FORM,
    seeks,
    stayNights: { min: 3, max: 5 },
    stayParty: { adults: 2, children: null, infants: 1 },
  });
  const draftOf = (seeks: string[]) => demandDraftFrom(demandFormSchema.parse(values(seeks)));

  it('επιλεγμένη ⇒ η εναλλακτική κουβαλά νύχτες και παρέα (κενά παιδιά = 0, ποτέ επινοημένα)', () => {
    expect(draftOf(['leaseShort']).seeks).toEqual([
      shortStaySeek(NO_AMOUNT_RANGE, { min: 3, max: 5 }, party(2, 0, 1)),
    ]);
  });

  it('αποεπιλεγμένη ⇒ οι όροι δεν ταξιδεύουν (μένουν μόνο στη φόρμα)', () => {
    expect(draftOf(['sell']).seeks.some((seek) => seek.kind === 'leaseShort')).toBe(false);
  });

  it('γύρος: αποθηκευμένη ζήτηση → φόρμα ⇒ τα ίδια πεδία', () => {
    const loaded = demandFormFrom(demand({ seeks: draftOf(['leaseShort']).seeks }));
    expect(loaded.kind).toBe('editable');
    if (loaded.kind !== 'editable') return;
    expect(loaded.values.stayNights).toEqual({ min: 3, max: 5 });
    expect(loaded.values.stayParty).toEqual({ adults: 2, children: 0, infants: 1 });
  });
});
