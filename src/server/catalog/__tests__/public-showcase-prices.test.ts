/**
 * @jest-environment node
 *
 * **Οι τιμές της δημόσιας βιτρίνας από άκρη σε άκρη** (ADR-923 §5.13 Σ6 · Δ2 · §12 🔒), πάνω στο ψεύτικο Firestore: τιμολόγηση
 * χτισμένη μέσα από τους γραφείς, πραγματικοί κανόνες ορατότητας, πραγματική μηχανή, πραγματική μνήμη με tags.
 *
 * Τι κρατούν οι άγκυρες: κλειστός διακόπτης ⇒ **καμία** ανάγνωση · ο ανώνυμος παίρνει τελική με ΦΠΑ, τίποτα χωρίς ΦΠΑ · ο
 * αγοραστής κρίνεται από τη **σχέση** μέσα στη συναλλαγή · η τιμή ενός κοινού δεν φτάνει σε άλλο · γραφή τιμολόγησης ακυρώνει τη μνήμη.
 */

jest.mock('server-only', () => ({}));

interface CacheEntry {
  readonly value: unknown;
  readonly tags: readonly string[];
}
const mockCache = new Map<string, CacheEntry>();
jest.mock('next/cache', () => ({
  unstable_cache: (load: () => Promise<unknown>, key: readonly string[], options: { readonly tags: readonly string[] }) => async () => {
    const id = key.join('|');
    const hit = mockCache.get(id);
    if (hit) return hit.value;
    const value = await load();
    mockCache.set(id, { value, tags: options.tags });
    return value;
  },
  revalidateTag: (tag: string) => {
    [...mockCache].filter(([, entry]) => entry.tags.includes(tag)).forEach(([id]) => mockCache.delete(id));
  },
}));

const fake = new (jest.requireActual('@/test-utils/fake-firestore/fake-firestore').FakeFirestore)();
let mockDbOpens = 0;
jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: () => {
    mockDbOpens += 1;
    return fake;
  },
  isFirebaseAdminAvailable: () => true,
}));
let mockPricesOn = true;
jest.mock('@/config/feature-flags', () => ({ isAppFeatureEnabled: (flag: string) => flag === 'PUBLIC_SHOWCASE_PRICES' && mockPricesOn }));
jest.mock('@/services/entity-audit-tracked-write', () => ({ recordTrackedEntityWrite: async () => undefined }));
jest.mock('@/lib/workspace/workspace-segment', () => ({ readCanonicalAlias: async () => null }));
jest.mock('@/lib/auth', () => ({ ...jest.requireActual('@/lib/auth'), hasPermission: async () => true }));
/** Μ2: βλάβη στην κρίση τιμής, χωρίς να αγγίζει τίποτε άλλο της σελίδας. */
let mockReaderFails = false;
jest.mock('@/server/catalog/public/public-price-reader.server', () => {
  const actual = jest.requireActual('@/server/catalog/public/public-price-reader.server');
  return { ...actual, readShowcasePrices: (...args: unknown[]) => (mockReaderFails ? Promise.reject(new Error('quota exceeded')) : actual.readShowcasePrices(...args)) };
});

/* eslint-disable import/first -- τα mocks πρέπει να δηλωθούν πριν φορτωθούν οι γραφείς */
import { COLLECTIONS } from '@/config/firestore-collections';
import { vatInclusiveAmount } from '@/lib/pricing/vat-inclusive';
import { supplyRelationshipId } from '@/server/supply-relationships/supply-relationship-store.server';
import { SHOWCASE_CARD_MAX_SKUS, readBuyerShowcasePrices, readPublicModelPrices, readShowcaseCardPrices } from '@/services/public-catalog/public-catalog-prices';
import { readPublicModel } from '@/services/public-catalog/public-catalog.reader';
import { MFP_V1_PRICES, PARTNER } from '@/subapps/catalog/__tests__/fixtures/mfp-price-list.fixture';
import { mfpVariantId } from '@/subapps/catalog/__tests__/fixtures/mfp-fan-coil-products.fixture';
import { PUBLIC_CATALOG_SCHEMA_VERSION, type PublicCatalogModel } from '@/subapps/catalog/public/public-catalog-schema';
import { publicModelCardOf } from '@/subapps/catalog/public/public-model-card';
import { savePriceLines } from '../price-line-writer.server';
import { updateCatalogCategory } from '../category-writer.server';
import { publishPriceListVersion } from '../price-publication.server';
import { createPriceListVersion } from '../price-version-writer.server';
import { createVisibilityRule } from '../visibility-rule-writer.server';
import { ARIES } from './catalog-writer-seed';
import { seedPricing, version1Inputs, type SeededPricing } from './catalog-pricing-seed';
/* eslint-enable import/first */

const SUPPLIER = ARIES.companyId;
const BUYER = { ...ARIES, uid: 'u_buyer', companyId: 'comp-buyer' };
const SKU = mfpVariantId(0);
const LIST = MFP_V1_PRICES[0];
const T0 = '2026-01-01T00:00:00.000Z';

const common = { companyId: SUPPLIER, isDeleted: false, revision: 1 };

/** Δέντρο κατηγοριών: ο συντελεστής δηλώνεται στη ρίζα και κληρονομείται στο φύλλο του SKU. */
function seedCatalog(rootVat: number | null): void {
  fake.seed('catalog_categories', 'cat_root', { ...common, id: 'cat_root', code: 'root', labels: {}, parentId: null, ancestorIds: [], orderKey: 'a', mappings: { atoeCode: null }, vatRate: rootVat });
  fake.seed('catalog_categories', 'cat_leaf', { ...common, id: 'cat_leaf', code: 'leaf', labels: {}, parentId: 'cat_root', ancestorIds: ['cat_root'], orderKey: 'a', mappings: { atoeCode: null } });
  fake.seed('catalog_products', SKU, { ...common, id: SKU, familyId: 'fan', modelId: null, categoryIds: ['cat_leaf'], values: {}, noValueReasons: {}, derived: { identifier: 'SKU-0', label: 'Fan coil 0' } });
}

function publicModel(): PublicCatalogModel {
  return {
    schemaVersion: PUBLIC_CATALOG_SCHEMA_VERSION, companyId: SUPPLIER, modelId: SKU, kind: 'product', code: 'SKU-0', familyId: 'fan',
    familyLabels: { el: 'Fan coil' }, listingKind: 'product', categoryIds: ['cat_leaf'], categoryLabels: { cat_leaf: { el: 'Φύλλο' } },
    locales: ['el'], attributes: [], media: [], variants: [{ variantId: SKU, code: 'SKU-0', label: 'Fan coil 0', attributes: [], media: [] }],
  } as PublicCatalogModel;
}

function seedShowcase(): void {
  fake.seed(COLLECTIONS.SUPPLIER_SHOWCASES, SUPPLIER, { companyId: SUPPLIER, legalName: 'Aries ΑΕ', basis: 'manual-review', publishedAt: T0, updatedAt: T0 });
  fake.seed(COLLECTIONS.PUBLIC_CATALOG_MODELS, SKU, publicModel());
}

function seedRelationship(state: 'active' | 'revoked'): void {
  const id = supplyRelationshipId({ supplierCompanyId: SUPPLIER, buyerCompanyId: BUYER.companyId });
  fake.seed(COLLECTIONS.SUPPLY_RELATIONSHIPS, id, {
    id, companyId: SUPPLIER, buyerCompanyId: BUYER.companyId, state, origin: 'link', supplierContactId: PARTNER.kind === 'contact' ? PARTNER.contactId : null,
    customerRef: null, requestCount: 1, requestedByUid: null, requestedAt: null, acceptedByUid: null, acceptedAt: null, approvedByUid: 'u_aries',
    approvedAt: T0, endedBySide: null, endedByUid: null, endedAt: null, revision: 1, createdAt: T0, updatedAt: T0, updatedBy: 'u_aries',
  });
}

async function publishVersion(seeded: SeededPricing, validFrom: string, factorPercent: number): Promise<void> {
  const draft = await createPriceListVersion(ARIES, seeded.priceListId, { validFrom, basedOn: 'empty' });
  const saved = await savePriceLines(ARIES, draft.id, { expectedLinesRevision: 0, upserts: version1Inputs(seeded.toshCarrId, factorPercent), deletes: [] });
  await publishPriceListVersion(ARIES, draft.id, { expectedRevision: draft.revision, expectedLinesRevision: saved.linesRevision, confirmedDiffDigest: null });
}

let seeded: SeededPricing;

beforeEach(async () => {
  fake.reset();
  mockCache.clear();
  mockPricesOn = true;
  mockReaderFails = false;
  seeded = await seedPricing(fake);
  seedCatalog(24);
  await publishVersion(seeded, T0, 100);
  await createVisibilityRule(ARIES, { subject: { kind: 'catalog' }, audience: { kind: 'anonymous' }, visibility: 'visible' });
  seedShowcase();
});

const buyerPrice = async (ctx = BUYER) => (await readBuyerShowcasePrices(ctx, { supplierCompanyId: SUPPLIER, modelId: SKU }))[SKU];

describe('κλειστός διακόπτης ⇒ η βιτρίνα όπως πριν, χωρίς καμία ανάγνωση', () => {
  it('σελίδα, κάρτες και νησίδα δεν ανοίγουν βάση', async () => {
    mockPricesOn = false;
    mockDbOpens = 0;
    await expect(readPublicModelPrices(publicModel())).resolves.toBeNull();
    await expect(readShowcaseCardPrices(SUPPLIER, [publicModelCardOf(publicModel())])).resolves.toBeNull();
    await expect(readBuyerShowcasePrices(BUYER, { supplierCompanyId: SUPPLIER, modelId: SKU })).resolves.toEqual({});
    expect(mockDbOpens).toBe(0);
    expect(mockCache.size).toBe(0);
  });
});

describe('ο ανώνυμος (ISR): τελική τιμή με ΦΠΑ, από τη μία μηχανή', () => {
  it('η τιμή της λίστας του ανώνυμου, με τον συντελεστή που κληρονομεί το φύλλο από τη ρίζα', async () => {
    const prices = await readPublicModelPrices(publicModel());
    expect(prices?.[SKU]).toEqual({ kind: 'priced', audience: 'anonymous', currency: 'EUR', unitCode: 'pcs', priceQuantity: 1, net: null, gross: Math.round(LIST * 1.24), vatRate: 24, unitNet: null, unitGross: null });
    expect(JSON.stringify(prices)).not.toMatch(/cprl_|ccgrp|cdc_|cplv_/);
  });

  it('χωρίς δηλωμένο συντελεστή ⇒ «Κατόπιν προσφοράς» για τον ανώνυμο · ο αγοραστής βλέπει καθαρή χωρίς τελική', async () => {
    seedCatalog(null);
    await expect(readPublicModelPrices(publicModel())).resolves.toEqual({ [SKU]: { kind: 'onRequest' } });
    expect(await buyerPrice()).toMatchObject({ kind: 'priced', gross: null, vatRate: null });
  });

  it('κρυφό για τον ανώνυμο ⇒ «Κατόπιν προσφοράς», όχι ξεχωριστή απάντηση', async () => {
    await createVisibilityRule(ARIES, { subject: { kind: 'variant', variantId: SKU }, audience: { kind: 'anonymous' }, visibility: 'hidden' });
    await expect(readPublicModelPrices(publicModel())).resolves.toEqual({ [SKU]: { kind: 'onRequest' } });
  });

  it('η κάρτα παίρνει την ίδια τιμή «από», σε μία συναλλαγή για όλη τη σελίδα', async () => {
    await expect(readShowcaseCardPrices(SUPPLIER, [publicModelCardOf(publicModel())])).resolves.toEqual({ [SKU]: expect.objectContaining({ gross: Math.round(LIST * 1.24) }) });
  });

  it('γραφή τιμολόγησης ακυρώνει τη μνήμη: νέα έκδοση σε ισχύ ⇒ νέα τιμή στην επόμενη ανάγνωση', async () => {
    await readPublicModelPrices(publicModel());
    await publishVersion(seeded, '2026-06-01T00:00:00.000Z', 110);
    expect((await readPublicModelPrices(publicModel()))?.[SKU]).toMatchObject({ net: null, gross: vatInclusiveAmount(Math.round(LIST * 1.1), 24) });
  });

  it('Μ1: αλλαγή του συντελεστή της κατηγορίας ⇒ νέα τελική τιμή στην επόμενη ανάγνωση (η μνήμη ακυρώνεται)', async () => {
    expect((await readPublicModelPrices(publicModel()))?.[SKU]).toMatchObject({ gross: Math.round(LIST * 1.24) });
    await updateCatalogCategory(ARIES, 'cat_root', 1, { labels: { el: 'Ρίζα' }, mappings: { atoeCode: null }, vatRate: 13 });
    expect((await readPublicModelPrices(publicModel()))?.[SKU]).toMatchObject({ gross: Math.round(LIST * 1.13), vatRate: 13 });
  });

  it('Χ2: SKU σε δύο κλάδους με διαφορετικό συντελεστή ⇒ «Κατόπιν προσφοράς», όσο βαθιά κι αν δηλώνει ο ένας', async () => {
    fake.seed('catalog_categories', 'cat_books', { ...common, id: 'cat_books', code: 'books', labels: {}, parentId: null, ancestorIds: [], orderKey: 'b', mappings: { atoeCode: null }, vatRate: 6 });
    fake.seed('catalog_products', SKU, { ...fake.getData('catalog_products', SKU), categoryIds: ['cat_leaf', 'cat_books'] });
    await expect(readPublicModelPrices(publicModel())).resolves.toEqual({ [SKU]: { kind: 'onRequest' } });
  });

  it('Μ2: βλάβη στην κρίση ⇒ null (η σελίδα δείχνει «Κατόπιν προσφοράς») και η βλάβη ΔΕΝ μένει στη μνήμη', async () => {
    mockReaderFails = true;
    await expect(readPublicModelPrices(publicModel())).resolves.toBeNull();
    await expect(readShowcaseCardPrices(SUPPLIER, [publicModelCardOf(publicModel())])).resolves.toBeNull();
    mockReaderFails = false;
    expect((await readPublicModelPrices(publicModel()))?.[SKU]).toMatchObject({ kind: 'priced' });
  });

  it('Μ3: η κάρτα κρίνει μόνο τα δημόσια SKU της, έως το όριο · πάνω από αυτό ή χωρίς γνωστά SKU ⇒ καμία ανάγνωση', async () => {
    const card = publicModelCardOf(publicModel());
    mockDbOpens = 0;
    const tooMany = { ...card, variantIds: Array.from({ length: SHOWCASE_CARD_MAX_SKUS + 1 }, (_, index) => `v${index}`) };
    await expect(readShowcaseCardPrices(SUPPLIER, [tooMany, { ...card, variantIds: undefined }])).resolves.toBeNull();
    expect(mockDbOpens).toBe(0);
    await expect(readShowcaseCardPrices(SUPPLIER, [card])).resolves.toEqual({ [SKU]: expect.objectContaining({ kind: 'priced' }) });
  });

  it('ανακλημένη βιτρίνα ⇒ καμία τιμή', async () => {
    fake.seed(COLLECTIONS.SUPPLIER_SHOWCASES, SUPPLIER, { companyId: SUPPLIER });
    await expect(readPublicModelPrices(publicModel())).resolves.toBeNull();
  });
});

describe('ο αγοραστής (no-store): το κοινό το κρίνει η σχέση, μέσα στη συναλλαγή', () => {
  it('χωρίς σχέση ⇒ «συνδεδεμένος» (−5%), ποτέ η τιμή συνεργάτη', async () => {
    expect(await buyerPrice()).toMatchObject({ kind: 'priced', net: Math.round(LIST * 0.95) });
  });

  it('ενεργή σχέση με την επαφή του συνεργάτη ⇒ η τιμή του (−50% −10%) · ανακλημένη ⇒ πίσω στο «συνδεδεμένος»', async () => {
    seedRelationship('active');
    expect(await buyerPrice()).toMatchObject({ net: Math.round(LIST * 0.5 * 0.9) });
    seedRelationship('revoked');
    expect(await buyerPrice()).toMatchObject({ net: Math.round(LIST * 0.95) });
  });

  it('η τιμή του αγοραστή δεν μπαίνει ποτέ στη μνήμη και δεν αλλάζει την ανώνυμη', async () => {
    seedRelationship('active');
    await buyerPrice();
    expect([...mockCache.keys()].some((key) => key.includes('prices'))).toBe(false);
    expect((await readPublicModelPrices(publicModel()))?.[SKU]).toMatchObject({ net: null, gross: vatInclusiveAmount(LIST, 24) });
  });

  it('ο ίδιος ο προμηθευτής, ξένο ή ανύπαρκτο μοντέλο ⇒ η ίδια κενή απάντηση', async () => {
    await expect(readBuyerShowcasePrices(ARIES, { supplierCompanyId: SUPPLIER, modelId: SKU })).resolves.toEqual({});
    await expect(readBuyerShowcasePrices(BUYER, { supplierCompanyId: SUPPLIER, modelId: 'cpmod_none' })).resolves.toEqual({});
    await expect(readBuyerShowcasePrices(BUYER, { supplierCompanyId: 'comp-rival', modelId: SKU })).resolves.toEqual({});
  });

  it('κρίνονται μόνο τα SKU του δημόσιου εγγράφου: η νησίδα δεν ανακαλύπτει κρυφά SKU', async () => {
    const model = await readPublicModel(SUPPLIER, SKU);
    expect(Object.keys(await readBuyerShowcasePrices(BUYER, { supplierCompanyId: SUPPLIER, modelId: SKU }))).toEqual(model?.variants.map((variant) => variant.variantId));
  });
});
