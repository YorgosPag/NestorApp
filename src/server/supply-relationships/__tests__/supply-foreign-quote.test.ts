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
import { SIMPLE_VARIANT_ID } from '@/subapps/catalog/__tests__/fixtures/mfp-price-list.fixture';
import type { CatalogVisibility } from '@/subapps/catalog/vocabulary/pricing';
import type { SupplyRelationship } from '@/subapps/catalog/types/supply-relationship';

import { applySupplierPrice } from '../boq-supplier-price.server';
import { issueSupplyInvitation } from '../supply-invitation-issue.server';
import { respondToSupplyInvitation } from '../supply-invitation-redeem.server';
import { quoteForeignPrice } from '../supply-foreign-quote.server';
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
const apply = (ctx = BUYER) => applySupplierPrice(ctx, { boqItemId: ITEM, relationshipId: RELATIONSHIP_ID(), variantId: SIMPLE_VARIANT_ID });
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

const seedItem = (overrides: Record<string, unknown> = {}) => fake.seed(COLLECTIONS.BOQ_ITEMS, ITEM, {
  id: ITEM, companyId: BUYER_ID, status: 'draft', unit: 'pcs', estimatedQuantity: 2, wastePolicy: 'inherited', wasteFactor: 0.08,
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
    expect(await apply()).toEqual({ kind: 'applied' });
    const line = item() as Record<string, unknown> & { priceSource: Record<string, unknown>; materialUnitCost: number };
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
});
