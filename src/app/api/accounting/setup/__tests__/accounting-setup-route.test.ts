/**
 * @jest-environment node
 *
 * @fileoverview **Η ΑΠΟΘΗΚΕΥΣΗ ΤΟΥ ΠΡΟΦΙΛ ΚΑΤΕΧΕΙ ΤΗ ΣΥΝΕΠΕΙΑ ΤΗΣ** — ADR-841 §7 Α23 · ADR-439.
 * @related app/api/accounting/setup/route.ts
 *
 * 🔴 Ως τις 2026-09-14 το `PUT` άλλαζε την επωνυμία **χωρίς** να ενημερώνει `companies.name` ή τις
 * δημόσιες αγγελίες. Εδώ φυλάγεται: (α) ο αριθμός ΓΕΜΗ ελέγχεται ως προς τη μορφή σε **κάθε** νομική
 * μορφή, (β) αλλαγμένη επωνυμία ⇒ διάδοση, ίδια ⇒ **καμία** (N αγγελίες δεν ξαναγράφονται για τίποτα).
 *
 * 🔑 Μέσα από τον **πραγματικό** `defineRoute` (φάκελοι σφαλμάτων, `after`) — ψεύτικα μόνο το
 * repository, ο γραφέας ελέγχου και η διάδοση.
 */

jest.mock('next/server', () => {
  class MockNextResponse {
    static json(body: unknown, init?: { status?: number }) {
      return { status: init?.status ?? 200, json: async () => body };
    }
  }
  // 🔑 Το `after` καταγράφεται και εκτελείται ρητά από τη δοκιμή: το ερώτημα είναι «ζητήθηκε;».
  return {
    NextResponse: MockNextResponse,
    NextRequest: class {},
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

const propagateMock = jest.fn();
const reconcileMock = jest.fn();
jest.mock('@/services/company/company-rename.service', () => ({
  propagateCompanyRename: (...args: unknown[]) => propagateMock(...args),
  reconcileShowcaseLegalIdentity: (...args: unknown[]) => reconcileMock(...args),
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

beforeEach(() => {
  jest.clearAllMocks();
  afterTasks = [];
  // Το προηγούμενο προφίλ = ό,τι γράφει το `VALID` — ώστε «καμία αλλαγή» να είναι πραγματικά καμία.
  repo.getCompanySetup.mockResolvedValue({ ...VALID, gemiNumber: null });
  repo.saveCompanySetup.mockResolvedValue(undefined);
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
    );
  });

  it('🔴 Γ3 — ΚΕΝΟΣ αριθμός στην ατομική/ΟΕ ⇒ `null`, ΠΟΤΕ `""` («δηλωμένος» για κάθε `!== null`)', async () => {
    await put({ ...VALID, gemiNumber: '   ' });

    expect(repo.saveCompanySetup).toHaveBeenCalledWith(expect.objectContaining({ entityType: 'oe', gemiNumber: null }));
  });
});

describe('Μ — η αλλαγή επωνυμίας διαδίδεται, μόνο όταν ΑΛΛΑΞΕ', () => {
  it('🔴 Μ1 — ΑΛΛΑΓΜΕΝΗ επωνυμία ⇒ `propagateCompanyRename` για τον οργανισμό της απόδειξης, ΜΕΤΑ την απάντηση', async () => {
    repo.getCompanySetup.mockResolvedValue({ businessName: 'Δοκιμαστικό Γραφείο' });

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
    repo.getCompanySetup.mockResolvedValue(null);

    await put(VALID);
    await runAfterTasks();

    expect(propagateMock).toHaveBeenCalledTimes(1);
  });

  it('🔴 Μ4 — αποτυχία διάδοσης ΔΕΝ ρίχνει την αποθήκευση: η αλήθεια γράφτηκε', async () => {
    repo.getCompanySetup.mockResolvedValue({ businessName: 'Παλιά' });
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
    repo.getCompanySetup.mockResolvedValue({ ...VALID, businessName: 'Παλιά', gemiNumber: null });

    await put({ ...VALID, gemiNumber: '001234567000' });
    await runAfterTasks();

    expect(propagateMock).toHaveBeenCalledTimes(1);
    expect(reconcileMock).not.toHaveBeenCalled();
  });

  it('🔴 Μ5 — άκυρη αποθήκευση ⇒ ΚΑΜΙΑ διάδοση: τίποτα δεν άλλαξε', async () => {
    repo.getCompanySetup.mockResolvedValue({ businessName: 'Παλιά' });

    await put({ ...VALID, gemiNumber: 'ΑΒΓ' });
    await runAfterTasks();

    expect(propagateMock).not.toHaveBeenCalled();
  });
});
