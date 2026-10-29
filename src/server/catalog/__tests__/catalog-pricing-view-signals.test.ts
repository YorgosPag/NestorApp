/**
 * Τα σήματα όψεων τιμών (ADR-923 §5.11 «3δ» Ζ · ADR-905) από άκρη σε άκρη, πάνω στο επαληθευμένο ψεύτικο Firestore:
 * κάθε γραφή τιμολόγησης αυξάνει **μέσα στη συναλλαγή της** τον αριθμό των όψεων που αγγίζει — **μία** φορά ανά
 * συναλλαγή, **μόνο** στον δικό της χώρο, και **καθόλου** όταν η συναλλαγή αρνείται.
 */

import type { Firestore } from 'firebase-admin/firestore';

import { generateDeterministicCatalogPricingViewSignalId } from '@/services/enterprise-id.service';
import { PRICING_VIEW_MAX_AGE_MS } from '@/subapps/catalog/pricing/pricing-view-freshness';
import { pricingViewKey, type PricingView } from '@/subapps/catalog/pricing/pricing-view-key';
import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';
import { ARIES, RIVAL, rejectionOf } from './catalog-writer-seed';
import { seedPricing, version1Inputs } from './catalog-pricing-seed';

const fake = new FakeFirestore();

jest.mock('@/lib/firebaseAdmin', () => ({ getAdminFirestore: (): Firestore => fake as unknown as Firestore }));
jest.mock('@/services/entity-audit-tracked-write', () => ({ recordTrackedEntityWrite: async () => undefined }));

/* eslint-disable import/first -- τα mocks πρέπει να δηλωθούν πριν φορτωθούν οι γραφείς */
import { savePriceLines } from '../price-line-writer.server';
import { createPriceListVersion } from '../price-version-writer.server';
import { createPricingGroup } from '../pricing-group-writer.server';
import { readDiscountsView, readPriceLinesPage, readPriceListsView } from '../pricing-views.server';
/* eslint-enable import/first */

const SIGNALS = 'catalog_pricing_view_signals';
const LISTS: PricingView = { kind: 'lists' };
const DISCOUNTS: PricingView = { kind: 'discounts' };

function signalOf(companyId: string, view: PricingView): Record<string, unknown> | undefined {
  return fake.getData(SIGNALS, generateDeterministicCatalogPricingViewSignalId(companyId, pricingViewKey(view)));
}
const revisionOf = (companyId: string, view: PricingView): number => {
  const revision = signalOf(companyId, view)?.revision;
  return typeof revision === 'number' ? revision : 0;
};

beforeEach(() => fake.reset());

describe('ο γραφέας των σημάτων μέσα στη μηχανή', () => {
  it('ομάδα έκπτωσης ⇒ +1 στην όψη εκπτώσεων, τίποτα στους καταλόγους', async () => {
    await createPricingGroup(ARIES, 'discountGroup', { code: 'tosh_carr', labels: { el: 'TOSH-CARR' } });
    expect(revisionOf(ARIES.companyId, DISCOUNTS)).toBe(1);
    expect(signalOf(ARIES.companyId, LISTS)).toBeUndefined();
  });

  it('το σήμα κουβαλά ΜΟΝΟ χώρο, όψη, αριθμό, χρόνο — ποτέ περιεχόμενο', async () => {
    await createPricingGroup(ARIES, 'discountGroup', { code: 'tosh_carr', labels: { el: 'TOSH-CARR' } });
    expect(Object.keys(signalOf(ARIES.companyId, DISCOUNTS) ?? {}).sort()).toEqual(['changedAt', 'companyId', 'revision', 'view']);
    expect(signalOf(ARIES.companyId, DISCOUNTS)).toMatchObject({ companyId: ARIES.companyId, view: 'discounts' });
  });

  it('δέσμη γραμμών ⇒ ΜΙΑ αύξηση ανά όψη ανά συναλλαγή, όσες γραμμές κι αν γράφτηκαν', async () => {
    const seeded = await seedPricing(fake);
    const listView: PricingView = { kind: 'list', priceListId: seeded.priceListId };
    const draft = await createPriceListVersion(ARIES, seeded.priceListId, { validFrom: '2026-01-01T00:00:00.000Z', basedOn: 'empty' });
    const before = { list: revisionOf(ARIES.companyId, listView), lists: revisionOf(ARIES.companyId, LISTS) };
    const inputs = version1Inputs(seeded.toshCarrId);
    expect(inputs.length).toBeGreaterThan(1);
    await savePriceLines(ARIES, draft.id, { expectedLinesRevision: 0, upserts: inputs, deletes: [] });
    expect(revisionOf(ARIES.companyId, listView)).toBe(before.list + 1);
    expect(revisionOf(ARIES.companyId, LISTS)).toBe(before.lists + 1);
  });

  it('συναλλαγή που αρνείται ⇒ κανένα σήμα (αλλαγή και σήμα πέφτουν μαζί)', async () => {
    await createPricingGroup(ARIES, 'discountGroup', { code: 'tosh_carr', labels: { el: 'TOSH-CARR' } });
    const error = await rejectionOf(createPricingGroup(ARIES, 'discountGroup', { code: 'tosh_carr', labels: { el: 'TOSH-CARR' } }));
    expect(error.kind).toBe('duplicateCode');
    expect(revisionOf(ARIES.companyId, DISCOUNTS)).toBe(1);
  });

  it('ο αριθμός είναι ΑΝΑ ΧΩΡΟ — η γραφή ενός χώρου δεν σηματοδοτεί ποτέ άλλον', async () => {
    await createPricingGroup(ARIES, 'discountGroup', { code: 'tosh_carr', labels: { el: 'TOSH-CARR' } });
    expect(signalOf(RIVAL.companyId, DISCOUNTS)).toBeUndefined();
    await createPricingGroup(RIVAL, 'discountGroup', { code: 'tosh_carr', labels: { el: 'TOSH-CARR' } });
    expect(revisionOf(RIVAL.companyId, DISCOUNTS)).toBe(1);
    expect(revisionOf(ARIES.companyId, DISCOUNTS)).toBe(1);
  });
});

describe('οι όψεις κουβαλούν την αναθεώρηση του σήματός τους (ίδιο στιγμιότυπο)', () => {
  const NOW = Date.parse('2026-08-01T00:00:00.000Z');

  it('ανύπαρκτο σήμα ⇒ 0 · μετά από γραφή ⇒ ο αριθμός της', async () => {
    expect((await readDiscountsView(ARIES, NOW)).freshness.revision).toBe(0);
    await createPricingGroup(ARIES, 'customerGroup', { code: 'wholesale', labels: { el: 'Χονδρέμπορος' } });
    const view = await readDiscountsView(ARIES, NOW);
    expect(view.freshness.revision).toBe(1);
    expect(view.customerGroups.map((group) => group.code)).toEqual(['wholesale']);
  });

  it('η όψη εκπτώσεων λήγει στο πρώτο ΜΕΛΛΟΝΤΙΚΟ όριο συνθήκης', async () => {
    await seedPricing(fake);
    const view = await readDiscountsView(ARIES, NOW);
    const future = view.conditions
      .flatMap((condition) => [condition.validFrom, condition.validUntil])
      .filter((iso): iso is string => iso !== null && Date.parse(iso) > NOW)
      .sort();
    const expected = Math.min(NOW + PRICING_VIEW_MAX_AGE_MS, ...future.map((iso) => Date.parse(iso)));
    expect(view.freshness.freshUntil).toBe(new Date(expected).toISOString());
  });

  it('η όψη καταλόγων φέρνει λίστες + εκδόσεις· ξένος χώρος δεν βλέπει τίποτα', async () => {
    const seeded = await seedPricing(fake);
    await createPriceListVersion(ARIES, seeded.priceListId, { validFrom: '2026-01-01T00:00:00.000Z', basedOn: 'empty' });
    const view = await readPriceListsView(ARIES, NOW);
    expect(view.lists.map((list) => list.id)).toEqual([seeded.priceListId]);
    expect(view.versions.map((version) => version.priceListId)).toEqual([seeded.priceListId]);
    expect(view.freshness.revision).toBe(revisionOf(ARIES.companyId, LISTS));
    const rival = await readPriceListsView(RIVAL, NOW);
    expect(rival.lists).toEqual([]);
  });

  it('σελίδα γραμμών: έκδοση + γραμμές + αναθεώρηση της όψης της λίστας· ξένη έκδοση ⇒ notFound', async () => {
    const seeded = await seedPricing(fake);
    const draft = await createPriceListVersion(ARIES, seeded.priceListId, { validFrom: '2026-01-01T00:00:00.000Z', basedOn: 'empty' });
    const inputs = version1Inputs(seeded.toshCarrId);
    await savePriceLines(ARIES, draft.id, { expectedLinesRevision: 0, upserts: inputs, deletes: [] });
    const page = await readPriceLinesPage(ARIES, draft.id, null, NOW);
    expect(page.lines).toHaveLength(inputs.length);
    expect(page.nextCursor).toBeNull();
    expect(page.version.derived.linesRevision).toBe(1);
    // Κάθε ζωντανή παραλλαγή της σελίδας έρχεται με τον κωδικό της — καμία ανάγνωση ανά γραμμή στον πελάτη.
    const variantIds = page.lines.flatMap((line) => (line.subject.kind === 'variant' ? [line.subject.variantId] : []));
    expect(Object.keys(page.skuIdentifiers).sort()).toEqual([...new Set(variantIds)].sort());
    expect(Object.values(page.skuIdentifiers).every((identifier) => identifier.length > 0)).toBe(true);
    expect(page.freshness.revision).toBe(revisionOf(ARIES.companyId, { kind: 'list', priceListId: seeded.priceListId }));
    expect((await rejectionOf(readPriceLinesPage(RIVAL, draft.id, null, NOW))).kind).toBe('notFound');
  });
});
