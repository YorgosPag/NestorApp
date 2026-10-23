/**
 * ADR-919 §7 (βήμα 3) — η διαθεσιμότητα της αγγελίας: μονάδα → κτίριο, «το γεγονός νικά την υπόσχεση», Α7.
 */

import {
  readAvailabilityDeclaration,
  resolveListingAvailability,
  type ListingAvailabilitySources,
} from '../listing-availability';
import { readStoredAvailability } from '../public-listing-shape-judges';
import { LISTING_AVAILABILITY_READY, LISTING_AVAILABILITY_UNKNOWN } from '@/types/listing-availability';

const AT = '2026-10-23T10:00:00.000Z';

const declared = (precision: string, anchor: string) => ({
  provenance: 'declared',
  value: { precision, anchor },
  at: AT,
});

const inferred = (anchor: string, confirmedAt: string | null) => ({
  provenance: 'inferred',
  value: { precision: 'month', anchor },
  at: AT,
  confidence: 0.8,
  confirmedAt,
});

const Q3_2027 = { kind: 'scheduled', precision: 'quarter', window: { start: '2027-07-01', end: '2027-09-30' } };
const MAR_2027 = { kind: 'scheduled', precision: 'month', window: { start: '2027-03-01', end: '2027-03-31' } };

/** Μονάδα εταιρείας σε κτίριο υπό κατασκευή, χωρίς καμία δήλωση. */
function sources(overrides: Partial<ListingAvailabilitySources> = {}): ListingAvailabilitySources {
  return {
    unitDeclaration: null,
    unitOperationalStatus: 'draft',
    propertyType: 'apartment',
    isNewConstruction: null,
    building: { status: 'construction', completionDeclaration: null },
    ...overrides,
  };
}

describe('Σ — η σειρά: μονάδα → κτίριο', () => {
  it('καμία πηγή ⇒ unknown, ποτέ «διαθέσιμο»', () => {
    expect(resolveListingAvailability(sources())).toEqual(LISTING_AVAILABILITY_UNKNOWN);
  });

  it('η δήλωση του κτιρίου ⇒ scheduled με το διάστημα της ακρίβειας', () => {
    const building = { status: 'construction', completionDeclaration: declared('quarter', '2027-08-15') };
    expect(resolveListingAvailability(sources({ building }))).toEqual(Q3_2027);
  });

  it('η δήλωση της μονάδας νικά τη δήλωση του κτιρίου', () => {
    const building = { status: 'construction', completionDeclaration: declared('quarter', '2027-08-15') };
    const unitDeclaration = declared('month', '2027-03-10');
    expect(resolveListingAvailability(sources({ building, unitDeclaration }))).toEqual(MAR_2027);
  });

  it('η δήλωση της μονάδας νικά και το «έτοιμο» (ενοικιαζόμενο με ένοικο σε παραδομένο κτίριο)', () => {
    const building = { status: 'completed', completionDeclaration: null };
    const unitDeclaration = declared('month', '2027-03-10');
    expect(resolveListingAvailability(sources({ building, unitDeclaration, unitOperationalStatus: 'ready' })))
      .toEqual(MAR_2027);
  });
});

describe('Ε — έτοιμο: το γεγονός νικά την υπόσχεση', () => {
  it.each(['completed', 'active'])('κτίριο «%s» ⇒ ready, παρά την παλιά δήλωση παράδοσης', (status) => {
    const building = { status, completionDeclaration: declared('quarter', '2027-08-15') };
    expect(resolveListingAvailability(sources({ building }))).toEqual(LISTING_AVAILABILITY_READY);
  });

  it('μονάδα `ready` ⇒ ready, ακόμη κι αν το κτίριο υπόσχεται άλλη ημερομηνία', () => {
    const building = { status: 'construction', completionDeclaration: declared('quarter', '2027-08-15') };
    expect(resolveListingAvailability(sources({ building, unitOperationalStatus: 'ready' })))
      .toEqual(LISTING_AVAILABILITY_READY);
  });

  it('γη ⇒ ready (δεν χτίζεται)', () => {
    expect(resolveListingAvailability(sources({ propertyType: 'plot', building: null })))
      .toEqual(LISTING_AVAILABILITY_READY);
  });

  it('υπάρχον απόθεμα (RESO NewConstructionYN = false) χωρίς δήλωση ⇒ ready', () => {
    expect(resolveListingAvailability(sources({ isNewConstruction: false, building: null })))
      .toEqual(LISTING_AVAILABILITY_READY);
  });

  it('υπάρχον απόθεμα με «διαθέσιμο από» ⇒ η δήλωση', () => {
    const unitDeclaration = declared('month', '2027-03-10');
    expect(resolveListingAvailability(sources({ isNewConstruction: false, building: null, unitDeclaration })))
      .toEqual(MAR_2027);
  });

  it('το ψευδώνυμο `in_progress` του κτιρίου ΔΕΝ είναι «παραδομένο»', () => {
    expect(resolveListingAvailability(sources({ building: { status: 'in_progress', completionDeclaration: null } })))
      .toEqual(LISTING_AVAILABILITY_UNKNOWN);
  });
});

describe('Κ — η σιωπή είναι τίμια', () => {
  it('μονάδα εταιρείας χωρίς κτίριο και χωρίς δήλωση ⇒ unknown (η εταιρεία πουλά και off-plan)', () => {
    expect(resolveListingAvailability(sources({ building: null }))).toEqual(LISTING_AVAILABILITY_UNKNOWN);
  });

  it('`isNewConstruction: null` δεν διαβάζεται ποτέ ως «υπάρχον»', () => {
    expect(resolveListingAvailability(sources({ building: null, isNewConstruction: null })))
      .toEqual(LISTING_AVAILABILITY_UNKNOWN);
  });

  it('νεόδμητο σε κτίριο υπό κατασκευή χωρίς δήλωση ⇒ unknown', () => {
    expect(resolveListingAvailability(sources({ isNewConstruction: true }))).toEqual(LISTING_AVAILABILITY_UNKNOWN);
  });
});

describe('Α7 — τίποτα δημόσιο χωρίς ανθρώπινη έγκριση', () => {
  it('πρόβλεψη του χρονοδιαγράμματος χωρίς `confirmedAt` ⇒ σαν να μην υπάρχει', () => {
    const building = { status: 'construction', completionDeclaration: inferred('2027-02-06', null) };
    expect(resolveListingAvailability(sources({ building }))).toEqual(LISTING_AVAILABILITY_UNKNOWN);
  });

  it('η ίδια πρόβλεψη ΜΕ έγκριση ⇒ δημόσια υπόσχεση', () => {
    const building = { status: 'construction', completionDeclaration: inferred('2027-02-06', AT) };
    expect(resolveListingAvailability(sources({ building }))).toEqual({
      kind: 'scheduled',
      precision: 'month',
      window: { start: '2027-02-01', end: '2027-02-28' },
    });
  });

  it('μη εγκεκριμένη δήλωση μονάδας πέφτει στη δήλωση του κτιρίου', () => {
    const building = { status: 'construction', completionDeclaration: declared('quarter', '2027-08-15') };
    expect(resolveListingAvailability(sources({ building, unitDeclaration: inferred('2027-03-10', null) })))
      .toEqual(Q3_2027);
  });
});

describe('Δ — η αποθηκευμένη δήλωση: ό,τι δεν στέκει δεν υπάρχει', () => {
  it('ανύπαρκτη ημέρα ⇒ πέφτει στο επόμενο σκαλί, ποτέ «διορθωμένη»', () => {
    const building = { status: 'construction', completionDeclaration: declared('quarter', '2027-08-15') };
    expect(resolveListingAvailability(sources({ building, unitDeclaration: declared('day', '2027-02-30') })))
      .toEqual(Q3_2027);
  });

  it.each([
    ['χωρίς `at`', { provenance: 'declared', value: { precision: 'day', anchor: '2027-01-01' } }],
    ['άγνωστη ακρίβεια', declared('year', '2027-01-01')],
    ['μετρημένη ημερομηνία παράδοσης', { ...declared('day', '2027-01-01'), provenance: 'measured', sourceRef: 'x' }],
    ['inferred χωρίς απάντηση `confirmedAt`', { ...inferred('2027-01-01', null), confirmedAt: undefined }],
    ['inferred με εμπιστοσύνη εκτός 0..1', { ...inferred('2027-01-01', AT), confidence: 2 }],
    ['ωμή συμβολοσειρά (σαν το `completionDate`)', '2027-01-01'],
  ])('%s ⇒ null', (_label, raw) => {
    expect(readAvailabilityDeclaration(raw)).toBeNull();
  });

  it('έγκυρη δήλωση ⇒ τύπος με τα πεδία του σκέλους της', () => {
    expect(readAvailabilityDeclaration(inferred('2027-02-06', null))).toEqual(inferred('2027-02-06', null));
    expect(readAvailabilityDeclaration(declared('day', '2027-01-01'))).toEqual(declared('day', '2027-01-01'));
  });
});

describe('Μ — ο κριτής του σχήματος (κρίκος 25)', () => {
  it('απούσα ή χαλασμένη ⇒ unknown, ποτέ ready', () => {
    for (const raw of [undefined, null, {}, { kind: 'ready!' }, { kind: 'scheduled' }]) {
      expect(readStoredAvailability(raw)).toEqual(LISTING_AVAILABILITY_UNKNOWN);
    }
  });

  it('έγκυρη τιμή περνά αυτούσια (ιδιοδύναμο)', () => {
    for (const value of [LISTING_AVAILABILITY_READY, LISTING_AVAILABILITY_UNKNOWN, Q3_2027]) {
      expect(readStoredAvailability(readStoredAvailability(value))).toEqual(value);
    }
  });

  it('«τρίμηνο» με τέλος που δεν είναι το τέλος του τριμήνου ⇒ unknown', () => {
    const forged = { ...Q3_2027, window: { start: '2027-07-01', end: '2027-08-31' } };
    expect(readStoredAvailability(forged)).toEqual(LISTING_AVAILABILITY_UNKNOWN);
  });
});
