/**
 * @jest-environment node
 *
 * ADR-923 §5.13 Τ6 — η προσυμπλήρωση `?catalog=`: οι ίδιες κρίσεις με τη δημιουργία, το ίδιο «όχι», και πρόταση πρόσβασης
 * στους τιμοκαταλόγους ΜΟΝΟ όταν το SKU κρίθηκε από τη βιτρίνα (Ε6δ). Ψεύτικοι μόνο οι αναγνώστες (έχουν δικές τους σουίτες).
 */

jest.mock('server-only', () => ({}));
jest.mock('@/lib/firebaseAdmin', () => ({ getAdminFirestore: () => ({ fake: true }) }));
const mockResolveSku = jest.fn();
jest.mock('@/server/supply-relationships/supply-quote-sku.server', () => ({ resolveQuoteSku: (...a: unknown[]) => mockResolveSku(...a) }));
const mockShowcase = jest.fn();
const mockProfile = jest.fn();
jest.mock('@/services/public-catalog/public-catalog.reader', () => ({
  readPublicSupplier: (...a: unknown[]) => mockShowcase(...a),
  readPublicSupplierProfile: (...a: unknown[]) => mockProfile(...a),
}));
const mockAccessHref = jest.fn();
jest.mock('@/server/supply-relationships/supply-request-link.server', () => ({ liveSupplyRequestHref: (...a: unknown[]) => mockAccessHref(...a) }));
jest.mock('../vendor-invite-issue', () => ({ prepareVendorInvite: jest.fn() }));

/* eslint-disable import/first -- τα mocks πρέπει να δηλωθούν πριν φορτωθούν οι μονάδες */
import type { AuthContext } from '@/lib/auth';
import { catalogSuppliersSent, draftRfqFromCatalog } from '../rfq-catalog-draft';
/* eslint-enable import/first */

const ctx = { uid: 'u_buyer', companyId: 'comp_buyer' } as unknown as AuthContext;
const ADDRESS = { supplierCompanyId: 'comp_aries', modelId: 'cpmod_1', variantId: 'cprod_1' };
const sku = (path: 'public' | 'relationship') => ({ ref: { supplierCompanyId: 'comp_aries', variantId: 'cprod_1' }, text: 'TC-1 — Καλώδιο', path });
const codeOf = (promise: Promise<unknown>) => promise.then(() => 'drafted', (e: { errorCode?: string }) => e.errorCode ?? String(e));

beforeEach(() => {
  jest.clearAllMocks();
  mockResolveSku.mockResolvedValue(sku('public'));
  mockShowcase.mockResolvedValue({ companyId: 'comp_aries', legalName: 'ARIES ΑΕ' });
  mockProfile.mockResolvedValue({ acceptsQuoteRequests: true });
  mockAccessHref.mockResolvedValue('/supply-request/tok');
});

describe('draftRfqFromCatalog', () => {
  it('🔒 βιτρίνα ⇒ κείμενο και επωνυμία, ΚΑΝΕΝΑΣ σύνδεσμος: το token δεν διανέμεται πριν από πράξη (Ε6δ)', async () => {
    await expect(draftRfqFromCatalog(ctx, ADDRESS)).resolves.toEqual({ address: ADDRESS, description: 'TC-1 — Καλώδιο', supplierName: 'ARIES ΑΕ' });
    expect(mockAccessHref).not.toHaveBeenCalled();
  });

  it('ανύπαρκτο / κρυφό / δικό μου SKU ⇒ catalogSkuUnavailable, πριν από κάθε ανάγνωση βιτρίνας', async () => {
    mockResolveSku.mockResolvedValue(null);
    await expect(codeOf(draftRfqFromCatalog(ctx, ADDRESS))).resolves.toBe('catalogSkuUnavailable');
    expect(mockShowcase).not.toHaveBeenCalled();
  });

  it('χωρίς βιτρίνα ⇒ supplierNotAcceptingQuotes', async () => {
    mockShowcase.mockResolvedValue(null);
    await expect(codeOf(draftRfqFromCatalog(ctx, ADDRESS))).resolves.toBe('supplierNotAcceptingQuotes');
  });

  it.each([[null], [{ acceptsQuoteRequests: false }]])('χωρίς opt-in στο δημόσιο προφίλ (%p) ⇒ supplierNotAcceptingQuotes', async (profile) => {
    mockProfile.mockResolvedValue(profile);
    await expect(codeOf(draftRfqFromCatalog(ctx, ADDRESS))).resolves.toBe('supplierNotAcceptingQuotes');
    expect(mockAccessHref).not.toHaveBeenCalled();
  });

  it('η κρίση SKU παίρνει τον αγοραστή και τη διεύθυνση όπως ήρθε', async () => {
    await draftRfqFromCatalog(ctx, ADDRESS);
    expect(mockResolveSku).toHaveBeenCalledWith(ctx, ADDRESS);
  });
});

describe('catalogSuppliersSent (μετά το commit)', () => {
  const supplier = (id: string) => ({ supplierCompanyId: id, legalName: `${id} ΑΕ`, contactId: `cont_${id}` });
  const line = (supplierCompanyId: string, path: 'public' | 'relationship') => ({
    line: { ...ADDRESS, supplierCompanyId, quantity: 1, unit: 'pcs' },
    sku: { ref: { supplierCompanyId, variantId: 'v' }, text: 't', path },
  });

  it('SKU από τη βιτρίνα ⇒ πρόταση πρόσβασης· μέσω σχέσης ⇒ null, χωρίς ανάγνωση συνδέσμου', async () => {
    const sent = await catalogSuppliersSent({
      suppliers: [supplier('comp_pub'), supplier('comp_rel')],
      catalogLines: [line('comp_pub', 'public'), line('comp_rel', 'relationship')],
    });
    expect(sent).toEqual([
      { supplierCompanyId: 'comp_pub', supplierName: 'comp_pub ΑΕ', priceListAccessHref: '/supply-request/tok' },
      { supplierCompanyId: 'comp_rel', supplierName: 'comp_rel ΑΕ', priceListAccessHref: null },
    ]);
    expect(mockAccessHref).toHaveBeenCalledTimes(1);
    expect(mockAccessHref).toHaveBeenCalledWith({ fake: true }, 'comp_pub');
  });

  it('χωρίς προμηθευτή καταλόγου ⇒ κενό (κανένα «προσκλήθηκε»)', async () => {
    await expect(catalogSuppliersSent({ suppliers: [], catalogLines: [] })).resolves.toEqual([]);
  });
});
