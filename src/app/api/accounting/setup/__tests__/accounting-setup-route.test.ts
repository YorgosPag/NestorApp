/**
 * @jest-environment node
 *
 * @fileoverview **Η ΑΠΟΘΗΚΕΥΣΗ ΤΟΥ ΠΡΟΦΙΛ ΚΑΤΕΧΕΙ ΤΗ ΣΥΝΕΠΕΙΑ ΤΗΣ** — ADR-841 §7 Α23 · ADR-439.
 * @related app/api/accounting/setup/route.ts
 *
 * 🔴 Ως τις 2026-09-14 το `PUT` άλλαζε την επωνυμία **χωρίς** να ενημερώνει `companies.name` ή τις
 * δημόσιες αγγελίες. Εδώ φυλάγεται: (α) ο αριθμός ΓΕΜΗ ελέγχεται ως προς τη μορφή σε **κάθε** νομική
 * μορφή, (β) αλλαγμένη επωνυμία ⇒ διάδοση, ίδια ⇒ **καμία** (N αγγελίες δεν ξαναγράφονται για τίποτα),
 * (γ) Γ3 — η μάσκα πεδίων φτάνει στη συναλλαγή, άγνωστο πεδίο ⇒ 400, και οι συνέπειες κρίνονται από το
 * «πριν/μετά» **της συναλλαγής**, ποτέ από τη φόρμα ή από δεύτερη ανάγνωση.
 *
 * 🔑 Μέσα από τον **πραγματικό** `defineRoute` (φάκελοι σφαλμάτων, `after`) — ψεύτικα μόνο το
 * repository, ο γραφέας ελέγχου και η διάδοση.
 */

jest.mock('next/server', () => {
  const base = jest
    .requireActual<typeof import('@/test-utils/next-response-json-mock')>('@/test-utils/next-response-json-mock')
    .nextServerJsonMock();
  // 🔑 Το `after` καταγράφεται και εκτελείται ρητά από τη δοκιμή: το ερώτημα είναι «ζητήθηκε;».
  return {
    ...base,
    after: (task: () => unknown) => {
      afterTasks.push(task);
    },
  };
});

var afterTasks: Array<() => unknown> = [];

jest.mock('@/lib/middleware/with-rate-limit', () => ({
  withAssetRateLimit: <T>(h: T) => h,
  withHighRateLimit: <T>(h: T) => h,
  withStandardRateLimit: <T>(h: T) => h,
  withSensitiveRateLimit: <T>(h: T) => h,
  withHeavyRateLimit: <T>(h: T) => h,
  withWebhookRateLimit: <T>(h: T) => h,
  withTelegramRateLimit: <T>(h: T) => h,
}));

jest.mock('@/lib/auth', () => ({
  withAuth:
    (callback: (...args: unknown[]) => Promise<unknown>) =>
    async (request: unknown, segmentData?: unknown) =>
      callback(request, { uid: 'user_1', companyId: 'comp_alfa', globalRole: 'company_admin' }, {}, segmentData),
}));

jest.mock('@/lib/telemetry/Logger', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }),
}));
jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }),
}));

jest.mock('@/lib/firebaseAdmin', () => ({ getAdminFirestore: () => ({}) }));

var repo = { getCompanySetup: jest.fn(), saveCompanySetup: jest.fn() };
jest.mock('@/subapps/accounting/services/create-accounting-services', () => ({
  createAccountingServices: () => ({ repository: repo }),
}));
jest.mock('@/subapps/accounting/services/audited-repository-wrapper', () => ({
  createAuditedRepository: () => ({ saveCompanySetup: (...args: unknown[]) => repo.saveCompanySetup(...args) }),
}));

// ADR-ACC-010 §2.1.1 Φ9: η ρύθμιση εξασφαλίζει την τρέχουσα χρήση — ψεύτικος ο γραφέας, πραγματικό το παράθυρο.
const ensureFiscalYearMock = jest.fn();
jest.mock('@/subapps/accounting/services/fiscal-period-service', () => ({
  ensureFiscalYear: (...args: unknown[]) => ensureFiscalYearMock(...args),
}));
jest.mock('@/subapps/accounting/utils/accounting-day', () => ({
  ...jest.requireActual<typeof import('@/subapps/accounting/utils/accounting-day')>('@/subapps/accounting/utils/accounting-day'),
  accountingToday: () => '2026-11-07',
}));

const propagateMock = jest.fn();
const reconcileMock = jest.fn();
jest.mock('@/services/company/company-rename.service', () => ({
  propagateCompanyRename: (...args: unknown[]) => propagateMock(...args),
  reconcileShowcaseLegalIdentity: (...args: unknown[]) => reconcileMock(...args),
}));

const companionMock = jest.fn();
const companionFactoryMock = jest.fn((..._args: unknown[]) => companionMock);
jest.mock('@/services/company-registry/company-registry-retention.service', () => ({
  registryRetentionCompanion: (...args: unknown[]) => companionFactoryMock(...args),
}));

import { PUT } from '../route';

const VALID = {
  entityType: 'oe',
  businessName: 'ΠΑΓΩΝΗΣ Ο.Ε.',
  vatNumber: '123456789',
  taxOffice: 'Δ.Ο.Υ. Θεσσαλονίκης',
  address: 'Σαμοθράκης 16',
  city: 'Θεσσαλονίκη',
  postalCode: '54248',
  profession: 'Κατασκευές',
  mainKad: { code: '41.20', description: 'Κατασκευή κτιρίων' },
  partners: [],
};

async function put(body: unknown): Promise<{ status: number; body: Record<string, unknown> }> {
  const handler = PUT as unknown as (r: unknown) => Promise<{ status: number; json: () => Promise<Record<string, unknown>> }>;
  const response = await handler({ json: async () => body, method: 'PUT', url: 'http://localhost/api/accounting/setup' });
  return { status: response.status, body: await response.json() };
}

async function runAfterTasks(): Promise<void> {
  for (const task of afterTasks.splice(0)) await task();
}

/**
 * Η συναλλαγή: «πριν» = ό,τι δίνει η δοκιμή · «μετά» = ό,τι έγραψε (προεπιλογή: η φόρμα όπως ήρθε).
 * Ίδιο «πριν» και «μετά» ⇒ **το ίδιο αντικείμενο**, όπως όταν η συναλλαγή δεν έγραψε τίποτα.
 */
function givenTransaction(before: Record<string, unknown> | null, after?: Record<string, unknown>): void {
  repo.saveCompanySetup.mockImplementation(async (data: Record<string, unknown>) => ({ before, after: after ?? data }));
}

beforeEach(() => {
  jest.clearAllMocks();
  afterTasks = [];
  // Το «πριν» = ό,τι γράφει το `VALID` — ώστε «καμία αλλαγή» να είναι πραγματικά καμία.
  givenTransaction({ ...VALID, gemiNumber: null });
  propagateMock.mockResolvedValue({ name: 'x', wasRepaired: true, republished: null });
  reconcileMock.mockResolvedValue({ kind: 'refreshed', publicNameChanged: false });
});

describe('Γ — ο αριθμός ΓΕΜΗ στο προφίλ', () => {
  it.each(['ΑΒΓ-1', '12a45', '1234567890123'])('🔴 Γ1 — άκυρος αριθμός «%s» ⇒ 400, και ΤΙΠΟΤΑ δεν γράφεται', async (gemiNumber) => {
    const answer = await put({ ...VALID, gemiNumber });

    expect(answer.status).toBe(400);
    expect(answer.body.success).toBe(false);
    expect(repo.saveCompanySetup).not.toHaveBeenCalled();
  });

  it('🔑 Γ2 — ΑΤΟΜΙΚΗ ΜΕ ΓΕΜΗ: ο αριθμός γράφεται (ADR-ACC-012 έλεγε «αδύνατο» — νομικά λάθος)', async () => {
    await put({ ...VALID, entityType: 'sole_proprietor', gemiNumber: ' 001234567000 ' });

    expect(repo.saveCompanySetup).toHaveBeenCalledWith(
      expect.objectContaining({ entityType: 'sole_proprietor', gemiNumber: '001234567000' }),
      expect.anything(),
    );
  });

  it('🔴 Γ3 — ΚΕΝΟΣ αριθμός στην ατομική/ΟΕ ⇒ `null`, ΠΟΤΕ `""` («δηλωμένος» για κάθε `!== null`)', async () => {
    await put({ ...VALID, gemiNumber: '   ' });

    expect(repo.saveCompanySetup).toHaveBeenCalledWith(
      expect.objectContaining({ entityType: 'oe', gemiNumber: null }),
      expect.anything(),
    );
  });
});

describe('Ε — έναρξη εργασιών: η ρίζα της μειωμένης προκαταβολής (ADR-ACC-023 §1 · ADR-ACC-024 §6.1 α)', () => {
  it.each([
    ['ανύπαρκτη ημέρα', { date: '2025-02-30', origin: 'new' }],
    ['άγνωστη προέλευση', { date: '2025-02-01', origin: 'merger' }],
  ])('🔴 Ε1 — %s ⇒ 400, και ΤΙΠΟΤΑ δεν γράφεται', async (_label, businessStart) => {
    const answer = await put({ ...VALID, businessStart });

    expect(answer.status).toBe(400);
    expect(repo.saveCompanySetup).not.toHaveBeenCalled();
  });

  it('🔑 Ε2 — έγκυρη έναρξη ⇒ γράφεται όπως δηλώθηκε', async () => {
    await put({ ...VALID, businessStart: { date: '2024-03-01', origin: 'continuation' } });

    expect(repo.saveCompanySetup).toHaveBeenCalledWith(
      expect.objectContaining({ businessStart: { date: '2024-03-01', origin: 'continuation' } }),
      expect.anything(),
    );
  });

  it('🔑 Ε3 — απούσα έναρξη ⇒ `null` (⇒ πλήρης προκαταβολή), ποτέ `undefined`', async () => {
    await put({ ...VALID });

    expect(repo.saveCompanySetup).toHaveBeenCalledWith(
      expect.objectContaining({ businessStart: null }),
      expect.anything(),
    );
  });
});

describe('Π — καθεστώς ΦΠΑ: ΠΟΙΑ απαλλαγή (ADR-ACC-003 §22.4)', () => {
  it.each([
    ['άγνωστο καθεστώς', { vatRegime: 'common' }],
    ['κωδικός εκτός §8.3', { vatRegime: 'exempt', vatExemptionCategory: 32 }],
    ['αιτία σε κανονικό καθεστώς (αντίφαση)', { vatRegime: 'normal', vatExemptionCategory: 15 }],
  ])('🔴 Π1 — %s ⇒ 400, και ΤΙΠΟΤΑ δεν γράφεται', async (_label, vat) => {
    const answer = await put({ ...VALID, ...vat });

    expect(answer.status).toBe(400);
    expect(repo.saveCompanySetup).not.toHaveBeenCalled();
  });

  it('🔑 Π2 — απαλλασσόμενη με κωδ. 15 ⇒ γράφεται όπως δηλώθηκε', async () => {
    await put({ ...VALID, vatRegime: 'exempt', vatExemptionCategory: 15 });

    expect(repo.saveCompanySetup).toHaveBeenCalledWith(
      expect.objectContaining({ vatRegime: 'exempt', vatExemptionCategory: 15 }),
      expect.anything(),
    );
  });

  it('🔑 Π3 — απουσία ⇒ κανονικό + `null`, ποτέ `undefined` (Firestore)', async () => {
    await put({ ...VALID });

    expect(repo.saveCompanySetup).toHaveBeenCalledWith(
      expect.objectContaining({ vatRegime: 'normal', vatExemptionCategory: null }),
      expect.anything(),
    );
  });
});

describe('Φ — μάσκα πεδίων (ADR-841 Α23 Γ3 · AIP-134 / AIP-161)', () => {
  it('🔴 Φ1 — άγνωστο πεδίο στη μάσκα ⇒ 400 με τα απορριφθέντα, και ΤΙΠΟΤΑ δεν γράφεται', async () => {
    const answer = await put({ ...VALID, fields: ['phone', 'companyId'] });

    expect(answer.status).toBe(400);
    expect(repo.saveCompanySetup).not.toHaveBeenCalled();
  });

  it('🔴 Φ2 — η μάσκα ΦΤΑΝΕΙ στη συναλλαγή · χωρίς μάσκα ⇒ `undefined` (πλήρης αντικατάσταση)', async () => {
    await put({ ...VALID, fields: ['phone', 'city'] });
    await put(VALID);

    expect(repo.saveCompanySetup.mock.calls[0][1]).toEqual({ fields: ['phone', 'city'], companion: companionMock });
    expect(repo.saveCompanySetup.mock.calls[1][1]).toEqual({ fields: undefined, companion: companionMock });
  });

  it('🔴 Φ4 — Α23.12: ο σύντροφος διατήρησης ΓΕΜΗ ταξιδεύει στη ΣΥΝΑΛΛΑΓΗ, για οργανισμό και άνθρωπο της απόδειξης', async () => {
    // Χωρίς αυτόν, αλλαγή αριθμού ΓΕΜΗ αφήνει το αντίγραφο του παλιού αριθμού να ζει για πάντα (5(1)(ε)).
    await put({ ...VALID, gemiNumber: '001234567000', fields: ['gemiNumber'] });

    expect(companionFactoryMock).toHaveBeenCalledWith(expect.anything(), 'comp_alfa', 'user_1');
    expect(repo.saveCompanySetup.mock.calls[0][1].companion).toBe(companionMock);
  });

  it('🔑 Φ3 — η μάσκα ΔΕΝ μπαίνει στο έγγραφο (το σώμα χτίζεται ρητά)', async () => {
    await put({ ...VALID, fields: ['phone'] });

    expect(repo.saveCompanySetup.mock.calls[0][0]).not.toHaveProperty('fields');
  });
});

describe('Μ — η αλλαγή επωνυμίας διαδίδεται, μόνο όταν η ΣΥΝΑΛΛΑΓΗ την έγραψε', () => {
  it('🔴 Μ1 — ΑΛΛΑΓΜΕΝΗ επωνυμία ⇒ `propagateCompanyRename` για τον οργανισμό της απόδειξης, ΜΕΤΑ την απάντηση', async () => {
    givenTransaction({ ...VALID, businessName: 'Δοκιμαστικό Γραφείο' });

    const answer = await put(VALID);

    expect(answer.status).toBe(200);
    // ⚠️ `after`, όχι `await`: ο άνθρωπος δεν περιμένει N αγγελίες για να δει «Αποθηκεύτηκε».
    expect(propagateMock).not.toHaveBeenCalled();
    await runAfterTasks();
    expect(propagateMock).toHaveBeenCalledWith(expect.anything(), 'comp_alfa', 'user_1');
  });

  it('🔑 Μ2 — ΙΔΙΑ επωνυμία ⇒ ΚΑΜΙΑ διάδοση', async () => {
    await put(VALID);
    await runAfterTasks();

    expect(afterTasks).toHaveLength(0);
    expect(propagateMock).not.toHaveBeenCalled();
  });

  it('🔑 Μ3 — ΠΡΩΤΗ αποθήκευση (κανένα προφίλ πριν) ⇒ διάδοση', async () => {
    givenTransaction(null);

    await put(VALID);
    await runAfterTasks();

    expect(propagateMock).toHaveBeenCalledTimes(1);
  });

  it('🔴 Μ4 — αποτυχία διάδοσης ΔΕΝ ρίχνει την αποθήκευση: η αλήθεια γράφτηκε', async () => {
    givenTransaction({ ...VALID, businessName: 'Παλιά' });
    propagateMock.mockRejectedValue(new Error('firestore down'));

    const answer = await put(VALID);

    expect(answer.status).toBe(200);
    await expect(runAfterTasks()).resolves.toBeUndefined();
  });

  it.each([
    ['αριθμός ΓΕΜΗ', { gemiNumber: '001234567000' }],
    ['διεύθυνση έδρας', { address: 'Τσιμισκή 12' }],
    ['νομική μορφή', { entityType: 'sole_proprietor' }],
  ])('🔴 Μ6 — άλλαξε %s ΧΩΡΙΣ μετονομασία ⇒ ανανέωση ΜΟΝΟ της νομικής ταυτότητας της βιτρίνας', async (_label, change) => {
    // Α23: το στιγμιότυπο της βιτρίνας θα έλεγε παλιό αριθμό/έδρα ως «επαληθευμένα» — η αποθήκευση το κατέχει.
    await put({ ...VALID, ...change });
    await runAfterTasks();

    expect(reconcileMock).toHaveBeenCalledWith(expect.anything(), 'comp_alfa');
    expect(propagateMock).not.toHaveBeenCalled();
  });

  it('🔑 Μ7 — μετονομασία ⇒ ΜΟΝΟ η διάδοση (που περιέχει ήδη τη βιτρίνα), όχι και δεύτερη ανανέωση', async () => {
    givenTransaction({ ...VALID, businessName: 'Παλιά', gemiNumber: null });

    await put({ ...VALID, gemiNumber: '001234567000' });
    await runAfterTasks();

    expect(propagateMock).toHaveBeenCalledTimes(1);
    expect(reconcileMock).not.toHaveBeenCalled();
  });

  it('🔴 Μ5 — άκυρη αποθήκευση ⇒ ΚΑΜΙΑ διάδοση: τίποτα δεν άλλαξε', async () => {
    givenTransaction({ ...VALID, businessName: 'Παλιά' });

    await put({ ...VALID, gemiNumber: 'ΑΒΓ' });
    await runAfterTasks();

    expect(propagateMock).not.toHaveBeenCalled();
  });

  it('🔴 Μ8 — ΜΠΑΓΙΑΤΙΚΗ ΦΟΡΜΑ: λέει «Παλιά», η συναλλαγή κράτησε «ΓΕΜΗ» ⇒ ΚΑΜΙΑ διάδοση (κρίνει η συναλλαγή, όχι η φόρμα)', async () => {
    const disk = { ...VALID, businessName: 'ΓΕΜΗ', gemiNumber: null };
    givenTransaction(disk, { ...disk, phone: '2310999999' });

    await put({ ...VALID, businessName: 'Παλιά', phone: '2310999999', fields: ['phone'] });
    await runAfterTasks();

    expect(propagateMock).not.toHaveBeenCalled();
    expect(reconcileMock).not.toHaveBeenCalled();
  });

  it('🔴 Μ9 — ΚΑΜΙΑ δεύτερη ανάγνωση του προφίλ: οι συνέπειες έρχονται από το «πριν/μετά» της συναλλαγής', async () => {
    await put(VALID);

    expect(repo.getCompanySetup).not.toHaveBeenCalled();
  });
});

describe('Χ — η ρύθμιση εξασφαλίζει την τρέχουσα χρήση (ADR-ACC-010 §2.1.1 Φ9)', () => {
  it('🔑 Χ1 — αποθήκευση ⇒ ιδεμπότητη εξασφάλιση της χρήσης 2026, origin setup', async () => {
    ensureFiscalYearMock.mockResolvedValue('created');
    const answer = await put(VALID);

    expect(answer.status).toBe(200);
    expect(ensureFiscalYearMock).toHaveBeenCalledWith(repo, 2026, 'setup');
  });

  it('🔑 Χ2 — έναρξη εργασιών ΜΕΤΑ το επόμενο έτος ⇒ καμία χρήση ανοίγει', async () => {
    givenTransaction(null, { ...VALID, businessStart: { date: '2030-01-01', origin: 'new' } });
    await put(VALID);

    expect(ensureFiscalYearMock).not.toHaveBeenCalled();
  });

  it('🔴 Χ3 — αποτυχία εξασφάλισης ΔΕΝ ρίχνει την αποθηκευμένη ρύθμιση (καλύπτει το δίχτυ του συνόρου)', async () => {
    ensureFiscalYearMock.mockRejectedValue(new Error('firestore down'));
    const answer = await put(VALID);

    expect(answer.status).toBe(200);
    expect(repo.saveCompanySetup).toHaveBeenCalled();
  });
});
