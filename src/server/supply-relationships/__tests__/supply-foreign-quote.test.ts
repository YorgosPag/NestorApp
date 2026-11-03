/**
 * @jest-environment node
 *
 * **Ξένη τιμή και γραμμή BOQ από άκρη σε άκρη** (ADR-923 §5.12 Δ4 · Δ5 · Δ7 · Σ4 · Σ7), πάνω στο ψεύτικο Firestore: πραγματική
 * σχέση, πραγματικοί κανόνες ορατότητας, πραγματικός επιλυτής.
 */

jest.mock('server-only', () => ({}));

const mockOwnWorkspaces = jest.fn(async (_uid: string, _active: unknown): Promise<unknown> => ({ outcome: 'ok', reachable: [], belonging: ['comp-buyer'] }));
jest.mock('@/lib/auth/workspace-membership', () => ({
  ...jest.requireActual('@/lib/auth/workspace-membership'),
  listOwnWorkspaces: (uid: string, active: unknown) => mockOwnWorkspaces(uid, active),
}));

const fake = new (jest.requireActual('@/test-utils/fake-firestore/fake-firestore').FakeFirestore)();

jest.mock('@/lib/firebaseAdmin', () => ({ getAdminFirestore: () => fake }));

/** Τρέχει ΑΦΟΥ βγει η τιμή και ΠΡΙΝ τη γραφή: ο αγώνας της ανάκλησης. */
let mockAfterQuote: () => Promise<void> = async () => undefined;
jest.mock('../supply-foreign-quote.server', () => {
  const actual = jest.requireActual('../supply-foreign-quote.server');
  return {
    ...actual,
    quoteForeignLine: async (...args: unknown[]) => {
      const quoted = await actual.quoteForeignLine(...args);
      await mockAfterQuote();
      return quoted;
    },
  };
});
jest.mock('@/services/entity-audit-tracked-write', () => ({ recordTrackedEntityWrite: jest.fn(async () => undefined) }));
jest.mock('@/server/notifications/notification-orchestrator', () => ({ dispatchNotification: jest.fn(async () => ({ success: true })) }));

/* eslint-disable import/first -- τα mocks πρέπει να δηλωθούν πριν φορτωθούν οι γραφείς */
import type { Firestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { ARIES, RIVAL } from '@/server/catalog/__tests__/catalog-writer-seed';
import { seedPricing, version1Inputs } from '@/server/catalog/__tests__/catalog-pricing-seed';
import { savePriceLines } from '@/server/catalog/price-line-writer.server';
import { publishPriceListVersion } from '@/server/catalog/price-publication.server';
import { createPriceListVersion } from '@/server/catalog/price-version-writer.server';
import { createVisibilityRule } from '@/server/catalog/visibility-rule-writer.server';
import { generateDeterministicCatalogProductModelId, generateDeterministicCatalogUniqueValueId } from '@/services/enterprise-id-convenience';
import { supplierLineQuantity } from '@/services/measurements/boq-price-source';
import { SIMPLE_VARIANT_ID } from '@/subapps/catalog/__tests__/fixtures/mfp-price-list.fixture';
import { catalogSearchPrefixes, catalogSearchText } from '@/subapps/catalog/derived/search-prefixes';
import { catalogSortKey } from '@/subapps/catalog/derived/sort-key';
import { FOREIGN_SKU_RESULTS, FOREIGN_SKU_WINDOW } from '@/subapps/catalog/pricing/foreign-sku-search';
import { uniqueValueKey } from '@/subapps/catalog/values/normalize-unique';
import type { CatalogVisibility } from '@/subapps/catalog/vocabulary/pricing';
import type { SupplyRelationship } from '@/subapps/catalog/types/supply-relationship';

import { reviewSupplierPrices } from '../boq-supplier-drift.server';
import { applySupplierPrice } from '../boq-supplier-price.server';
import { issueSupplyInvitation } from '../supply-invitation-issue.server';
import { respondToSupplyInvitation } from '../supply-invitation-redeem.server';
import { quoteForeignPrice, resolveForeignSku, resolveVisibleForeignSku, searchForeignCatalog } from '../supply-foreign-quote.server';
import { supplyRelationshipId } from '../supply-relationship-store.server';
import { endSupplyRelationship } from '../supply-relationship-writer.server';
/* eslint-enable import/first */

process.env.SUPPLY_INVITE_SECRET ??= 'δοκιμαστικό-μυστικό-πρόσκλησης-προμήθειας';

const db = () => fake as unknown as Firestore;
const BUYER_ID = 'comp-buyer';
const BUYER = { ...ARIES, uid: 'u_buyer', companyId: BUYER_ID };
const CONTACT = 'cont_buyer';
const EMAIL = 'orders@buyer.gr';
const RELATIONSHIP_ID = () => supplyRelationshipId({ supplierCompanyId: ARIES.companyId, buyerCompanyId: BUYER_ID });
const ITEM = 'boq_1';

const quote = (ctx = BUYER, relationshipId = RELATIONSHIP_ID()) => quoteForeignPrice(ctx, { relationshipId, variantId: SIMPLE_VARIANT_ID, quantity: 1 });
/** Ό,τι θα έβλεπε ο άνθρωπος για τη γραμμή όπως είναι τώρα. Χωρίς τιμή, το ποσό δεν κρίνεται ποτέ: η άρνηση έρχεται πρώτα. */
async function seenPrice(ctx = BUYER) {
  const quantity = supplierLineQuantity(item() as { estimatedQuantity: number });
  const seen = await quoteForeignPrice(ctx, { relationshipId: RELATIONSHIP_ID(), variantId: SIMPLE_VARIANT_ID, quantity });
  return seen.kind === 'priced' ? { netAmount: seen.price.netAmount, quantity: seen.price.quantity } : { netAmount: 1, quantity };
}
const applyAs = (ctx: typeof BUYER, acknowledged: { netAmount: number; quantity: number }, confirmFence = false) =>
  applySupplierPrice(ctx, { boqItemId: ITEM, relationshipId: RELATIONSHIP_ID(), variantId: SIMPLE_VARIANT_ID, acknowledged, confirmFence });
const apply = async (ctx = BUYER, confirmFence = false) => applyAs(ctx, await seenPrice(ctx), confirmFence);
const showAll = (visibility: CatalogVisibility) => createVisibilityRule(ARIES, { subject: { kind: 'catalog' }, audience: { kind: 'signedIn' }, visibility });
const item = () => fake.getData(COLLECTIONS.BOQ_ITEMS, ITEM);

async function connect(): Promise<SupplyRelationship> {
  const { token } = await issueSupplyInvitation(ARIES, { contactId: CONTACT, customerGroupId: null });
  await respondToSupplyInvitation(db(), {
    action: 'accept', token, identity: { uid: 'u_buyer', email: EMAIL, emailVerified: true, secondFactorEnrolled: false },
    acting: { uid: 'u_buyer', active: null, requested: null },
  });
  return fake.getData(COLLECTIONS.SUPPLY_RELATIONSHIPS, RELATIONSHIP_ID()) as SupplyRelationship;
}

// ⛔ Χωρίς `id` στο σώμα, όπως το πραγματικό έγγραφο: με `id` εδώ η ταυτότητα της γραμμής «υπήρχε» μόνο στο test (§5.12).
const seedItem = (overrides: Record<string, unknown> = {}) => fake.seed(COLLECTIONS.BOQ_ITEMS, ITEM, {
  companyId: BUYER_ID, status: 'draft', unit: 'pcs', estimatedQuantity: 2, wastePolicy: 'inherited', wasteFactor: 0.08,
  materialUnitCost: 0, laborUnitCost: 0, equipmentUnitCost: 0, ...overrides,
});

/** Τιμοκατάλογος με δημοσιευμένη έκδοση, όπως στις άγκυρες τιμολόγησης. */
async function seedWorld(): Promise<void> {
  fake.reset();
  const seeded = await seedPricing(fake);
  const draft = await createPriceListVersion(ARIES, seeded.priceListId, { validFrom: '2026-01-01T00:00:00.000Z', basedOn: 'empty' });
  const saved = await savePriceLines(ARIES, draft.id, { expectedLinesRevision: 0, upserts: version1Inputs(seeded.toshCarrId), deletes: [] });
  await publishPriceListVersion(ARIES, draft.id, { expectedRevision: draft.revision, expectedLinesRevision: saved.linesRevision, confirmedDiffDigest: null });
  fake.seed(COLLECTIONS.COMPANIES, ARIES.companyId, { name: 'Aries' });
  fake.seed(COLLECTIONS.CONTACTS, CONTACT, { id: CONTACT, companyId: ARIES.companyId, emails: [{ email: EMAIL, isPrimary: true }] });
  seedItem();
}

beforeEach(async () => {
  mockAfterQuote = async () => undefined;
  await seedWorld();
});

describe('ADR-923 §5.8: ο δεσμός υλικού με SKU', () => {
  const link = (relationshipId = RELATIONSHIP_ID(), variantId = SIMPLE_VARIANT_ID) => ({ relationshipId, variantId });
  const SKU = () => ({ supplierCompanyId: ARIES.companyId, variantId: SIMPLE_VARIANT_ID });

  it('ορατό SKU με ενεργή σχέση: ο προμηθευτής βγαίνει από τη σχέση', async () => {
    await connect();
    await showAll('visible');
    expect(await resolveForeignSku(BUYER, link())).toEqual(SKU());
  });

  it('ADR-923 §5.13 Τ4: το κείμενο της γραμμής RFQ βγαίνει από το SKU της ίδιας ξένης ανάγνωσης, όχι από τον πελάτη', async () => {
    await connect();
    await showAll('visible');
    const stored = fake.getData(COLLECTIONS.CATALOG_PRODUCTS, SIMPLE_VARIANT_ID) ?? {};
    fake.seed(COLLECTIONS.CATALOG_PRODUCTS, SIMPLE_VARIANT_ID, { ...stored, derived: { ...(stored.derived as object), identifier: 'TC-1', label: 'Καλώδιο' } });
    expect(await resolveVisibleForeignSku(BUYER, link())).toEqual({ ref: SKU(), text: 'TC-1 — Καλώδιο' });
    expect(await resolveVisibleForeignSku(RIVAL, link())).toBeNull();
  });

  it('`visibleNoPrice`: το SKU φαίνεται, άρα δένεται, χωρίς τιμή', async () => {
    await connect();
    await showAll('visibleNoPrice');
    expect(await resolveForeignSku(BUYER, link())).toEqual(SKU());
  });

  it('🔴 κάθε «όχι» είναι το ίδιο `null`: χωρίς σχέση · ξένη σχέση · ανύπαρκτη · ανύπαρκτο SKU · ανακλημένη', async () => {
    await showAll('visible');
    expect(await resolveForeignSku(BUYER, link())).toBeNull();
    const relationship = await connect();
    expect(await resolveForeignSku(RIVAL, link())).toBeNull();
    expect(await resolveForeignSku(BUYER, link('srel_ghost'))).toBeNull();
    expect(await resolveForeignSku(BUYER, link(RELATIONSHIP_ID(), 'var_ghost'))).toBeNull();
    await endSupplyRelationship(ARIES, relationship.id, { side: 'supplier', expectedRevision: relationship.revision });
    expect(await resolveForeignSku(BUYER, link())).toBeNull();
  });

  it('κρυφό SKU: χωρίς κανόνα η προεπιλογή είναι `hidden`', async () => {
    await connect();
    expect(await resolveForeignSku(BUYER, link())).toBeNull();
  });
});

describe('Σ4 · Σ7: κάθε «όχι» είναι η ίδια απάντηση', () => {
  const UNAVAILABLE = { kind: 'unavailable' };

  it('χωρίς σχέση', async () => {
    await showAll('visible');
    expect(await quote()).toEqual(UNAVAILABLE);
  });

  it('🔴 ανύπαρκτη σχέση · ξένος χώρος που ονομάζει ξένη σχέση', async () => {
    await connect();
    await showAll('visible');
    expect(await quote(BUYER, 'srel_ghost')).toEqual(UNAVAILABLE);
    expect(await quote(RIVAL)).toEqual(UNAVAILABLE);
  });

  it('χωρίς κανόνα ορατότητας: η προεπιλογή είναι `hidden` (Δ3)', async () => {
    await connect();
    expect(await quote()).toEqual(UNAVAILABLE);
  });

  it('🔴 μετά την ανάκληση, αμέσως', async () => {
    const relationship = await connect();
    await showAll('visible');
    expect((await quote()).kind).not.toBe('unavailable');
    await endSupplyRelationship(BUYER, relationship.id, { side: 'buyer', expectedRevision: relationship.revision });
    expect(await quote()).toEqual(UNAVAILABLE);
  });
});

describe('η τιμή', () => {
  it('🔴 ο ξένος κατάλογος διαβάζεται σε συναλλαγή μόνο ανάγνωσης (Δ5)', async () => {
    await connect();
    await showAll('visible');
    const transactions = jest.spyOn(fake, 'runTransaction');
    await quote();
    expect(transactions).toHaveBeenCalledWith(expect.any(Function), { readOnly: true });
    transactions.mockRestore();
  });

  it('`visibleNoPrice` ⇒ ζητήστε προσφορά', async () => {
    await connect();
    await showAll('visibleNoPrice');
    expect(await quote()).toEqual({ kind: 'requestQuote' });
  });

  it('`visible` ⇒ τιμή, χωρίς κανένα εσωτερικό κλειδί', async () => {
    await connect();
    await showAll('visible');
    const answer = await quote();
    expect(answer.kind).toBe('priced');
    expect(Object.keys(answer)).toEqual(['kind', 'price']);
    expect(JSON.stringify(answer)).not.toMatch(/trace|cascade|listAmount|relationship/);
  });
});

describe('Δ7 · Δ8: η γραμμή BOQ', () => {
  beforeEach(async () => {
    await connect();
    await showAll('visible');
  });

  it('γράφει στιγμιότυπο με έκδοση, κοινό και βήματα, και το ποσό στο material', async () => {
    const outcome = await apply();
    const line = item() as Record<string, unknown> & { priceSource: Record<string, unknown>; materialUnitCost: number };
    expect(outcome).toEqual({ kind: 'applied', source: line.priceSource });
    expect(line.priceAuthority).toBe('supplier');
    expect(line.priceSource).toMatchObject({
      authority: 'supplier', supplierCompanyId: ARIES.companyId, variantId: SIMPLE_VARIANT_ID, unit: 'pcs', priceQuantity: 2, appliedBy: 'u_buyer',
    });
    expect(line.priceSource.versionNumber).toBeGreaterThan(0);
    expect(line.priceSource).toHaveProperty('audience');
    expect(line.priceSource).toHaveProperty('discountSteps');
    expect(line.laborUnitCost).toBe(0);
    expect(line.materialUnitCost).toBeGreaterThan(0);
  });

  it('η φύρα της γραμμής δεν αγγίζεται', async () => {
    await apply();
    expect(item()).toMatchObject({ wasteFactor: 0.08 });
  });

  it('🔴 Σ7: η ανάκληση αφήνει το στιγμιότυπο, κλείνει τη νέα εφαρμογή', async () => {
    await apply();
    const relationship = fake.getData(COLLECTIONS.SUPPLY_RELATIONSHIPS, RELATIONSHIP_ID()) as SupplyRelationship;
    await endSupplyRelationship(ARIES, relationship.id, { side: 'supplier', expectedRevision: relationship.revision });
    const before = JSON.stringify(item());
    expect(await apply()).toEqual({ kind: 'unavailable' });
    expect(JSON.stringify(item())).toBe(before);
  });

  it('🔴 ανάκληση ανάμεσα στην τιμή και τη γραφή ⇒ τίποτα δεν γράφεται', async () => {
    mockAfterQuote = async () => {
      const relationship = fake.getData(COLLECTIONS.SUPPLY_RELATIONSHIPS, RELATIONSHIP_ID()) as SupplyRelationship;
      await endSupplyRelationship(ARIES, relationship.id, { side: 'supplier', expectedRevision: relationship.revision });
    };
    expect(await apply()).toEqual({ kind: 'unavailable' });
    expect(item()).toMatchObject({ materialUnitCost: 0 });
  });

  it('🔴 διαφορετική μονάδα ⇒ άρνηση, ποτέ σιωπηλή μετατροπή', async () => {
    seedItem({ unit: 'm2' });
    expect(await apply()).toEqual({ kind: 'unitMismatch' });
    expect(item()).toMatchObject({ materialUnitCost: 0 });
  });

  it.each([['submitted', { status: 'submitted' }], ['σύνοψη', { isGroupParent: true, groupRole: 'summary' }]])('🔴 %s ⇒ δεν παίρνει τιμή', async (_name, overrides) => {
    seedItem(overrides);
    expect(await apply()).toEqual({ kind: 'notApplicable' });
  });

  it('🔴 γραμμή ξένου χώρου ≡ ανύπαρκτη', async () => {
    seedItem({ companyId: RIVAL.companyId });
    expect(await apply()).toEqual({ kind: 'notApplicable' });
    expect(item()).toMatchObject({ materialUnitCost: 0 });
  });

  it('`visibleNoPrice` ⇒ καμία γραφή', async () => {
    await seedWorld();
    await connect();
    await showAll('visibleNoPrice');
    expect(await apply()).toEqual({ kind: 'requestQuote' });
    expect(item()).toMatchObject({ materialUnitCost: 0 });
  });

  it('🔴 δεκαδική ποσότητα BOQ τιμολογείται και ελέγχεται χωρίς να σκάσει το BigInt', async () => {
    seedItem({ estimatedQuantity: 12.5 });
    expect((await apply()).kind).toBe('applied');
    const [row] = (await reviewSupplierPrices(BUYER, [ITEM])).rows;
    expect(row.drift).toEqual({ kind: 'current' });
  });

  it('🔴 ποσότητα με περισσότερα δεκαδικά από τον επιλυτή δεν γίνεται ψευδές «ζητήστε προσφορά»', async () => {
    seedItem({ estimatedQuantity: 12.34567 });
    expect((await apply()).kind).toBe('applied');
    expect(item()).toMatchObject({ priceSource: { priceQuantity: 12.346 } });
  });
});

describe('«ό,τι είδε ο άνθρωπος, αυτό γράφεται»', () => {
  beforeEach(async () => {
    await connect();
    await showAll('visible');
  });

  it('🔴 άλλο ποσό από αυτό που είδε ⇒ η νέα τιμή γυρίζει, τίποτα δεν γράφεται', async () => {
    const seen = await seenPrice();
    const outcome = await applyAs(BUYER, { ...seen, netAmount: seen.netAmount + 1 });
    expect(outcome).toMatchObject({ kind: 'priceMoved', price: { netAmount: seen.netAmount } });
    expect(item()).toMatchObject({ materialUnitCost: 0 });
  });

  it('🔴 η ποσότητα της γραμμής άλλαξε ανάμεσα στην τιμή και τη γραφή ⇒ τίποτα δεν γράφεται', async () => {
    const seen = await seenPrice();
    mockAfterQuote = async () => { seedItem({ estimatedQuantity: 3 }); };
    expect((await applyAs(BUYER, seen)).kind).toBe('priceMoved');
    expect(item()).toMatchObject({ materialUnitCost: 0 });
  });
});

describe('Δ9: απόκλιση και ανανέωση', () => {
  beforeEach(async () => {
    await connect();
    await showAll('visible');
    await apply();
  });

  /** Το στιγμιότυπο της γραμμής με παλιότερη τιμή: το `factor` είναι το ποσοστό της τρέχουσας. */
  function ageSnapshot(factorPercent: number): void {
    const line = item() as { priceSource: { breakdown: { material: number }; variantId: string } };
    const material = Math.round((line.priceSource.breakdown.material * factorPercent) / 100);
    seedItem({ ...line, priceSource: { ...line.priceSource, breakdown: { ...line.priceSource.breakdown, material } } });
  }

  it('ίδια τιμή ⇒ `current`', async () => {
    expect((await reviewSupplierPrices(BUYER, [ITEM])).rows).toEqual([
      { boqItemId: ITEM, relationshipId: RELATIONSHIP_ID(), variantId: SIMPLE_VARIANT_ID, drift: { kind: 'current' } },
    ]);
  });

  it('νέα τιμή μέσα στον φράχτη ⇒ `changed`, και ανανέωση χωρίς επιβεβαίωση', async () => {
    ageSnapshot(90);
    const [row] = (await reviewSupplierPrices(BUYER, [ITEM])).rows;
    expect(row.drift).toMatchObject({ kind: 'changed', exceedsFence: false });
    expect((await apply()).kind).toBe('applied');
  });

  it('🔴 πάνω από τον φράχτη ⇒ ο διακομιστής αρνείται χωρίς επιβεβαίωση, ακόμη κι αν την παρακάμψει η οθόνη', async () => {
    ageSnapshot(50);
    const before = JSON.stringify(item());
    expect((await apply()).kind).toBe('fenceRequired');
    expect(JSON.stringify(item())).toBe(before);
    expect((await apply(BUYER, true)).kind).toBe('applied');
  });

  it('🔴 άλλο SKU δεν είναι ανανέωση: ο φράχτης δεν το αφορά', async () => {
    ageSnapshot(50);
    const line = item() as { priceSource: Record<string, unknown> };
    seedItem({ ...line, priceSource: { ...line.priceSource, variantId: 'cprod_other' } });
    expect((await apply()).kind).toBe('applied');
  });

  it('🔴 Σ7: ανάκληση ⇒ `unavailable` χωρίς λόγο, το στιγμιότυπο μένει', async () => {
    const relationship = fake.getData(COLLECTIONS.SUPPLY_RELATIONSHIPS, RELATIONSHIP_ID()) as SupplyRelationship;
    await endSupplyRelationship(ARIES, relationship.id, { side: 'supplier', expectedRevision: relationship.revision });
    const before = JSON.stringify(item());
    expect((await reviewSupplierPrices(BUYER, [ITEM])).rows[0].drift).toEqual({ kind: 'unavailable' });
    expect(JSON.stringify(item())).toBe(before);
  });

  it('🔴 γραμμή ξένου χώρου απλώς λείπει · γραμμή χωρίς δεσμό προμηθευτή δεν ρωτά κανέναν', async () => {
    expect((await reviewSupplierPrices(RIVAL, [ITEM])).rows).toEqual([]);
    fake.seed(COLLECTIONS.BOQ_ITEMS, 'boq_plain', { companyId: BUYER_ID, priceSource: null });
    expect((await reviewSupplierPrices(BUYER, ['boq_plain'])).rows).toEqual([]);
  });
});

describe('αναζήτηση SKU σε ξένο κατάλογο', () => {
  const search = (term: string, ctx = BUYER, relationshipId = RELATIONSHIP_ID()) => searchForeignCatalog(ctx, { relationshipId, term });
  const seedSku = (id: string, label: string, identifier: string, overrides: Record<string, unknown> = {}) => fake.seed(COLLECTIONS.CATALOG_PRODUCTS, id, {
    id, companyId: ARIES.companyId, isDeleted: false, revision: 1, modelId: null, categoryIds: [],
    derived: { label, identifier, sortKey: catalogSortKey(label), searchPrefixes: catalogSearchPrefixes(catalogSearchText(label, identifier)) }, ...overrides,
  });
  /** SKU που πέρασε από το ευρετήριο §5.12: το όνομα της οικογένειας ζει στο κείμενο, όχι στην ετικέτα. */
  const seedIndexedSku = (id: string, code: string, searchText: string) => seedSku(id, code, code, {
    derived: { label: code, identifier: code, sortKey: catalogSortKey(code), searchText, searchPrefixes: catalogSearchPrefixes(searchText) },
  });
  const seedCodeAttribute = () => fake.seed(COLLECTIONS.CATALOG_ATTRIBUTES, 'cattr_code', { id: 'cattr_code', companyId: ARIES.companyId, isDeleted: false, unique: true, type: 'text' });
  const reserve = (code: string, holderId: string) => fake.seed(
    COLLECTIONS.CATALOG_UNIQUE_VALUES,
    generateDeterministicCatalogUniqueValueId(ARIES.companyId, 'cattr_code', uniqueValueKey({ type: 'text', text: code }) ?? ''),
    { companyId: ARIES.companyId, holderId, holderKind: 'product' },
  );
  const hide = (variantId: string) => createVisibilityRule(ARIES, { subject: { kind: 'variant', variantId }, audience: { kind: 'signedIn' }, visibility: 'hidden' });

  beforeEach(async () => {
    await connect();
    await showAll('visible');
    seedCodeAttribute();
    seedSku('cprod_tile', 'Πλακάκι Δαπέδου 60x60', 'PL-6060');
    seedSku('cprod_pipe', 'Σωλήνας Χαλκού 16mm', 'CU-16');
  });

  it('βρίσκει και τη δεύτερη λέξη, χωρίς τόνους, με κρίση ολόκληρου του όρου', async () => {
    expect((await search('δαπεδου')).rows.map((row) => row.variantId)).toEqual(['cprod_tile']);
    expect((await search('ΣΩΛΗΝΑΣ χαλκού')).rows.map((row) => row.variantId)).toEqual(['cprod_pipe']);
    expect((await search('σωλήνας αλουμινίου')).rows).toEqual([]);
  });

  describe('όνομα οικογένειας και αναζητήσιμες ιδιότητες (§5.12)', () => {
    beforeEach(() => {
      seedIndexedSku('cprod_fan', 'FC-100', 'fc-100 fan coil τετραπλη κασετα');
    });

    it('🔴 το «fan coil» βρίσκει SKU με ετικέτα τον κωδικό, και το «fan-coil» το ίδιο', async () => {
      expect((await search('fan coil')).rows.map((row) => row.variantId)).toEqual(['cprod_fan']);
      expect((await search('fan-coil')).rows.map((row) => row.variantId)).toEqual(['cprod_fan']);
      expect((await search('τετραπλή κασέτα')).rows.map((row) => row.variantId)).toEqual(['cprod_fan']);
    });

    it('🔴 κρυφό ≡ ανύπαρκτο και στον νέο δρόμο: ίδια απάντηση με τον ανύπαρκτο όρο', async () => {
      await hide('cprod_fan');
      expect(await search('fan coil')).toEqual(await search('ανύπαρκτη λέξη'));
      expect(await search('fan coil')).toEqual({ rows: [] });
    });

    it('🔴 το κείμενο του ευρετηρίου δεν ταξιδεύει: η γραμμή έχει μόνο τα τέσσερα πεδία', async () => {
      const { rows } = await search('fan coil');
      expect(rows).toEqual([{ variantId: 'cprod_fan', code: 'FC-100', label: 'FC-100', priced: true }]);
    });

    it('🔴 κρίνεται το `searchText`, όχι η ετικέτα: το ίδιο πρόθεμα με άλλη δεύτερη λέξη κόβεται', async () => {
      expect((await search('fan αλουμινίου')).rows).toEqual([]);
    });

    it('🔴 SKU χωρίς `searchText`: κρίνεται ετικέτα και κωδικός, χωρίς διακοπή ως τον επανυπολογισμό', async () => {
      expect((await search('σωλήνας')).rows.map((row) => row.variantId)).toEqual(['cprod_pipe']);
    });
  });

  it('🔴 το πρόθεμα είναι μόνο ο σπόρος: λέξη που λείπει κόβει το αποτέλεσμα', async () => {
    expect((await search('σωλήνας χρυσό')).rows).toEqual([]);
  });

  it('🔴 κράτηση με ξένο χώρο στο έγγραφο ≡ ανύπαρκτη', async () => {
    seedSku('cprod_old', 'Παλιό', 'OLD-1', { derived: { label: 'Παλιό', identifier: 'OLD-1', sortKey: 'παλιο', searchPrefixes: [] } });
    const id = generateDeterministicCatalogUniqueValueId(ARIES.companyId, 'cattr_code', uniqueValueKey({ type: 'text', text: 'OLD-1' }) ?? '');
    fake.seed(COLLECTIONS.CATALOG_UNIQUE_VALUES, id, { companyId: RIVAL.companyId, holderId: 'cprod_old', holderKind: 'product' });
    expect((await search('OLD-1')).rows).toEqual([]);
  });

  it('🔴 κωδικός υπο-μοντέλου ⇒ μόνο τα δικά του SKU · κλειδί μοντέλου στους απογόνους δεν είναι SKU', async () => {
    const rootId = generateDeterministicCatalogProductModelId(ARIES.companyId, 'root-1');
    const subId = generateDeterministicCatalogProductModelId(ARIES.companyId, 'sub-1');
    const entry = (kind: string, parentId: string) => ({ kind, parentId, axisKey: null, completeChannels: [], facetKeys: [] });
    const model = (id: string, parentId: string | null, descendants: Record<string, unknown>) => fake.seed(COLLECTIONS.CATALOG_PRODUCT_MODELS, id, {
      id, companyId: ARIES.companyId, isDeleted: false, parentId, categoryIds: [], derived: { descendants },
    });
    model(rootId, null, { cprod_tile: entry('product', subId), cprod_pipe: entry('product', rootId), [SIMPLE_VARIANT_ID]: entry('productModel', rootId) });
    model(subId, rootId, {});
    expect((await search('SUB-1')).rows.map((row) => row.variantId)).toEqual(['cprod_tile']);
    expect((await search('ROOT-1')).rows.map((row) => row.variantId).sort()).toEqual(['cprod_pipe', 'cprod_tile']);
  });

  it('🔴 ο ακριβής κωδικός βρίσκει και SKU που δεν πέρασε ακόμη από τον επανυπολογισμό', async () => {
    const derived = { label: 'Παλιό SKU', identifier: 'OLD-1', sortKey: 'παλιο', searchPrefixes: [] };
    seedSku('cprod_old', 'Παλιό SKU', 'OLD-1', { derived });
    expect((await search('παλιό')).rows).toEqual([]);
    reserve('OLD-1', 'cprod_old');
    expect((await search('old-1')).rows.map((row) => row.variantId)).toEqual(['cprod_old']);
  });

  it('κωδικός μοντέλου ⇒ τα SKU του, με τα ορατά μόνο', async () => {
    const modelId = generateDeterministicCatalogProductModelId(ARIES.companyId, 'mfp-99');
    const entry = { kind: 'product', parentId: modelId, axisKey: null, completeChannels: [], facetKeys: [] };
    fake.seed(COLLECTIONS.CATALOG_PRODUCT_MODELS, modelId, {
      id: modelId, companyId: ARIES.companyId, isDeleted: false, parentId: null, categoryIds: [], derived: { descendants: { cprod_tile: entry, cprod_pipe: entry } },
    });
    await hide('cprod_pipe');
    expect((await search('MFP-99')).rows.map((row) => row.variantId)).toEqual(['cprod_tile']);
  });

  it('🔴 κρυφό ≡ ανύπαρκτο, και με ακριβή κωδικό, και η απάντηση δεν έχει κανένα άλλο κλειδί', async () => {
    reserve('PL-6060', 'cprod_tile');
    await hide('cprod_tile');
    const hidden = await search('PL-6060');
    expect(hidden).toEqual(await search('ΑΝΥΠΑΡΚΤΟ-999'));
    expect(hidden).toEqual({ rows: [] });
  });

  it('`visibleNoPrice` ⇒ φαίνεται, χωρίς τιμή', async () => {
    await createVisibilityRule(ARIES, { subject: { kind: 'variant', variantId: 'cprod_pipe' }, audience: { kind: 'signedIn' }, visibility: 'visibleNoPrice' });
    expect((await search('χαλκου')).rows).toEqual([{ variantId: 'cprod_pipe', code: 'CU-16', label: 'Σωλήνας Χαλκού 16mm', priced: false }]);
  });

  it('🔴 διαγραμμένο SKU · κρυφό που σκεπάζει το παράθυρο: μετρούν μόνο όσα φαίνονται', async () => {
    seedSku('cprod_gone', 'Σωλήνας Παλιός', 'CU-OLD', { isDeleted: true });
    for (let index = 0; index < FOREIGN_SKU_WINDOW; index += 1) {
      const id = `cprod_h${String(index).padStart(3, '0')}`;
      seedSku(id, `Αξεσουάρ ${index}`, `H-${index}`);
      await hide(id);
    }
    seedSku('cprod_visible', 'Ωραίο Αξεσουάρ', 'V-1');
    expect((await search('αξεσουαρ')).rows.map((row) => row.variantId)).toEqual(['cprod_visible']);
    expect((await search('παλιος')).rows).toEqual([]);
  });

  it('🔴 το πλήθος φράζεται, και ο προϋπολογισμός παραθύρων τελειώνει', async () => {
    for (let index = 0; index < FOREIGN_SKU_RESULTS + 5; index += 1) seedSku(`cprod_v${String(index).padStart(3, '0')}`, `Βίδα ${index}`, `B-${index}`);
    expect((await search('βιδα')).rows).toHaveLength(FOREIGN_SKU_RESULTS);
  });

  it('🔴 Σ7: χωρίς σχέση · ξένη σχέση · ανύπαρκτη · ανακλημένη ⇒ ίδια κενή απάντηση', async () => {
    const relationship = fake.getData(COLLECTIONS.SUPPLY_RELATIONSHIPS, RELATIONSHIP_ID()) as SupplyRelationship;
    expect((await search('δαπεδου')).rows).toHaveLength(1);
    expect(await search('δαπεδου', RIVAL)).toEqual({ rows: [] });
    expect(await search('δαπεδου', BUYER, 'srel_ghost')).toEqual({ rows: [] });
    await endSupplyRelationship(BUYER, relationship.id, { side: 'buyer', expectedRevision: relationship.revision });
    expect(await search('δαπεδου')).toEqual({ rows: [] });
  });

  it('🔴 ο ξένος κατάλογος διαβάζεται μόνο σε συναλλαγή ανάγνωσης (Δ5)', async () => {
    const transactions = jest.spyOn(fake, 'runTransaction');
    await search('δαπεδου');
    expect(transactions).toHaveBeenCalledWith(expect.any(Function), { readOnly: true });
    transactions.mockRestore();
  });
});
