/**
 * Η εξαγωγή ETIM xChange από άκρη σε άκρη (ADR-923 §5.14 · κενό α), πάνω στο ψεύτικο Firestore: τιμολόγηση και ορατότητα χτισμένες
 * **μέσα από τους γραφείς**, και το έγγραφο κρίνεται από το **επίσημο** σχήμα με Ajv (Ζ2).
 */

import Ajv2020 from 'ajv/dist/2020';
import type { Firestore } from 'firebase-admin/firestore';

import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';
import { MFP_PRICE_LIST, MFP_V1_PRICES, SIMPLE_VARIANT_ID } from '@/subapps/catalog/__tests__/fixtures/mfp-price-list.fixture';
import { MFP_SIZES } from '@/subapps/catalog/__tests__/fixtures/mfp-fan-coil.fixture';
import { mfpVariantId } from '@/subapps/catalog/__tests__/fixtures/mfp-fan-coil-products.fixture';
import schema20 from '@/subapps/catalog/interop/etim/__tests__/fixtures/xchange-2.0.schema.json';
import { ANY_SLOT } from '@/subapps/catalog/types/product';
import type { XChangeExportAudience } from '@/subapps/catalog/types/xchange-export';
import { ARIES, RIVAL, rejectionOf } from './catalog-writer-seed';
import { seedPricing, version1Inputs, type SeededPricing } from './catalog-pricing-seed';

const fake = new FakeFirestore();
const taxDeclaration = jest.fn();

jest.mock('@/lib/firebaseAdmin', () => ({ getAdminFirestore: (): Firestore => fake as unknown as Firestore }));
jest.mock('@/services/entity-audit-tracked-write', () => ({ recordTrackedEntityWrite: async () => undefined }));
jest.mock('@/services/company/company-legal-identity', () => ({ readCompanyTaxDeclaration: (companyId: string) => taxDeclaration(companyId) }));

/* eslint-disable import/first -- τα mocks πρέπει να δηλωθούν πριν φορτωθούν οι γραφείς */
import { createCatalogPriceList } from '../price-list-writer.server';
import { savePriceLines } from '../price-line-writer.server';
import { publishPriceListVersion } from '../price-publication.server';
import { createPriceListVersion } from '../price-version-writer.server';
import { createVisibilityRule } from '../visibility-rule-writer.server';
import { exportXChangeCatalog, previewXChangeExport } from '../xchange-export.server';
/* eslint-enable import/first */

const validator = new Ajv2020({ strict: false, validateFormats: false, allErrors: true }).compile(schema20);
const PUBLIC: XChangeExportAudience = { kind: 'public' };
const present = (businessName: string | null, taxId: string | null) => ({ kind: 'present', declaration: { businessName }, taxId });

/** Τα SKU του fixture γίνονται πλήρη: οικογένεια με κλάση ETIM, μία ιδιότητα ισχύος, κωδικός και κλειδί ταξινόμησης. */
function seedCatalog(): void {
  const { companyId } = ARIES;
  const common = { companyId, isDeleted: false, revision: 1 };
  fake.seed('catalog_families', 'fan', { ...common, id: 'fan', code: 'fan', labels: {}, etimClass: 'EC011533', variantSchemes: [], attributes: [{ attributeId: 'power', requiredChannels: [] }] });
  fake.seed('catalog_attributes', 'power', {
    ...common, id: 'power', code: 'power', type: 'measurement', groupId: 'g', labels: {}, description: {}, localizable: false, scopable: false, unique: false, orderKey: 'a',
    mappings: { etimFeature: 'EF000001', etimUnitCode: 'kW', bsddUri: null, ifc: null, atoeCode: null, platformTerm: { status: 'unbound' } },
    config: { measurementFamilyCode: 'power', defaultUnitCode: 'W', allowedUnitCodes: null, min: null, max: null, decimals: 2 },
  });
  const ids = [...MFP_SIZES.map((_, index) => mfpVariantId(index)), SIMPLE_VARIANT_ID];
  ids.forEach((id, index) => fake.seed('catalog_products', id, {
    ...common, id, familyId: 'fan', modelId: null, categoryIds: [], noValueReasons: {},
    values: { power: { [ANY_SLOT]: { [ANY_SLOT]: { type: 'measurement', amount: '1800', unitCode: 'W' } } } },
    derived: { identifier: `SKU-${index}`, label: `Fan coil ${index}`, completeChannels: [], sortKey: String(index).padStart(2, '0') },
  }));
}

async function publishVersion1(seeded: SeededPricing): Promise<void> {
  const draft = await createPriceListVersion(ARIES, seeded.priceListId, { validFrom: '2026-01-01T00:00:00.000Z', basedOn: 'empty' });
  const saved = await savePriceLines(ARIES, draft.id, { expectedLinesRevision: 0, upserts: version1Inputs(seeded.toshCarrId), deletes: [] });
  await publishPriceListVersion(ARIES, draft.id, { expectedRevision: draft.revision, expectedLinesRevision: saved.linesRevision, confirmedDiffDigest: null });
}

/** Όλος ο κατάλογος ορατός στον ανώνυμο · το 2ο μέγεθος κρυφό · το απλό SKU ορατό χωρίς τιμή. */
async function seedVisibility(): Promise<void> {
  const anonymous = { kind: 'anonymous' } as const;
  await createVisibilityRule(ARIES, { subject: { kind: 'catalog' }, audience: anonymous, visibility: 'visible' });
  await createVisibilityRule(ARIES, { subject: { kind: 'variant', variantId: mfpVariantId(1) }, audience: anonymous, visibility: 'hidden' });
  await createVisibilityRule(ARIES, { subject: { kind: 'variant', variantId: SIMPLE_VARIANT_ID }, audience: anonymous, visibility: 'visibleNoPrice' });
  // Μόνο για τον χονδρέμπορο: ο ειδικότερος κανόνας νικά, άρα ο ανώνυμος συνεχίζει να το βλέπει.
  await createVisibilityRule(ARIES, { subject: { kind: 'variant', variantId: mfpVariantId(3) }, audience: { kind: 'customerGroup', customerGroupId: seeded.wholesaleId }, visibility: 'hidden' });
}

let seeded: SeededPricing;

beforeEach(async () => {
  fake.reset();
  taxDeclaration.mockReset().mockResolvedValue(present('Aries ΑΕ', '094014201'));
  seeded = await seedPricing(fake);
  seedCatalog();
  await publishVersion1(seeded);
  await seedVisibility();
});

const productsOf = (document: unknown) => (document as { Supplier: { Product: { TradeItem: { Pricing: Record<string, unknown>[] }[] }[] }[] }).Supplier[0].Product;

describe('η δημόσια τιμή καταλόγου (απόφαση Ε1, προεπιλογή)', () => {
  it('περνά το επίσημο σχήμα, με την επωνυμία και τον ΑΦΜ από το SSoT της νομικής ταυτότητας', async () => {
    const { document } = await exportXChangeCatalog(ARIES, { audience: PUBLIC, language: 'el' });
    expect(validator(document) ? [] : validator.errors).toEqual([]);
    expect(document).toMatchObject({ CurrencyCode: 'EUR', Language: ['el-GR'], Supplier: [{ SupplierName: 'Aries ΑΕ', SupplierVatNo: 'EL094014201' }] });
  });

  it('κρυφό SKU δεν εξάγεται και μετριέται · ορατό χωρίς τιμή ⇒ PriceOnRequest · η αναφορά γράφει λίστα, έκδοση, ημερομηνία', async () => {
    const { document, summary } = await exportXChangeCatalog(ARIES, { audience: PUBLIC, language: 'el' });
    expect(summary).toMatchObject({ exported: 7, hidden: 1, unfitIdentifier: 0, onRequest: { visibleNoPrice: 1 } });
    expect(summary.priceSource).toMatchObject({ priceListId: seeded.priceListId, code: MFP_PRICE_LIST.definition.code, version: { number: 1, validFrom: '2026-01-01T00:00:00.000Z' } });
    const pricing = productsOf(document).map((product) => product.TradeItem[0].Pricing[0]);
    expect(pricing[0]).toEqual({ PriceUnit: 'C62', PriceQuantity: '1', GrossListPrice: (MFP_V1_PRICES[0] / 100).toFixed(2), PriceValidityDate: '2026-01-01' });
    expect(pricing.filter((price) => price.PriceOnRequest === true)).toHaveLength(1);
    expect(JSON.stringify(document)).not.toContain('SKU-1"');
  });

  it('κρυφό μοντέλο κρύβει τα SKU του: τα μοντέλα του κοινού αναγνώστη φτάνουν στην κρίση ορατότητας', async () => {
    const { companyId } = ARIES;
    fake.seed('catalog_product_models', 'mdl', { companyId, isDeleted: false, revision: 1, id: 'mdl', familyId: 'fan', parentId: null, categoryIds: [], values: {}, noValueReasons: {}, variantSchemeCode: null });
    const variantId = mfpVariantId(0);
    fake.seed('catalog_products', variantId, { ...fake.getData('catalog_products', variantId), modelId: 'mdl' });
    await createVisibilityRule(ARIES, { subject: { kind: 'productModel', modelId: 'mdl' }, audience: { kind: 'anonymous' }, visibility: 'hidden' });
    const { document, summary } = await exportXChangeCatalog(ARIES, { audience: PUBLIC, language: 'el' });
    expect(summary).toMatchObject({ exported: 6, hidden: 2 });
    expect(JSON.stringify(document)).not.toContain('SKU-0"');
  });

  it('χωρίς έγκυρο ΑΦΜ το πεδίο λείπει · χωρίς επωνυμία η εξαγωγή αρνείται με κωδικό', async () => {
    taxDeclaration.mockResolvedValue(present('Aries ΑΕ', '123'));
    expect((await exportXChangeCatalog(ARIES, { audience: PUBLIC, language: 'el' })).document).not.toHaveProperty('Supplier.0.SupplierVatNo');
    taxDeclaration.mockResolvedValue({ kind: 'absent' });
    const refused = await rejectionOf(exportXChangeCatalog(ARIES, { audience: PUBLIC, language: 'el' }));
    expect(refused.issues).toEqual([{ code: 'xchangeSupplierNameMissing', path: 'supplier' }]);
  });
});

describe('μία λίστα πελάτη (απόφαση Ε1, εναλλακτικά)', () => {
  it('το κοινό είναι της λίστας: η ορατότητα του χονδρέμπορου, και χωρίς έκδοση σε ισχύ ⇒ PriceOnRequest με αιτία', async () => {
    const own = await createCatalogPriceList(ARIES, { ...MFP_PRICE_LIST.definition, code: 'wholesale_list', audience: { kind: 'customerGroup', customerGroupId: seeded.wholesaleId } });
    const { document, summary } = await exportXChangeCatalog(ARIES, { audience: { kind: 'priceList', priceListId: own.id }, language: 'en' });
    expect(validator(document) ? [] : validator.errors).toEqual([]);
    expect(summary).toMatchObject({ exported: 6, hidden: 2, onRequest: { visibleNoPrice: 1, noVersion: 5 }, priceSource: { priceListId: own.id, version: null } });
  });

  it('λίστα κόστους ⇒ άρνηση · ξένη λίστα ≡ ανύπαρκτη', async () => {
    const cost = await createCatalogPriceList(ARIES, { ...MFP_PRICE_LIST.definition, code: 'master', kind: 'cost', priceType: 'net_customer', audience: null });
    const refused = await rejectionOf(exportXChangeCatalog(ARIES, { audience: { kind: 'priceList', priceListId: cost.id }, language: 'el' }));
    expect(refused.issues).toEqual([{ code: 'xchangePriceListNotOffered', path: 'priceListId' }]);
    // Ο γραφέας δεν δίνει ποτέ κοινό σε λίστα κόστους· αν ποτέ βρεθεί τέτοια εγγραφή, το εσωτερικό κόστος πάλι δεν βγαίνει.
    fake.seed('catalog_price_lists', 'cprl_leak', { ...MFP_PRICE_LIST.definition, id: 'cprl_leak', companyId: ARIES.companyId, isDeleted: false, revision: 1, kind: 'cost', priceType: 'net_customer' });
    const leak = await rejectionOf(exportXChangeCatalog(ARIES, { audience: { kind: 'priceList', priceListId: 'cprl_leak' }, language: 'el' }));
    expect(leak.issues).toEqual([{ code: 'xchangePriceListNotOffered', path: 'priceListId' }]);
    const foreign = await rejectionOf(exportXChangeCatalog(RIVAL, { audience: { kind: 'priceList', priceListId: seeded.priceListId }, language: 'el' }));
    expect(foreign.kind).toBe('notFound');
  });
});

describe('ο προέλεγχος και η κενή εξαγωγή (§5.14.1 · απόφαση Ε3)', () => {
  /** Ο κατάλογος και οι τιμές χωρίς κανέναν κανόνα ορατότητας: Δ3 ⇒ όλα κρυφά. */
  async function seedWithoutVisibility(): Promise<void> {
    fake.reset();
    seeded = await seedPricing(fake);
    seedCatalog();
    await publishVersion1(seeded);
  }

  it('ο προέλεγχος μετρά ό,τι γράφει η εξαγωγή — ίδια κρίση, ίδιοι αριθμοί', async () => {
    const preview = await previewXChangeExport(ARIES, PUBLIC);
    const { summary } = await exportXChangeCatalog(ARIES, { audience: PUBLIC, language: 'el' });
    // Η στιγμή (`at`) είναι η μόνη διαφορά δύο κρίσεων με απόσταση χιλιοστών· όλα τα άλλα πρέπει να ταυτίζονται.
    const { audience, priceSource, exported, hidden, unfitIdentifier, onRequest } = summary;
    expect(preview).toEqual({ audience, priceSource, at: expect.any(String), exported, hidden, unfitIdentifier, onRequest, emptyCause: null, blockers: [] });
  });

  it('κανένας κανόνας ⇒ ο προέλεγχος λέει την αιτία, και η εξαγωγή ΑΡΝΕΙΤΑΙ αντί για άκυρο αρχείο με Product: []', async () => {
    await seedWithoutVisibility();
    await expect(previewXChangeExport(ARIES, PUBLIC)).resolves.toMatchObject({ exported: 0, hidden: 8, emptyCause: 'noVisibilityRules' });
    const refused = await rejectionOf(exportXChangeCatalog(ARIES, { audience: PUBLIC, language: 'el' }));
    expect(refused.issues).toEqual([{ code: 'xchangeNothingToExport', path: 'audience', params: { cause: 'noVisibilityRules', max: 35 } }]);
  });

  it('κανόνες υπάρχουν, όλα κρυφά για το κοινό ⇒ hiddenForAudience', async () => {
    await seedWithoutVisibility();
    await createVisibilityRule(ARIES, { subject: { kind: 'catalog' }, audience: { kind: 'anonymous' }, visibility: 'hidden' });
    await expect(previewXChangeExport(ARIES, PUBLIC)).resolves.toMatchObject({ exported: 0, emptyCause: 'hiddenForAudience' });
  });

  it('χωρίς επωνυμία ο προέλεγχος ΔΕΝ πετά: το εμπόδιο φαίνεται πριν το κλικ, μαζί με τη μέτρηση', async () => {
    taxDeclaration.mockResolvedValue({ kind: 'absent' });
    await expect(previewXChangeExport(ARIES, PUBLIC)).resolves.toMatchObject({
      exported: 7, emptyCause: null, blockers: [{ code: 'xchangeSupplierNameMissing', path: 'supplier' }],
    });
  });

  it('λίστα που δεν προσφέρεται ⇒ ο προέλεγχος αρνείται όπως η εξαγωγή', async () => {
    const cost = await createCatalogPriceList(ARIES, { ...MFP_PRICE_LIST.definition, code: 'master', kind: 'cost', priceType: 'net_customer', audience: null });
    const refused = await rejectionOf(previewXChangeExport(ARIES, { kind: 'priceList', priceListId: cost.id }));
    expect(refused.issues).toEqual([{ code: 'xchangePriceListNotOffered', path: 'priceListId' }]);
  });
});
