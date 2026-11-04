/**
 * @jest-environment node
 *
 * **Η δημιουργία RFQ σε ΜΙΑ συναλλαγή** (ADR-923 §5.13 Ε6γ, Τ4): αληθινό σχέδιο, αληθινή συναλλαγή, αληθινός resolver επαφής
 * και αληθινός αναγνώστης opt-in πάνω στο ψεύτικο Firestore. Ψεύτικα μόνο: η κρίση SKU και η βιτρίνα (έχουν δικές τους
 * σουίτες), η έκδοση διαπιστευτηρίου (τυχαιότητα, μυστικό) και η αποστολή.
 *
 * Κάθε άρνηση ρωτά δύο πράγματα: τον **κωδικό** και ότι **δεν γράφτηκε τίποτα**.
 */

jest.mock('server-only', () => ({}));
jest.mock('next/server', () => ({ after: jest.fn() }));

const fake = new (jest.requireActual('@/test-utils/fake-firestore/fake-firestore').FakeFirestore)();
jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: () => fake,
  isFirebaseAdminAvailable: () => true,
  safeFirestoreOperation: async (op: (db: unknown) => Promise<unknown>) => op(fake),
  FieldValue: jest.requireActual('firebase-admin/firestore').FieldValue,
}));

const mockResolveSku = jest.fn();
jest.mock('@/server/supply-relationships/supply-quote-sku.server', () => ({ resolveQuoteSku: (...a: unknown[]) => mockResolveSku(...a) }));
const mockShowcase = jest.fn();
jest.mock('@/services/public-catalog/public-catalog.reader', () => ({ readPublicSupplier: (...a: unknown[]) => mockShowcase(...a) }));
jest.mock('@/server/lib/performer-stamp', () => ({
  ...jest.requireActual('@/server/lib/performer-stamp'),
  resolvePerformer: async () => ({ id: 'u_buyer', name: 'Αγοραστής' }),
}));
const mockMint = jest.fn(async (input: { inviteId: string; rfqId: string; companyId: string }) => ({
  credential: { id: `vic_${input.inviteId}`, inviteId: input.inviteId, rfqId: input.rfqId, companyId: input.companyId, nonceHash: 'h', expiresAt: '2026-12-31T00:00:00.000Z' },
  token: `tok_${input.inviteId}`,
}));
jest.mock('@/services/vendor-portal/vendor-invite-credential', () => ({
  vendorLinkExpiryMs: (nowMs: number) => nowMs + 7 * 86_400_000,
  mintVendorInviteCredential: (input: { inviteId: string; rfqId: string; companyId: string }) => mockMint(input),
}));
jest.mock('../vendor-portal-links', () => ({ vendorPortalUrl: (t: string) => `https://app.test/q#${t}`, vendorDeclineUrl: (t: string) => `https://app.test/d#${t}` }));
const mockSend = jest.fn(async () => ({ success: true }));
jest.mock('../channels/email-channel', () => ({ emailVendorInviteChannel: { send: (...a: unknown[]) => mockSend(...(a as [])) } }));
const mockAudit = jest.fn(async () => 'audit');
const mockQuota = jest.fn(async () => true);
jest.mock('@/lib/middleware/subject-quota', () => ({ withinSubjectQuota: (...a: unknown[]) => mockQuota(...(a as [])) }));
jest.mock('@/services/entity-audit.service', () => ({ EntityAuditService: { recordChange: (...a: unknown[]) => mockAudit(...(a as [])) } }));

/* eslint-disable import/first -- τα mocks πρέπει να δηλωθούν πριν φορτωθούν οι μονάδες */
import { COLLECTIONS } from '@/config/firestore-collections';
import type { AuthContext } from '@/lib/auth';
import { generateDeterministicCatalogSupplierProfileId, generateDeterministicSupplyRequestLinkId } from '@/services/enterprise-id.service';
import { generateDeterministicPlatformCompanyContactId } from '@/services/enterprise-id-convenience-catalog';
import type { CreateRfqDTO } from '../../types/rfq';
import { SAFE_BATCH_WRITES } from '@/config/firestore-collections';
import { countRfqWrites } from '../rfq-create-plan';
import { createRfq, createRfqWithOutcome } from '../rfq-service';
/* eslint-enable import/first */

const BUYER = 'comp_buyer';
const SUPPLIER = 'comp_aries';
const ctx = { uid: 'u_buyer', companyId: BUYER, email: 'buyer@b.gr', globalRole: 'company_admin' } as unknown as AuthContext;
const CONTACT_ID = generateDeterministicPlatformCompanyContactId(BUYER, SUPPLIER);
const PROFILE_ID = generateDeterministicCatalogSupplierProfileId(SUPPLIER);
const CATALOG_LINE = { supplierCompanyId: SUPPLIER, modelId: 'cpmod_1', variantId: 'cprod_1', quantity: 12, unit: 'pcs' };
const SKU = { ref: { supplierCompanyId: SUPPLIER, variantId: 'cprod_1' }, text: 'TC-1 — Καλώδιο', path: 'public' };

const docs = (collection: string) => Object.values(fake.getAllDocs(collection)) as Record<string, unknown>[];
const lineDocs = (rfqId: string) => [...fake.pathBucket(`${COLLECTIONS.RFQS}/${rfqId}/${COLLECTIONS.RFQ_LINES_SUB}`).values()] as Record<string, unknown>[];
const refusal = (dto: CreateRfqDTO) => createRfq(ctx, dto).then(() => 'created', (e: { errorCode?: string }) => e.errorCode ?? String(e));
const catalogDto = (over: Partial<CreateRfqDTO> = {}): CreateRfqDTO => ({ projectId: 'proj_1', title: 'RFQ', catalogLines: [CATALOG_LINE], ...over });

function seedIntake(enabled = true): void {
  fake.seed('catalog_supplier_profiles', PROFILE_ID, {
    id: PROFILE_ID, companyId: SUPPLIER, isDeleted: false, revision: 1, description: {}, projects: [],
    quoteIntake: { enabled, recipientEmail: 'quotes@aries.gr' },
  });
}

function expectNothingWritten(): void {
  expect(docs(COLLECTIONS.RFQS)).toEqual([]);
  expect(docs(COLLECTIONS.VENDOR_INVITES)).toEqual([]);
  expect(docs(COLLECTIONS.CONTACTS)).toEqual([]);
}

beforeEach(() => {
  fake.reset();
  jest.clearAllMocks();
  mockResolveSku.mockResolvedValue(SKU);
  mockQuota.mockResolvedValue(true);
  mockShowcase.mockResolvedValue({ companyId: SUPPLIER, legalName: 'ARIES ΑΕ', alias: null });
  seedIntake();
});

describe('createRfq — γραμμές καταλόγου (ADR-923 §5.13 Τ4)', () => {
  it('RFQ, γραμμή, επαφή και πρόσκληση γεννιούνται μαζί· το κείμενο είναι του SKU, ποτέ του πελάτη', async () => {
    const rfq = await createRfq(ctx, catalogDto());
    expect(rfq).toMatchObject({ linesStorage: 'catalog', invitedVendorIds: [CONTACT_ID], invitedVendorCount: 1, responseLock: { quantity: true, unit: true } });
    expect(lineDocs(rfq.id)).toEqual([expect.objectContaining({
      source: 'catalog', companyId: BUYER, description: 'TC-1 — Καλώδιο', quantity: 12, unit: 'pcs', displayOrder: 0,
      catalogRef: SKU.ref, priceSnapshot: null, unitPrice: null, boqItemId: null,
    })]);
    expect(fake.getData(COLLECTIONS.CONTACTS, CONTACT_ID)).toMatchObject({ companyId: BUYER, platformCompanyId: SUPPLIER, companyName: 'ARIES ΑΕ' });
    expect(docs(COLLECTIONS.VENDOR_INVITES)).toEqual([expect.objectContaining({ vendorContactId: CONTACT_ID, rfqId: rfq.id, companyId: BUYER })]);
    expect(docs(COLLECTIONS.VENDOR_INVITE_CREDENTIALS)).toHaveLength(1);
  });

  it('Τ5: η πρόθεση παράδοσης γράφεται ΜΑΖΙ με το RFQ (outbox `pending`, καμία απόπειρα ακόμη)', async () => {
    await createRfq(ctx, catalogDto());
    expect(docs(COLLECTIONS.VENDOR_INVITES)).toEqual([expect.objectContaining({
      recipientEmail: null, delivery: expect.objectContaining({ state: 'pending', attempts: 0, recipientKind: null }),
    })]);
  });

  it('Τ5: όριο ανά ζεύγος (αγοραστής, προμηθευτής) ⇒ `quoteRequestQuotaExhausted`, τίποτα δεν γράφεται, κανένα διαπιστευτήριο', async () => {
    mockQuota.mockResolvedValueOnce(false);
    expect(await refusal(catalogDto())).toBe('quoteRequestQuotaExhausted');
    expect(mockQuota).toHaveBeenCalledWith('rfq-quote-request:pair', `${BUYER}:${SUPPLIER}`, expect.objectContaining({ limit: 10 }));
    expect(mockMint).not.toHaveBeenCalled();
    expectNothingWritten();
  });

  it('Τ5: RFQ χωρίς γραμμή καταλόγου δεν καταναλώνει την ποσόστωση ζεύγους', async () => {
    await createRfq(ctx, { projectId: 'p', title: 'T', invitedVendorIds: ['v1'] });
    expect(mockQuota).not.toHaveBeenCalled();
  });

  it('το ίχνος της νέας επαφής γράφεται μετά το commit· υπάρχουσα επαφή δεν «γεννιέται» ξανά', async () => {
    await createRfq(ctx, catalogDto());
    const births = () => mockAudit.mock.calls.filter(([entry]) => (entry as { entityId: string }).entityId === CONTACT_ID);
    expect(births()).toHaveLength(1);
    mockAudit.mockClear();
    await createRfq(ctx, catalogDto());
    expect(births()).toHaveLength(0);
    expect(docs(COLLECTIONS.CONTACTS)).toHaveLength(1);
  });

  it('προσκεκλημένος που είναι ήδη η επαφή του προμηθευτή δεν παίρνει δεύτερη πρόσκληση', async () => {
    const rfq = await createRfq(ctx, catalogDto({ invitedVendorIds: ['cont_manual', CONTACT_ID] }));
    expect(rfq.invitedVendorIds).toEqual(['cont_manual', CONTACT_ID]);
    expect(docs(COLLECTIONS.VENDOR_INVITES)).toHaveLength(2);
  });

  it('μικτή φόρμα: επιμέτρηση, ad-hoc, κατάλογος, με αυτή τη σειρά, σε ΜΙΑ συναλλαγή· ξένο BOQ δεν γίνεται γραμμή', async () => {
    fake.seed(COLLECTIONS.BOQ_ITEMS, 'boq_1', { companyId: BUYER, title: 'Σκυρόδεμα', categoryCode: null, estimatedQuantity: 3, unit: 'm3' });
    fake.seed(COLLECTIONS.BOQ_ITEMS, 'boq_x', { companyId: 'comp_other', title: 'Ξένο', estimatedQuantity: 1, unit: 'm3' });
    const adHocLines = [{ source: 'ad_hoc' as const, description: 'Χειροκίνητη', trade: 'concrete' as const }];
    const rfq = await createRfq(ctx, catalogDto({ boqItemIds: ['boq_1', 'boq_x'], adHocLines }));
    const lines = lineDocs(rfq.id).sort((a, b) => Number(a.displayOrder) - Number(b.displayOrder));
    expect(lines.map((l) => [l.source, l.displayOrder])).toEqual([['boq', 0], ['ad_hoc', 1], ['catalog', 2]]);
    expect(lines[0]).toMatchObject({ boqItemId: 'boq_1', trade: 'materials_general' });
    expect(rfq.linesStorage).toBe('boq');
  });

  it('χωρίς κατάλογο η ροή δεν ρωτά ούτε SKU ούτε βιτρίνα, και γράφει RFQ και γραμμές στην ίδια συναλλαγή', async () => {
    const adHocLines = [{ source: 'ad_hoc' as const, description: 'x', trade: 'concrete' as const }];
    const rfq = await createRfq(ctx, { projectId: 'p', title: 'T', adHocLines, invitedVendorIds: ['v1'] });
    expect(mockResolveSku).not.toHaveBeenCalled();
    expect(mockShowcase).not.toHaveBeenCalled();
    expect(lineDocs(rfq.id)).toHaveLength(1);
    expect(rfq.responseLock).toEqual({ quantity: false, unit: false });
  });
});

describe('createRfq — αρνήσεις: κωδικός ΚΑΙ καμία εγγραφή', () => {
  it('SKU που δεν κρίθηκε ⇒ `catalogSkuUnavailable`, πριν από κάθε διαπιστευτήριο', async () => {
    mockResolveSku.mockResolvedValue(null);
    expect(await refusal(catalogDto())).toBe('catalogSkuUnavailable');
    expect(mockMint).not.toHaveBeenCalled();
    expectNothingWritten();
  });

  it('προμηθευτής χωρίς βιτρίνα ⇒ `supplierNotAcceptingQuotes`', async () => {
    mockShowcase.mockResolvedValue(null);
    expect(await refusal(catalogDto())).toBe('supplierNotAcceptingQuotes');
    expectNothingWritten();
  });

  it('opt-in κλειστό ή απόν ⇒ `supplierNotAcceptingQuotes`', async () => {
    seedIntake(false);
    expect(await refusal(catalogDto())).toBe('supplierNotAcceptingQuotes');
    fake.reset();
    expect(await refusal(catalogDto())).toBe('supplierNotAcceptingQuotes');
    expectNothingWritten();
  });

  it('🔴 το κλείσιμο του opt-in κερδίζει τον αγώνα: κλείνει ανάμεσα στην ανάγνωση και στο commit', async () => {
    fake.interfere = () => seedIntake(false);
    expect(await refusal(catalogDto())).toBe('supplierNotAcceptingQuotes');
    expectNothingWritten();
  });

  it('αρχειοθετημένη ή ξένη καρτέλα στο id του ζεύγους ⇒ `supplierContactUnavailable`', async () => {
    fake.seed(COLLECTIONS.CONTACTS, CONTACT_ID, { type: 'company', companyId: BUYER, platformCompanyId: SUPPLIER, status: 'archived' });
    expect(await refusal(catalogDto())).toBe('supplierContactUnavailable');
    fake.seed(COLLECTIONS.CONTACTS, CONTACT_ID, { type: 'company', companyId: 'comp_other', platformCompanyId: SUPPLIER });
    expect(await refusal(catalogDto())).toBe('supplierContactUnavailable');
    expect(docs(COLLECTIONS.RFQS)).toEqual([]);
    expect(docs(COLLECTIONS.VENDOR_INVITES)).toEqual([]);
  });
});

describe('createRfq — όλες οι αναγνώσεις πριν από κάθε εγγραφή', () => {
  it('η σειρά των πράξεων της συναλλαγής: get… και μετά μόνο set/update', async () => {
    fake.seed(COLLECTIONS.BOQ_ITEMS, 'boq_1', { companyId: BUYER, title: 'Σκυρόδεμα', estimatedQuantity: 3, unit: 'm3' });
    fake.seed(COLLECTIONS.SOURCING_EVENTS, 'sev_1', { companyId: BUYER, rfqIds: [], rfqCount: 0 });
    const order: string[] = [];
    const run = fake.runTransaction.bind(fake);
    jest.spyOn(fake, 'runTransaction').mockImplementation(((body: (tx: unknown) => Promise<unknown>) => run((tx: Record<string, (...a: unknown[]) => unknown>) => {
      const recording = new Proxy(tx, { get: (target, key: string) => {
        const value = target[key];
        if (typeof value !== 'function') return value;
        return (...args: unknown[]) => { order.push(key); return value.apply(target, args); };
      } });
      return body(recording);
    })) as typeof fake.runTransaction);
    await createRfq(ctx, catalogDto({ boqItemIds: ['boq_1'], sourcingEventId: 'sev_1' }));
    const firstWrite = order.findIndex((op) => op !== 'get' && op !== 'getAll');
    expect(order.slice(0, firstWrite).filter((op) => op === 'get').length).toBeGreaterThanOrEqual(3);
    expect(order.slice(firstWrite).some((op) => op === 'get' || op === 'getAll')).toBe(false);
    expect(fake.getData(COLLECTIONS.SOURCING_EVENTS, 'sev_1')).toMatchObject({ rfqCount: 1 });
  });
});

/** Οι ισχυρισμοί της παλιάς ροής batch (Q28–Q31 · §8.5 Β · ADR-330 S3.2), πάνω στη ΜΙΑ συναλλαγή. */
describe('createRfq — οι ροές χωρίς κατάλογο κρατούν τη συμπεριφορά τους', () => {
  it('κενό αίτημα: μετρητές 0, `linesStorage` null, χωρίς πακέτο · inline γραμμές ⇒ `inline_legacy`', async () => {
    const empty = await createRfq(ctx, { projectId: 'p', title: 'T' });
    expect(empty).toMatchObject({ invitedVendorCount: 0, respondedCount: 0, linesStorage: null, sourcingEventId: null });
    const inline = await createRfq(ctx, { projectId: 'p', title: 'T', lines: [{ id: 'l1', description: 'x', trade: 'concrete', categoryCode: null, quantity: null, unit: null, notes: null }] });
    expect(inline.linesStorage).toBe('inline_legacy');
  });

  it('🔴 ADR-876 §5: ανά προσκεκλημένο μία πρόσκληση χωρίς token και ένα διαπιστευτήριο δεμένο με αυτήν', async () => {
    await createRfq(ctx, { projectId: 'p', title: 'T', invitedVendorIds: ['v1', 'v2'] });
    const invites = docs(COLLECTIONS.VENDOR_INVITES);
    expect(invites.map((i) => i.vendorContactId)).toEqual(expect.arrayContaining(['v1', 'v2']));
    expect(docs(COLLECTIONS.VENDOR_INVITE_CREDENTIALS).map((c) => c.inviteId).sort()).toEqual(invites.map((i) => i.id).sort());
    expect(JSON.stringify([...invites, ...docs(COLLECTIONS.RFQS)])).not.toContain('tok_');
  });

  it('ADR-330 §5.1 S3.2: η προθεσμία της φόρμας αποθηκεύεται · χωρίς προθεσμία ⇒ null', async () => {
    expect((await createRfq(ctx, { projectId: 'p', title: 'T', deadlineDate: '2026-11-15' })).deadlineDate).not.toBeNull();
    expect((await createRfq(ctx, { projectId: 'p', title: 'T', deadlineDate: null })).deadlineDate).toBeNull();
  });

  it('§8.5 Β: επιμέτρηση ⇒ κλειδωμένο · ρητή τιμή του DTO κερδίζει', async () => {
    expect((await createRfq(ctx, { projectId: 'p', title: 'B', boqItemIds: ['boq1'] })).responseLock).toEqual({ quantity: true, unit: true });
    const explicit = await createRfq(ctx, { projectId: 'p', title: 'X', boqItemIds: ['b'], responseLock: { quantity: false, unit: true } });
    expect(explicit.responseLock).toEqual({ quantity: false, unit: true });
  });

  it('αποτυχία της συναλλαγής ⇒ η δημιουργία αποτυγχάνει και δεν φεύγει καμία πρόσκληση', async () => {
    jest.spyOn(fake, 'runTransaction').mockRejectedValueOnce(new Error('Firestore unavailable'));
    await expect(createRfq(ctx, { projectId: 'p', title: 'T', invitedVendorIds: ['v1'] })).rejects.toThrow('Firestore unavailable');
    expect(mockSend).not.toHaveBeenCalled();
    expectNothingWritten();
  });
});

describe('createRfq — ένα commit: `rfqTooLarge` πριν από κάθε διαπιστευτήριο', () => {
  const NONE = { boqItems: 0, adHocLines: 0, catalogLines: 0, invites: 0, suppliers: 0, sourcingEvent: false };

  it('η μέτρηση: RFQ + γραμμές + 2 ανά πρόσκληση + επαφές + πακέτο', () => {
    expect(countRfqWrites(NONE)).toBe(1);
    expect(countRfqWrites({ boqItems: 3, adHocLines: 2, catalogLines: 1, invites: 4, suppliers: 1, sourcingEvent: true })).toBe(1 + 6 + 8 + 1 + 1);
  });

  it('στο όριο γεννιέται · ένα πάνω από το όριο ⇒ `rfqTooLarge`, χωρίς καμία εγγραφή ή κρυπτογραφία', async () => {
    const vendors = (n: number) => Array.from({ length: n }, (_, i) => `v${i}`);
    const fits = Math.floor((SAFE_BATCH_WRITES - 1) / 2);
    expect(await refusal({ projectId: 'p', title: 'T', invitedVendorIds: vendors(fits + 1) })).toBe('rfqTooLarge');
    expect(mockMint).not.toHaveBeenCalled();
    expectNothingWritten();
    expect(await refusal({ projectId: 'p', title: 'T', invitedVendorIds: vendors(fits) })).toBe('created');
  });
});

describe('createRfqWithOutcome — ό,τι ΣΤΑΛΘΗΚΕ αποφασίζει το επόμενο βήμα (ADR-923 §5.13 Ε6δ, Τ6)', () => {
  const LINK_ID = generateDeterministicSupplyRequestLinkId(SUPPLIER);
  const seedLink = (state: 'live' | 'revoked') => fake.seed(COLLECTIONS.SUPPLY_REQUEST_LINKS, LINK_ID, {
    id: LINK_ID, companyId: SUPPLIER, generation: 1, state, revision: 1, createdAt: 'x', updatedAt: 'x', updatedBy: 'u',
  });
  const previousSecret = process.env.SUPPLY_REQUEST_LINK_SECRET;
  beforeAll(() => { process.env.SUPPLY_REQUEST_LINK_SECRET = 'test-secret-for-supply-request-links-0123456789'; });
  afterAll(() => { process.env.SUPPLY_REQUEST_LINK_SECRET = previousSecret; });

  it('SKU της βιτρίνας + ζωντανός σύνδεσμος ⇒ ο προσκεκλημένος προμηθευτής με πρόταση πρόσβασης', async () => {
    seedLink('live');
    const { catalogSuppliers } = await createRfqWithOutcome(ctx, catalogDto());
    expect(catalogSuppliers).toEqual([
      { supplierCompanyId: SUPPLIER, supplierName: 'ARIES ΑΕ', priceListAccessHref: expect.stringMatching(/^\/supply-request\/.+/) },
    ]);
  });

  it('ανακλημένος σύνδεσμος ή SKU μέσω σχέσης ⇒ προσκλήθηκε, χωρίς πρόταση', async () => {
    seedLink('revoked');
    expect((await createRfqWithOutcome(ctx, catalogDto())).catalogSuppliers).toEqual([expect.objectContaining({ priceListAccessHref: null })]);
    seedLink('live');
    mockResolveSku.mockResolvedValue({ ...SKU, path: 'relationship' });
    expect((await createRfqWithOutcome(ctx, catalogDto())).catalogSuppliers).toEqual([expect.objectContaining({ priceListAccessHref: null })]);
  });

  it('χωρίς γραμμή καταλόγου ⇒ κανένας προμηθευτής καταλόγου, όσο κι αν το πρόχειρο είχε κάποτε SKU', async () => {
    seedLink('live');
    const adHocLines = [{ source: 'ad_hoc' as const, description: 'x', trade: 'concrete' as const }];
    expect((await createRfqWithOutcome(ctx, { projectId: 'p', title: 'T', adHocLines })).catalogSuppliers).toEqual([]);
  });
});

