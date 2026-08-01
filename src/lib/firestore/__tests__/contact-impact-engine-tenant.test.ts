/**
 * ⚓ ADR-742 §7octies — **η μηχανή επιπτώσεων φιλτράρει ΠΑΝΤΑ κατά tenant**
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΤΙ ΦΥΛΑΕΙ ΚΑΙ ΓΙΑΤΙ ΚΑΝΕΝΑ ΑΛΛΟ TEST ΔΕΝ ΤΟ ΕΠΙΑΝΕ
 * ─────────────────────────────────────────────────────────────────────────────
 * Μέχρι τις 2026-08-01 οι τρεις εκτελεστές του `contact-impact-engine` ρωτούσαν:
 *
 * ```ts
 * if (!query.skipCompanyFilter && companyId) {   // ← η δεύτερη συνθήκη
 *   q = q.where('companyId', '==', companyId);
 * }
 * ```
 *
 * Η παράμετρος ήταν `companyId?` και **κανένας** από τους έξι καλούντες δεν την
 * περνούσε — ένας μάλιστα έγραφε ρητά `undefined` για να φτάσει στην πέμπτη
 * θέση. Άρα το φίλτρο **δεν έτρεξε ποτέ**: τα preview μετρούσαν εγγραφές
 * **όλων** των πελατών. Όχι μαντείο ύπαρξης — **διαρροή περιεχομένου**.
 *
 * 🔴 Τα υπάρχοντα tests έμεναν πράσινα γιατί ρωτούσαν *«πόσα μέτρησε;»* πάνω σε
 * mock που επέστρεφε σταθερά πλήθη. **Κανένα δεν ρωτούσε ποιο `where` μπήκε.**
 * Γι' αυτό εδώ η επαλήθευση είναι στις **κλήσεις** `where`, όχι στο αποτέλεσμα.
 *
 * @module lib/firestore/__tests__/contact-impact-engine-tenant
 * @see ADR-742 §7octies · `deletion-guard.ts` (η αδελφή μηχανή που το έκανε σωστά)
 */

jest.mock('server-only', () => ({}));

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: jest.fn(),
}));

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ warn: jest.fn(), error: jest.fn(), info: jest.fn(), debug: jest.fn() }),
}));

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { FIELDS } from '@/config/firestore-field-constants';
import { computeContactImpact } from '../contact-impact-engine';

const mockedGetAdminFirestore = getAdminFirestore as jest.MockedFunction<typeof getAdminFirestore>;

const TENANT = 'comp_owner';

interface WhereCall {
  readonly field: string;
  readonly op: string;
  readonly value: unknown;
}

/**
 * Καταγράφει **κάθε** `where` που έφτασε στο Firestore. Το ζητούμενο δεν είναι
 * το πλήθος που επιστρέφεται αλλά **ποια ερώτηση διατυπώθηκε**.
 */
function setupSpy(): WhereCall[] {
  const calls: WhereCall[] = [];

  const makeQuery = (): Record<string, unknown> => {
    const q: Record<string, unknown> = {};
    q['where'] = jest.fn((field: string, op: string, value: unknown) => {
      calls.push({ field, op, value });
      return q;
    });
    q['select'] = jest.fn(() => q);
    q['get'] = jest.fn(async () => ({ size: 0, empty: true, docs: [] }));
    q['doc'] = jest.fn(() => ({ collection: jest.fn(() => makeQuery()) }));
    return q;
  };

  mockedGetAdminFirestore.mockReturnValue({
    collection: jest.fn(() => makeQuery()),
  } as never);

  return calls;
}

beforeEach(() => {
  mockedGetAdminFirestore.mockReset();
});

describe('⚓ contact impact engine — απομόνωση μισθωτή', () => {
  it('🔴 ΚΑΘΕ εξάρτηση χωρίς `skipCompanyFilter` φιλτράρεται κατά companyId', async () => {
    const calls = setupSpy();

    await computeContactImpact('contact_1', 'identityChange', 'individual', TENANT);

    const tenantFilters = calls.filter((c) => c.field === FIELDS.COMPANY_ID);

    // Ο έλεγχος που έλειπε: υπήρξε **έστω μία** ερώτηση με tenant.
    // Πριν την §7octies αυτός ο αριθμός ήταν **0** σε κάθε σενάριο.
    expect(tenantFilters.length).toBeGreaterThan(0);

    // …και καμία δεν ρώτησε για **άλλον** μισθωτή.
    for (const filter of tenantFilters) {
      expect(filter.value).toBe(TENANT);
      expect(filter.op).toBe('==');
    }
  });

  it('🔴 το σενάριο αλλαγής ονόματος φιλτράρει επίσης', async () => {
    const calls = setupSpy();

    await computeContactImpact('contact_1', 'nameChange', 'individual', TENANT);

    expect(calls.filter((c) => c.field === FIELDS.COMPANY_ID && c.value === TENANT).length)
      .toBeGreaterThan(0);
  });

  it('🔴 το σενάριο επικοινωνίας φιλτράρει επίσης', async () => {
    const calls = setupSpy();

    await computeContactImpact('contact_1', 'communicationChange', 'company', TENANT);

    expect(calls.filter((c) => c.field === FIELDS.COMPANY_ID && c.value === TENANT).length)
      .toBeGreaterThan(0);
  });

  it('🔴 ο tenant που φτάνει στη μηχανή είναι ΑΥΤΟΣ που δόθηκε — όχι καρφωμένος', async () => {
    const calls = setupSpy();

    await computeContactImpact('contact_1', 'identityChange', 'individual', 'another_tenant');

    const tenantFilters = calls.filter((c) => c.field === FIELDS.COMPANY_ID);
    expect(tenantFilters.length).toBeGreaterThan(0);
    expect(tenantFilters.every((c) => c.value === 'another_tenant')).toBe(true);
    expect(tenantFilters.some((c) => c.value === TENANT)).toBe(false);
  });

  /**
   * 🔴🔴 ΤΟ TEST ΠΟΥ ΣΚΟΤΩΝΕΙ ΤΗ ΜΕΤΑΛΛΑΞΗ — και που **έλειπε** στην πρώτη γραφή.
   *
   * Τα παραπάνω tests δίνουν όλα **υπαρκτό** tenant, οπότε επαναφορά της
   * συνθήκης `&& companyId` τα αφήνει **όλα πράσινα**: μετρήθηκε: 5/5 PASS με
   * τη μετάλλαξη ενεργή. Πράσινο test που δεν πεθαίνει δεν φυλάει τίποτα.
   *
   * Το κενό `companyId` είναι η **μόνη** είσοδος που ξεχωρίζει τις δύο εκδοχές:
   * - `if (!skip)`              → μπαίνει `where(companyId, '==', '')` ⇒ **fail closed**, 0 αποτελέσματα
   * - `if (!skip && companyId)` → **παραλείπεται** ⇒ ερώτηση χωρίς tenant ⇒ **διαρροή**
   *
   * Και δεν είναι θεωρητικό: το κενό `companyId` είναι το χαλασμένο token του
   * ADR-742 §4 — «το κενό δεν είναι tenant, είναι **απουσία** tenant».
   */
  it('🔴🔴 ΚΕΝΟ companyId δεν ακυρώνει το φίλτρο — αποτυγχάνει ΚΛΕΙΣΤΑ (§4)', async () => {
    const calls = setupSpy();

    await computeContactImpact('contact_1', 'identityChange', 'individual', '');

    const tenantFilters = calls.filter((c) => c.field === FIELDS.COMPANY_ID);

    // Με τη ρίψιμη συνθήκη `&& companyId` αυτό θα ήταν **0** — δηλαδή queries
    // χωρίς κανέναν περιορισμό μισθωτή, σε όλους τους πελάτες.
    expect(tenantFilters.length).toBeGreaterThan(0);
    expect(tenantFilters.every((c) => c.value === '')).toBe(true);
  });

  it('η επαφή που ρωτήθηκε φτάνει κι αυτή στην ερώτηση (ο ανιχνευτής δουλεύει)', async () => {
    const calls = setupSpy();

    await computeContactImpact('contact_xyz', 'identityChange', 'individual', TENANT);

    expect(calls.some((c) => c.value === 'contact_xyz')).toBe(true);
  });
});
