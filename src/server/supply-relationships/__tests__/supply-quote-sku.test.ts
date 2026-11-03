/**
 * @jest-environment node
 *
 * **Ποιο SKU ζητά προσφορά** (ADR-923 §5.13 Ε6α): αληθινός αναγνώστης βιτρίνας πάνω στο ψεύτικο Firestore. Μόνο η κρίση
 * σχέσης είναι ψεύτικη, γιατί έχει δική της σουίτα (`supply-foreign-quote.test.ts`) από άκρη σε άκρη.
 */

jest.mock('server-only', () => ({}));
jest.mock('next/cache', () => ({
  unstable_cache: (load: () => Promise<unknown>) => load,
  revalidateTag: () => undefined,
}));

const fake = new (jest.requireActual('@/test-utils/fake-firestore/fake-firestore').FakeFirestore)();
jest.mock('@/lib/firebaseAdmin', () => ({ getAdminFirestore: () => fake, isFirebaseAdminAvailable: () => true }));

const mockForeignSku = jest.fn(async (_ctx: unknown, _link: unknown): Promise<unknown> => null);
jest.mock('../supply-foreign-quote.server', () => ({ resolveVisibleForeignSku: (ctx: unknown, link: unknown) => mockForeignSku(ctx, link) }));

/* eslint-disable import/first -- τα mocks πρέπει να δηλωθούν πριν φορτωθούν οι μονάδες */
import { ARIES, RIVAL } from '@/server/catalog/__tests__/catalog-writer-seed';
import { PUBLIC_CATALOG_SCHEMA_VERSION } from '@/subapps/catalog/public/public-catalog-schema';

import { supplyRelationshipId } from '../supply-relationship-store.server';
import { resolvePublicSku, resolveQuoteSku, type QuoteSkuAddress } from '../supply-quote-sku.server';
/* eslint-enable import/first */

const SUPPLIER = ARIES.companyId;
const BUYER = RIVAL;
const MODEL = 'cpmod_1';
const VARIANT = 'cvar_1';
const T0 = '2026-11-03T10:00:00.000Z';

const ADDRESS: QuoteSkuAddress = { supplierCompanyId: SUPPLIER, modelId: MODEL, variantId: VARIANT };
const SKU = { supplierCompanyId: SUPPLIER, variantId: VARIANT };
/** Το κείμενο της δημόσιας παραλλαγής (`code` · `label`), όπως το γράφει το `foreignSkuRowText`. */
const PUBLIC_TEXT = 'A — Προϊόν';

const modelDoc = (companyId = SUPPLIER, variantIds: readonly string[] = [VARIANT]) => ({
  schemaVersion: PUBLIC_CATALOG_SCHEMA_VERSION,
  companyId,
  modelId: MODEL,
  kind: 'product',
  code: 'M-1',
  familyId: 'fam',
  familyLabels: { el: 'Οικογένεια' },
  listingKind: 'product',
  categoryIds: [],
  categoryLabels: {},
  locales: ['el'],
  attributes: [],
  media: [],
  variants: variantIds.map((variantId) => ({ variantId, code: 'A', label: 'Προϊόν', attributes: [], media: [] })),
});

const showcase = () => ({ companyId: SUPPLIER, legalName: 'ARIES ΑΕ', basis: 'manual-review', publishedAt: T0, updatedAt: T0 });

function publish(model = modelDoc()): void {
  fake.seed('public_supplier_showcases', SUPPLIER, showcase());
  fake.seed('public_catalog_models', MODEL, model);
}

beforeEach(() => {
  fake.reset();
  mockForeignSku.mockReset();
  mockForeignSku.mockResolvedValue(null);
});

describe('resolvePublicSku: η βιτρίνα όπως τη βλέπει ο ανώνυμος', () => {
  it('δημοσιευμένη παραλλαγή ⇒ το SKU, με προμηθευτή τη διεύθυνση', async () => {
    publish();
    await expect(resolvePublicSku(ADDRESS)).resolves.toEqual({ ref: SKU, text: PUBLIC_TEXT });
  });

  it('🔴 κάθε «όχι» είναι το ίδιο `null`: κρυφή παραλλαγή · ανύπαρκτο μοντέλο · ξένο μοντέλο', async () => {
    publish(modelDoc(SUPPLIER, ['cvar_other']));
    await expect(resolvePublicSku(ADDRESS)).resolves.toBeNull();
    await expect(resolvePublicSku({ ...ADDRESS, modelId: 'cpmod_ghost' })).resolves.toBeNull();
    publish(modelDoc('comp-other'));
    await expect(resolvePublicSku(ADDRESS)).resolves.toBeNull();
  });

  it('🔒 χωρίς βιτρίνα το μοντέλο δεν μετρά, ακόμη κι αν το έγγραφό του υπάρχει', async () => {
    fake.seed('public_catalog_models', MODEL, modelDoc());
    await expect(resolvePublicSku(ADDRESS)).resolves.toBeNull();
  });
});

describe('resolveQuoteSku: σχέση πρώτα, βιτρίνα μετά', () => {
  it('ενεργή σχέση που δείχνει το SKU ⇒ `relationship`, ακόμη κι όταν το δείχνει και η βιτρίνα', async () => {
    publish();
    mockForeignSku.mockResolvedValue({ ref: SKU, text: 'B-7 — Ιδιωτικό' });
    await expect(resolveQuoteSku(BUYER, ADDRESS)).resolves.toEqual({ ref: SKU, text: 'B-7 — Ιδιωτικό', path: 'relationship' });
    const relationshipId = supplyRelationshipId({ supplierCompanyId: SUPPLIER, buyerCompanyId: BUYER.companyId });
    expect(mockForeignSku).toHaveBeenCalledWith(BUYER, { relationshipId, variantId: VARIANT });
  });

  it('χωρίς σχέση, ή με σχέση που κρύβει το SKU ⇒ πέφτει στο δημόσιο δάπεδο', async () => {
    publish();
    await expect(resolveQuoteSku(BUYER, ADDRESS)).resolves.toEqual({ ref: SKU, text: PUBLIC_TEXT, path: 'public' });
  });

  it('ούτε σχέση ούτε βιτρίνα ⇒ `null`', async () => {
    await expect(resolveQuoteSku(BUYER, ADDRESS)).resolves.toBeNull();
  });

  it('🔴 ο προμηθευτής δεν ζητά προσφορά από τον εαυτό του, ούτε από τη δική του βιτρίνα', async () => {
    publish();
    await expect(resolveQuoteSku(ARIES, ADDRESS)).resolves.toBeNull();
    expect(mockForeignSku).not.toHaveBeenCalled();
  });
});
