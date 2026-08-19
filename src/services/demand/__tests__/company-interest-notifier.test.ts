/**
 * =============================================================================
 * ΑΓΚΥΡΕΣ ΤΟΥ ΕΙΔΟΠΟΙΗΤΗ ΓΡΑΦΕΙΟΥ — ADR-777 §8.23 / §8.2
 * =============================================================================
 *
 * **Μ0 — Η ΒΑΘΜΟΝΟΜΗΣΗ.** Το πεδίο `createdBy` **υπήρχε πάντα στα δεδομένα** και
 * έλειπε **μόνο από τον τύπο**. Η Μ0 το αποδεικνύει εκτελώντας ανάγνωση στον
 * πραγματικό κώδικα, γιατί ακριβώς αυτή η αόρατη ύπαρξη οδήγησε σε λάθος
 * συμπέρασμα («χρειάζεται μετανάστευση») που παραλίγο να κοστίσει δουλειά που
 * δεν χρειαζόταν.
 *
 * ⚠️ Καμία άγκυρα δεν στέλνει πραγματική ειδοποίηση: το `announceOnePlace` είναι
 * mock.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const announceOnePlace = jest.fn();
const readLiveDemands = jest.fn();
const companyPropertyFactsOf = jest.fn();
const discloseInterest = jest.fn();

jest.mock('@/services/demand/interest-notifier.service', () => ({
  announceOnePlace: (...args: unknown[]) => announceOnePlace(...args),
  MAX_ANNOUNCE_PROPERTIES: 500,
}));
jest.mock('@/services/demand/live-demands.reader', () => ({
  readLiveDemands: (...args: unknown[]) => readLiveDemands(...args),
}));
jest.mock('@/services/demand/place-interest.service', () => ({
  companyPropertyFactsOf: (...args: unknown[]) => companyPropertyFactsOf(...args),
}));
jest.mock('@/lib/demand/demand-interest', () => ({
  discloseInterest: (...args: unknown[]) => discloseInterest(...args),
}));

/**
 * 🔴 **Το ρολόι δίνει ΔΙΑΦΟΡΕΤΙΚΗ τιμή σε κάθε κλήση — και είναι απαραίτητο.**
 *
 * Η πρώτη γραφή της `Σ2` άφησε το πραγματικό `nowISO`, και η μετάλλαξη «κάλεσε το
 * ρολόι ανά ακίνητο» **επέζησε**: δύο διαδοχικές αναγνώσεις μέσα στον ίδιο βρόχο
 * πέφτουν στο **ίδιο χιλιοστό**, οπότε το σύνολο των στιγμών παρέμενε μονοσύνολο
 * και η άγκυρα περνούσε **κατά τύχη**. Με αύξοντα μετρητή, μια δεύτερη ανάγνωση
 * είναι **αδύνατο** να περάσει απαρατήρητη.
 */
let clockTicks = 0;
jest.mock('@/lib/date-local', () => ({
  nowISO: () => `2026-08-19T00:00:${String(clockTicks++).padStart(2, '0')}.000Z`,
  todayLocalDate: () => '2026-08-19',
}));

// eslint-disable-next-line import/first -- τα mocks πρέπει να δηλωθούν πριν τα imports
import {
  announceInterestToCompanyStaff,
  companyReportBalances,
} from '@/services/demand/company-interest-notifier.service';

const REPO_ROOT = join(__dirname, '..', '..', '..', '..');

/** Στήνει τη Firestore ώστε η σάρωση να επιστρέψει τα δοσμένα ακίνητα. */
function dbReturning(docs: Array<Record<string, unknown>>): {
  collection: jest.Mock;
} {
  const chain = { limit: jest.fn(), get: jest.fn() };
  chain.limit.mockReturnValue(chain);
  chain.get.mockResolvedValue({
    docs: docs.map((data) => ({ id: String(data.id), data: () => data })),
  });
  return { collection: jest.fn().mockReturnValue(chain) } as never;
}

function property(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'prop_1',
    name: 'Διαμέρισμα 95 τ.μ.',
    companyId: 'comp_1',
    createdBy: 'usr_ipallilos',
    ...overrides,
  };
}

/** Κάνει τη μηχανή να απαντήσει «τόσοι σε ψάχνουν». */
function withSeekers(count: number | null): void {
  discloseInterest.mockReturnValue({ interest: { disclosure: { count } } });
}

beforeEach(() => {
  jest.clearAllMocks();
  clockTicks = 0;
  readLiveDemands.mockResolvedValue({ demands: [] });
  companyPropertyFactsOf.mockResolvedValue({ listing: {}, place: null });
  announceOnePlace.mockResolvedValue('announced');
  withSeekers(null);
});

// =============================================================================
// Μ0 — Η ΒΑΘΜΟΝΟΜΗΣΗ: Η ΥΠΟΓΡΑΦΗ ΥΠΗΡΧΕ, ΑΛΛΑ ΗΤΑΝ ΑΟΡΑΤΗ
// =============================================================================

describe('🔴 Μ0 — το `createdBy` γράφεται συστηματικά, από ΜΙΑ κεντρική θέση', () => {
  it('η κεντρική υπηρεσία δημιουργίας το γράφει σε ΚΑΘΕ οντότητα', () => {
    const source = readFileSync(
      join(REPO_ROOT, 'src', 'lib', 'firestore', 'entity-creation.service.ts'),
      'utf8',
    );
    expect(source).toContain('createdBy: ctx.uid');
  });

  it('🔑 και η διαδρομή δημιουργίας ακινήτου ΠΕΡΝΑ από εκεί', () => {
    // Αυτό είναι που κάνει την υπογραφή **εγγύηση** και όχι σύμπτωση: κάθε νέο
    // ακίνητο θα την έχει, χωρίς να χρειάζεται να το θυμηθεί κανείς.
    const route = readFileSync(
      join(REPO_ROOT, 'src', 'app', 'api', 'properties', 'create', 'route.ts'),
      'utf8',
    );
    expect(route).toContain('entity-creation.service');
  });

  it('⚠️ και ο τύπος πλέον τη ΔΗΛΩΝΕΙ — η απουσία της ήταν το πραγματικό κενό', () => {
    // Ένα πεδίο που υπάρχει στον δίσκο αλλά όχι στον τύπο είναι αόρατο σε κάθε
    // μελλοντικό αναγνώστη — και οδήγησε σε λάθος συμπέρασμα μέσα σε αυτή τη δουλειά.
    const types = readFileSync(join(REPO_ROOT, 'src', 'types', 'property.ts'), 'utf8');
    expect(types).toContain('createdBy?: string | null');
  });
});

// =============================================================================
// Υ — Η ΥΠΟΓΡΑΦΗ: ΠΟΙΟΣ ΠΑΙΡΝΕΙ ΤΟ EMAIL
// =============================================================================

describe('Υ — ο παραλήπτης είναι αυτός που καταχώρησε το ακίνητο', () => {
  it('Υ1 🔑 — το email πάει στο `createdBy`, όχι σε άλλον', async () => {
    withSeekers(3);
    await announceInterestToCompanyStaff(dbReturning([property()]) as never);

    expect(announceOnePlace).toHaveBeenCalledTimes(1);
    expect(announceOnePlace.mock.calls[0][0]).toMatchObject({
      recipientId: 'usr_ipallilos',
      propertyId: 'prop_1',
    });
  });

  it('Υ2 — ο μισθωτής είναι η ΕΤΑΙΡΕΙΑ, όχι ο άνθρωπος', async () => {
    // Διαφορά από τον ιδιώτη, όπου μισθωτής είναι ο εαυτός του.
    withSeekers(3);
    await announceInterestToCompanyStaff(dbReturning([property()]) as never);

    expect(announceOnePlace.mock.calls[0][0]).toMatchObject({ tenantId: 'comp_1' });
  });

  it('Υ3 🔴 — ΧΩΡΙΣ υπογραφή: δεν ειδοποιείται κανείς, και ΜΕΤΡΙΕΤΑΙ', async () => {
    // ⚠️ Η κρίσιμη άγκυρα. Ένα ακίνητο χωρίς `createdBy` δεν επιτρέπεται ούτε να
    // πάρει αυθαίρετο παραλήπτη ούτε να περάσει ως «καμία είδηση».
    withSeekers(5);
    const report = await announceInterestToCompanyStaff(
      dbReturning([property({ createdBy: null })]) as never,
    );

    expect(announceOnePlace).not.toHaveBeenCalled();
    expect(report.unsigned).toBe(1);
    expect(report.noNews).toBe(0);
  });

  it('Υ4 — κενή συμβολοσειρά μετράει κι αυτή ως ΧΩΡΙΣ υπογραφή', async () => {
    withSeekers(5);
    const report = await announceInterestToCompanyStaff(
      dbReturning([property({ createdBy: '' })]) as never,
    );

    expect(report.unsigned).toBe(1);
  });

  it('Υ5 🔴 — χωρίς υπογραφή ΔΕΝ γίνεται καν η δουλειά του ταιριάσματος', async () => {
    // Υπολογισμός που δεν μπορεί να καταλήξει πουθενά είναι σπατάλη — και χειρότερα,
    // θα εμφανιζόταν στα logs σαν κανονικό πέρασμα.
    withSeekers(5);
    await announceInterestToCompanyStaff(
      dbReturning([property({ createdBy: undefined })]) as never,
    );

    expect(companyPropertyFactsOf).not.toHaveBeenCalled();
    expect(discloseInterest).not.toHaveBeenCalled();
  });
});

// =============================================================================
// Λ — ΚΛΕΙΣΤΗ ΛΟΓΙΣΤΙΚΗ
// =============================================================================

describe('Λ — η λογιστική κλείνει, αλλιώς ουρλιάζει', () => {
  it('Λ1 — κάθε ακίνητο προσγειώνεται σε ΑΚΡΙΒΩΣ έναν κάδο', async () => {
    discloseInterest
      .mockReturnValueOnce({ interest: { disclosure: { count: 3 } } })
      .mockReturnValueOnce({ interest: { disclosure: { count: null } } });
    announceOnePlace.mockResolvedValue('announced');

    const report = await announceInterestToCompanyStaff(
      dbReturning([
        property({ id: 'p1' }),
        property({ id: 'p2' }),
        property({ id: 'p3', createdBy: null }),
      ]) as never,
    );

    expect(report.announced).toBe(1);
    expect(report.noNews).toBe(1);
    expect(report.unsigned).toBe(1);
    expect(report.considered).toBe(3);
    expect(companyReportBalances(report)).toBe(true);
  });

  it('Λ2 — ο έλεγχος ισοζυγίου πιάνει ασυμφωνία', () => {
    const base = {
      announced: 1, alreadyKnown: 0, noNews: 0, optedOut: 0,
      unsigned: 0, considered: 1, truncated: false,
    };
    expect(companyReportBalances(base)).toBe(true);
    expect(companyReportBalances({ ...base, considered: 5 })).toBe(false);
  });

  it('Λ3 🔴 — ασυνεπής λογιστική ⇒ σφάλμα ΜΕ ΟΝΟΜΑ, όχι σιωπή', async () => {
    // Το `announceOnePlace` επιστρέφει άγνωστη κατάληξη ⇒ πέφτει στον κλάδο
    // `opted-out`· η λογιστική εξακολουθεί να κλείνει. Εδώ ελέγχεται ότι ο φρουρός
    // υπάρχει και είναι εκτελέσιμος με πραγματική είσοδο.
    withSeekers(3);
    announceOnePlace.mockResolvedValue('opted-out');

    const report = await announceInterestToCompanyStaff(
      dbReturning([property()]) as never,
    );

    expect(report.optedOut).toBe(1);
    expect(companyReportBalances(report)).toBe(true);
  });

  it('Λ4 — άδεια συλλογή ⇒ όλα μηδέν, και η λογιστική κλείνει', async () => {
    const report = await announceInterestToCompanyStaff(dbReturning([]) as never);

    expect(report.considered).toBe(0);
    expect(report.truncated).toBe(false);
    expect(companyReportBalances(report)).toBe(true);
  });
});

// =============================================================================
// Σ — ΣΥΜΒΟΛΑΙΟ ΜΕ ΤΗ ΜΗΧΑΝΗ
// =============================================================================

describe('Σ — η μηχανή είναι Η ΙΔΙΑ με του πάνελ', () => {
  it('Σ1 🔑 — τα γεγονότα χτίζονται από τον ΚΟΙΝΟ μεταφραστή', async () => {
    // ⚠️ Δεύτερος μεταφραστής θα μπορούσε να δείξει **διαφορετικό αριθμό για το ίδιο
    // ακίνητο** στο πάνελ και στο email — με τους δύο να φαίνονται σωστοί.
    withSeekers(3);
    await announceInterestToCompanyStaff(dbReturning([property()]) as never);

    expect(companyPropertyFactsOf).toHaveBeenCalledTimes(1);
  });

  it('Σ2 — ΜΙΑ ανάγνωση ρολογιού για όλο το πέρασμα', async () => {
    // Δύο αναγνώσεις θα έκριναν τα πρώτα ακίνητα σε άλλη στιγμή από τα τελευταία,
    // δηλαδή η φρεσκάδα μιας ζήτησης θα μπορούσε να λήξει **στη μέση** της σάρωσης.
    withSeekers(3);
    await announceInterestToCompanyStaff(
      dbReturning([property({ id: 'p1' }), property({ id: 'p2' })]) as never,
    );

    const moments = companyPropertyFactsOf.mock.calls.map((call) => call[2]);
    expect(moments).toHaveLength(2);
    expect(new Set(moments).size).toBe(1);
  });
});
