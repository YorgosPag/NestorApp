/**
 * Ο γραφέας κανόνων ορατότητας και η κρίση μέσα στον επιλυτή (ADR-923 §5.12 Δ1 · Δ4), πάνω στο ψεύτικο Firestore.
 * 🔑 Η κρίση ταξιδεύει δίπλα στην τιμή: ο ίδιος ο προμηθευτής συνεχίζει να βλέπει το ποσό του.
 */

import type { Firestore } from 'firebase-admin/firestore';

import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';
import { SIMPLE_VARIANT_ID } from '@/subapps/catalog/__tests__/fixtures/mfp-price-list.fixture';
import type { PriceAudience } from '@/subapps/catalog/types/price-list';
import type { PriceQuoteRequest } from '@/subapps/catalog/types/price-list-requests';
import type { VisibilityRuleDefinition } from '@/subapps/catalog/types/visibility-rule';
import { ARIES, RIVAL, rejectionOf } from './catalog-writer-seed';
import { seedPricedProducts } from './catalog-pricing-seed';

const fake = new FakeFirestore();
const recordTrackedEntityWrite = jest.fn(async (_input: { entityType: string }) => undefined);

jest.mock('@/lib/firebaseAdmin', () => ({ getAdminFirestore: (): Firestore => fake as unknown as Firestore }));
jest.mock('@/services/entity-audit-tracked-write', () => ({
  recordTrackedEntityWrite: (input: { entityType: string }) => recordTrackedEntityWrite(input),
}));

/* eslint-disable import/first -- τα mocks πρέπει να δηλωθούν πριν φορτωθούν οι γραφείς */
import { quoteCatalogPrice } from '../price-quote.server';
import { readDiscountsView } from '../pricing-views.server';
import { createVisibilityRule, deleteVisibilityRule, updateVisibilityRule } from '../visibility-rule-writer.server';
/* eslint-enable import/first */

const SIGNED_IN: PriceAudience = { kind: 'signedIn' };
const CATALOG_RULE: VisibilityRuleDefinition = { subject: { kind: 'catalog' }, audience: SIGNED_IN, visibility: 'visible' };
const SKU_RULE: VisibilityRuleDefinition = { subject: { kind: 'variant', variantId: SIMPLE_VARIANT_ID }, audience: SIGNED_IN, visibility: 'hidden' };

const quote = (viewAs: PriceAudience): PriceQuoteRequest => ({
  viewAs,
  subject: { kind: 'variant', variantId: SIMPLE_VARIANT_ID },
  quantity: 1,
  at: null,
  priceListId: null,
});

beforeEach(() => {
  fake.reset();
  recordTrackedEntityWrite.mockClear();
  seedPricedProducts(fake);
});

describe('ο γραφέας κανόνων', () => {
  it('γράφει με ιστορικό και σήμα της όψης `discounts`', async () => {
    const stored = await createVisibilityRule(ARIES, CATALOG_RULE);
    expect(stored).toMatchObject({ ...CATALOG_RULE, companyId: ARIES.companyId, revision: 1 });
    expect(recordTrackedEntityWrite).toHaveBeenCalledWith(expect.objectContaining({ entityType: 'catalog_visibility_rule' }));
    const view = await readDiscountsView(ARIES);
    expect(view.visibilityRules.map((rule) => rule.id)).toEqual([stored.id]);
    expect(view.freshness.revision).toBeGreaterThan(0);
  });

  it('δεύτερος κανόνας στο ίδιο κελί ⇒ διπλότυπο, δομικά', async () => {
    await createVisibilityRule(ARIES, CATALOG_RULE);
    const error = await rejectionOf(createVisibilityRule(ARIES, { ...CATALOG_RULE, visibility: 'hidden' }));
    expect(error.kind).toBe('duplicateCode');
  });

  it('διαγραμμένος κανόνας ξαναγεννιέται στο ίδιο κελί', async () => {
    const first = await createVisibilityRule(ARIES, CATALOG_RULE);
    await deleteVisibilityRule(ARIES, first.id, first.revision);
    const again = await createVisibilityRule(ARIES, CATALOG_RULE);
    expect(again.id).toBe(first.id);
    expect(again.revision).toBeGreaterThan(first.revision);
  });

  it('αλλάζει η απάντηση, ΟΧΙ το αντικείμενο ή το κοινό', async () => {
    const stored = await createVisibilityRule(ARIES, CATALOG_RULE);
    const changed = await updateVisibilityRule(ARIES, stored.id, stored.revision, { ...CATALOG_RULE, visibility: 'visibleNoPrice' });
    expect(changed.visibility).toBe('visibleNoPrice');
    const moved = await rejectionOf(updateVisibilityRule(ARIES, stored.id, changed.revision, { ...CATALOG_RULE, audience: { kind: 'anonymous' } }));
    expect(moved.kind).toBe('immutable');
    const relocated = await rejectionOf(updateVisibilityRule(ARIES, stored.id, changed.revision, SKU_RULE));
    expect(relocated.kind).toBe('immutable');
  });

  it('CAS: παλιά αναθεώρηση ⇒ σύγκρουση', async () => {
    const stored = await createVisibilityRule(ARIES, CATALOG_RULE);
    const error = await rejectionOf(updateVisibilityRule(ARIES, stored.id, stored.revision + 1, CATALOG_RULE));
    expect(error.kind).toBe('revisionMismatch');
  });

  it('αντικείμενο που δεν υπάρχει ⇒ εύρημα στο `subject`', async () => {
    const error = await rejectionOf(createVisibilityRule(ARIES, { ...SKU_RULE, subject: { kind: 'variant', variantId: 'cprod_ghost' } }));
    expect(error.issues).toEqual([expect.objectContaining({ code: 'unknownReference', path: 'subject' })]);
  });

  it('ξένο SKU ≡ ανύπαρκτο', async () => {
    const error = await rejectionOf(createVisibilityRule(RIVAL, SKU_RULE));
    expect(error.issues).toEqual([expect.objectContaining({ code: 'unknownReference', path: 'subject' })]);
  });

  it('ξένος χώρος δεν αλλάζει κανόνα', async () => {
    const stored = await createVisibilityRule(ARIES, CATALOG_RULE);
    expect((await rejectionOf(updateVisibilityRule(RIVAL, stored.id, stored.revision, CATALOG_RULE))).kind).toBe('notFound');
    expect((await rejectionOf(deleteVisibilityRule(RIVAL, stored.id, stored.revision))).kind).toBe('notFound');
  });

  it('ομάδα πελάτη που δεν υπάρχει ⇒ εύρημα στο κοινό', async () => {
    const error = await rejectionOf(createVisibilityRule(ARIES, { ...CATALOG_RULE, audience: { kind: 'customerGroup', customerGroupId: 'ccgrp_ghost' } }));
    expect(error.issues).toEqual([expect.objectContaining({ code: 'unknownReference', path: 'audience.customerGroupId' })]);
  });
});

describe('η κρίση μέσα στον επιλυτή', () => {
  it('χωρίς κανόνα: `hidden` δίπλα στο αποτέλεσμα', async () => {
    const result = await quoteCatalogPrice(ARIES, quote(SIGNED_IN));
    expect(result.visibility).toMatchObject({ visibility: 'hidden', ruleId: null });
  });

  it('ο ειδικότερος κανόνας του SKU νικά τον κατάλογο', async () => {
    await createVisibilityRule(ARIES, CATALOG_RULE);
    const sku = await createVisibilityRule(ARIES, SKU_RULE);
    expect((await quoteCatalogPrice(ARIES, quote(SIGNED_IN))).visibility).toMatchObject({ visibility: 'hidden', ruleId: sku.id });
  });

  it('🔒 κανόνας ΑΛΛΟΥ χώρου δεν ανοίγει τον κατάλογό μου', async () => {
    await createVisibilityRule(RIVAL, CATALOG_RULE);
    expect((await quoteCatalogPrice(ARIES, quote(SIGNED_IN))).visibility).toMatchObject({ visibility: 'hidden', ruleId: null });
  });

  it('διαγραμμένος κανόνας δεν μετρά: ο κατάλογος ξανακρύβεται', async () => {
    const stored = await createVisibilityRule(ARIES, CATALOG_RULE);
    expect((await quoteCatalogPrice(ARIES, quote(SIGNED_IN))).visibility).toMatchObject({ visibility: 'visible', ruleId: stored.id });
    await deleteVisibilityRule(ARIES, stored.id, stored.revision);
    expect((await quoteCatalogPrice(ARIES, quote(SIGNED_IN))).visibility).toMatchObject({ visibility: 'hidden', ruleId: null });
  });

  it('εργασία ΑΤΟΕ: καμία ορατότητα', async () => {
    const result = await quoteCatalogPrice(ARIES, { ...quote(SIGNED_IN), subject: { kind: 'costItem', atoeCode: 'OIK-4.01', region: null } });
    expect(result.visibility).toBeNull();
  });
});
