/**
 * Ο αναγνώστης του master (ADR-923 §5.11 «3ε») πάνω στο επαληθευμένο ψεύτικο Firestore, με λίστες χτισμένες **μέσα από τους
 * γραφείς**: ό,τι ισχύει · ό,τι έρχεται · επίπεδο έργου · απομόνωση χώρου · καμία λίστα πώλησης.
 */

import type { Firestore } from 'firebase-admin/firestore';

import { MFP_PRICE_LIST } from '@/subapps/catalog/__tests__/fixtures/mfp-price-list.fixture';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';
import { ARIES, RIVAL, rejectionOf } from './catalog-writer-seed';

const fake = new FakeFirestore();

jest.mock('@/lib/firebaseAdmin', () => ({ getAdminFirestore: (): Firestore => fake as unknown as Firestore }));
jest.mock('@/services/entity-audit-tracked-write', () => ({ recordTrackedEntityWrite: async () => undefined }));

/* eslint-disable import/first -- τα mocks πρέπει να δηλωθούν πριν φορτωθούν οι γραφείς */
import { readCostRateBook } from '../cost-rates.server';
import { savePriceLines } from '../price-line-writer.server';
import { createCatalogPriceList } from '../price-list-writer.server';
import { publishPriceListVersion } from '../price-publication.server';
import { createPriceListVersion } from '../price-version-writer.server';
/* eslint-enable import/first */

const JUNE = Date.parse('2026-06-01T00:00:00.000Z');
const JANUARY = '2026-01-01T00:00:00.000Z';
const DECEMBER = '2026-12-01T00:00:00.000Z';

const costDefinition = (code: string, projectId: string | null = null) => ({
  ...MFP_PRICE_LIST.definition,
  code,
  kind: 'cost' as const,
  priceType: 'net_customer' as const,
  audience: null,
  projectId,
});

const work = (material: number, atoeCode = 'OIK-4.01') => ({
  subject: { kind: 'costItem' as const, atoeCode, region: null },
  netPrice: material + 300,
  priceQuantity: 1 as const,
  unitCode: 'm2',
  discountGroupId: null,
  breakdown: { description: 'Επίχρισμα', material, labor: 200, equipment: 100, defaultWasteBp: 500, materialVariantId: null },
});

async function publish(listId: string, validFrom: string, material: number) {
  const draft = await createPriceListVersion(ARIES, listId, { validFrom, basedOn: 'empty' });
  const saved = await savePriceLines(ARIES, draft.id, { expectedLinesRevision: draft.derived.linesRevision, upserts: [work(material)], deletes: [] });
  return publishPriceListVersion(ARIES, draft.id, { expectedRevision: draft.revision, expectedLinesRevision: saved.linesRevision, confirmedDiffDigest: null });
}

beforeEach(() => {
  fake.reset();
  fake.seed(COLLECTIONS.PROJECTS, 'proj_1', { companyId: ARIES.companyId });
  fake.seed(COLLECTIONS.PROJECTS, 'proj_foreign', { companyId: RIVAL.companyId });
});

describe('readCostRateBook', () => {
  it('ό,τι ισχύει τώρα + η επόμενη έκδοση, ποτέ λίστα πώλησης', async () => {
    await createCatalogPriceList(ARIES, MFP_PRICE_LIST.definition);
    const master = await createCatalogPriceList(ARIES, costDefinition('master'));
    await publish(master.id, JANUARY, 700);
    await publish(master.id, DECEMBER, 900);
    const book = await readCostRateBook(ARIES, 'proj_1', JUNE);
    expect(book.priceListIds).toEqual([master.id]);
    expect(book.current).toHaveLength(1);
    expect(book.current[0]).toMatchObject({ atoeCode: 'OIK-4.01', versionNumber: 1, netPrice: 1000, projectId: null, fenceBp: 2000 });
    expect(book.upcoming[0]).toMatchObject({ versionNumber: 2, netPrice: 1200, validFrom: DECEMBER });
    expect(book.freshness.freshUntil).not.toBeNull();
  });

  it('η λίστα έργου φαίνεται μόνο στο έργο της', async () => {
    const list = await createCatalogPriceList(ARIES, costDefinition('island', 'proj_1'));
    await publish(list.id, JANUARY, 800);
    expect((await readCostRateBook(ARIES, 'proj_1', JUNE)).current[0]).toMatchObject({ projectId: 'proj_1' });
    expect((await readCostRateBook(ARIES, 'proj_other', JUNE)).current).toEqual([]);
  });

  it('ξένος χώρος δεν βλέπει τίποτα · χωρίς δημοσιευμένη έκδοση δεν υπάρχει τιμή', async () => {
    const master = await createCatalogPriceList(ARIES, costDefinition('master'));
    expect((await readCostRateBook(ARIES, 'proj_1', JUNE)).current).toEqual([]);
    await publish(master.id, JANUARY, 700);
    expect((await readCostRateBook(RIVAL, 'proj_1', JUNE)).priceListIds).toEqual([]);
  });
});

describe('το έργο της λίστας', () => {
  it('⛔ ξένο ή ανύπαρκτο έργο = unknownReference · ⛔ λίστα πώλησης με έργο', async () => {
    for (const projectId of ['proj_foreign', 'proj_missing']) {
      const error = await rejectionOf(createCatalogPriceList(ARIES, costDefinition('x', projectId)));
      expect(error.issues).toEqual([{ code: 'unknownReference', path: 'projectId' }]);
    }
    const sales = await rejectionOf(createCatalogPriceList(ARIES, { ...MFP_PRICE_LIST.definition, projectId: 'proj_1' }));
    expect(sales.issues.map((issue) => issue.code)).toEqual(['projectOnlyOnCostList']);
  });
});
