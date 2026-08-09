/**
 * Unit tests — `isDisplayableInSalesDashboard` (ADR-777 §8.2 ανοιχτό #1).
 *
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ. Μέχρι τις 2026-08-09 η πύλη που αποφασίζει
 * **ποια ακίνητα βλέπει κανείς** δεν είχε **ΚΑΝΕΝΑ** test — και είχε ένα
 * ελάττωμα που έκανε κάθε αγγελία «μόνο προς ενοικίαση» **μονίμως αόρατη**,
 * χωρίς καμία ενέργεια χρήστη να μπορεί να το διορθώσει. Το «0 tests» δεν
 * σήμαινε «απλή συνάρτηση»· σήμαινε «κανείς δεν κοίταξε».
 *
 * ⚠️ ΟΙ ΠΡΟΣΔΟΚΙΕΣ ΕΙΝΑΙ ΧΕΙΡΟΓΡΑΦΕΣ, ΕΠΙΤΗΔΕΣ. Η πύλη παράγει την απάντησή
 * της από τα `requiresAskingPrice`/`requiresRentPrice`. Ένα test που ρωτούσε
 * ΤΑ ΙΔΙΑ κατηγορήματα θα ήταν ο κριτής που κρίνει τον εαυτό του και θα έμενε
 * πράσινο σε κάθε μετάλλαξη (ADR-777 handoff, παγίδα #3). Ο πίνακας παρακάτω
 * είναι **δεύτερη φωνή**: γράφτηκε από την προδιαγραφή, όχι από τον κώδικα.
 */
import {
  isDisplayableInSalesDashboard,
  COMMERCIAL_STATUSES,
  type SalesDisplayEligibilityInput,
} from '@/constants/commercial-statuses';

const AREA = 95;

// =============================================================================
// Κ1 — ΤΟ ΠΡΑΓΜΑΤΙΚΟ ΕΛΑΤΤΩΜΑ: η ενοικίαση ήταν δομικά αόρατη
// =============================================================================

describe('Κ1 — μια αγγελία μόνο προς ενοικίαση πρέπει να εμφανίζεται', () => {
  it('for-rent με ενοίκιο και εμβαδόν, ΧΩΡΙΣ τιμή πώλησης → ορατή', () => {
    // Αυτό ακριβώς φτιάχνει η οθόνη: το πεδίο askingPrice ΔΕΝ ζωγραφίζεται
    // καν για `for-rent`, άρα δεν υπάρχει τιμή πώλησης να δοθεί ποτέ.
    expect(
      isDisplayableInSalesDashboard({
        commercialStatus: 'for-rent',
        rentPrice: 500,
        grossArea: AREA,
      }),
    ).toBe(true);
  });

  it('for-rent ΧΩΡΙΣ ενοίκιο → αόρατη (το ενοίκιο είναι η τιμή της)', () => {
    expect(
      isDisplayableInSalesDashboard({
        commercialStatus: 'for-rent',
        rentPrice: null,
        grossArea: AREA,
      }),
    ).toBe(false);
  });

  it('η τιμή πώλησης ΔΕΝ σώζει μια ενοικίαση χωρίς ενοίκιο', () => {
    // Άγκυρα ενάντια στη «διόρθωση» τύπου «δέξου οποιαδήποτε τιμή»: μια
    // ενοικίαση με τιμή πώλησης και χωρίς ενοίκιο δεν έχει τι να δείξει.
    expect(
      isDisplayableInSalesDashboard({
        commercialStatus: 'for-rent',
        askingPrice: 200_000,
        grossArea: AREA,
      }),
    ).toBe(false);
  });
});

// =============================================================================
// Κ2 — Ο ΠΙΝΑΚΑΣ: κάθε κατάσταση ζητά ΤΑ ΔΙΚΑ ΤΗΣ, χειρόγραφα
// =============================================================================

interface Case {
  readonly name: string;
  readonly input: SalesDisplayEligibilityInput;
  readonly expected: boolean;
}

const CASES: readonly Case[] = [
  // — for-sale: θέλει τιμή πώλησης, ΟΧΙ ενοίκιο —
  { name: 'for-sale με τιμή', input: { commercialStatus: 'for-sale', askingPrice: 200_000, grossArea: AREA }, expected: true },
  { name: 'for-sale χωρίς τιμή', input: { commercialStatus: 'for-sale', grossArea: AREA }, expected: false },
  { name: 'for-sale δεν ζητά ενοίκιο', input: { commercialStatus: 'for-sale', askingPrice: 200_000, rentPrice: null, grossArea: AREA }, expected: true },

  // — for-rent: θέλει ενοίκιο, ΟΧΙ τιμή πώλησης —
  { name: 'for-rent με ενοίκιο', input: { commercialStatus: 'for-rent', rentPrice: 500, grossArea: AREA }, expected: true },
  { name: 'for-rent χωρίς ενοίκιο', input: { commercialStatus: 'for-rent', grossArea: AREA }, expected: false },

  // — for-sale-and-rent: θέλει ΚΑΙ ΤΑ ΔΥΟ (μία τιμή κόβει τη μισή προσφορά) —
  { name: 'διπλό με τιμή και ενοίκιο', input: { commercialStatus: 'for-sale-and-rent', askingPrice: 200_000, rentPrice: 500, grossArea: AREA }, expected: true },
  { name: 'διπλό μόνο με τιμή πώλησης', input: { commercialStatus: 'for-sale-and-rent', askingPrice: 200_000, grossArea: AREA }, expected: false },
  { name: 'διπλό μόνο με ενοίκιο', input: { commercialStatus: 'for-sale-and-rent', rentPrice: 500, grossArea: AREA }, expected: false },

  // — μη-listed: ποτέ ορατά, όσες τιμές κι αν φέρουν —
  { name: 'sold', input: { commercialStatus: 'sold', askingPrice: 200_000, rentPrice: 500, grossArea: AREA }, expected: false },
  { name: 'rented', input: { commercialStatus: 'rented', askingPrice: 200_000, rentPrice: 500, grossArea: AREA }, expected: false },
  { name: 'reserved', input: { commercialStatus: 'reserved', askingPrice: 200_000, grossArea: AREA }, expected: false },
  { name: 'unavailable', input: { commercialStatus: 'unavailable', askingPrice: 200_000, grossArea: AREA }, expected: false },

  // — εμβαδόν: πάντα, ανεξαρτήτως κατάστασης —
  { name: 'for-sale χωρίς εμβαδόν', input: { commercialStatus: 'for-sale', askingPrice: 200_000 }, expected: false },
  { name: 'for-rent χωρίς εμβαδόν', input: { commercialStatus: 'for-rent', rentPrice: 500 }, expected: false },
];

describe('Κ2 — ο πίνακας απαιτήσεων ανά κατάσταση', () => {
  it.each(CASES)('$name → $expected', ({ input, expected }) => {
    expect(isDisplayableInSalesDashboard(input)).toBe(expected);
  });
});

// =============================================================================
// Κ3 — «ΔΕΝ ΕΧΕΙ ΤΙΜΗ» ≠ «ΚΟΣΤΙΖΕΙ 0»
// =============================================================================

describe('Κ3 — μη-τιμές απορρίπτονται, δεν στρογγυλοποιούνται', () => {
  const NON_AMOUNTS = [0, -1, Number.NaN, Number.POSITIVE_INFINITY, null, undefined];

  it.each(NON_AMOUNTS)('askingPrice=%p δεν είναι τιμή για for-sale', (value) => {
    expect(
      isDisplayableInSalesDashboard({
        commercialStatus: 'for-sale',
        askingPrice: value as number | null,
        grossArea: AREA,
      }),
    ).toBe(false);
  });

  it.each(NON_AMOUNTS)('rentPrice=%p δεν είναι τιμή για for-rent', (value) => {
    expect(
      isDisplayableInSalesDashboard({
        commercialStatus: 'for-rent',
        rentPrice: value as number | null,
        grossArea: AREA,
      }),
    ).toBe(false);
  });

  it.each(NON_AMOUNTS)('grossArea=%p δεν είναι εμβαδόν', (value) => {
    expect(
      isDisplayableInSalesDashboard({
        commercialStatus: 'for-sale',
        askingPrice: 200_000,
        grossArea: value as number | null,
      }),
    ).toBe(false);
  });
});

// =============================================================================
// Κ4 — ΚΛΕΙΣΤΗ ΚΑΛΥΨΗ: καμία κατάσταση δεν μένει άρωτη
// =============================================================================

describe('Κ4 — κάθε κατάσταση του λεξιλογίου κρίνεται ρητά', () => {
  it('ο πίνακας Κ2 αγγίζει ΚΑΘΕ τιμή του COMMERCIAL_STATUSES', () => {
    // Χωρίς αυτό, μια όγδοη κατάσταση θα προσγειωνόταν χωρίς κανείς να
    // αποφασίσει αν είναι ορατή — και το πράσινο θα σήμαινε «δεν ρωτήθηκε».
    const covered = new Set(CASES.map((c) => c.input.commercialStatus));
    expect([...COMMERCIAL_STATUSES].filter((s) => !covered.has(s))).toEqual([]);
  });

  it('άγνωστη / κενή κατάσταση δεν εμφανίζεται ποτέ', () => {
    for (const status of ['', 'αντιπαροχή', 'under-negotiation', null, undefined]) {
      expect(
        isDisplayableInSalesDashboard({
          commercialStatus: status as string | null,
          askingPrice: 200_000,
          rentPrice: 500,
          grossArea: AREA,
        }),
      ).toBe(false);
    }
  });
});
