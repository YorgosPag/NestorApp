/**
 * Οι γραφείς της τιμολόγησης (ADR-923 §5.11 «3β») πάνω στο **επαληθευμένο** ψεύτικο Firestore — από άκρη σε άκρη:
 * το fixture MFP (δύο εκδόσεις, +8%, «TOSH-CARR −50%», «50+10», −5% συνδεδεμένοι) χτίζεται **μέσα από τους
 * γραφείς**, και κάθε αναλλοίωτη δοκιμάζεται στο «επιτρέπεται» ΚΑΙ στο «απαγορεύεται».
 */

import type { Firestore } from 'firebase-admin/firestore';

import { applyDiscountSteps } from '@/lib/pricing/discount-rule';
import { generateCatalogDiscountConditionId, generateDeterministicCatalogPricingSlotId } from '@/services/enterprise-id.service';
import { conditionSlotKey } from '@/subapps/catalog/pricing/pricing-keys';
import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';
import {
  MFP_PRICE_LIST,
  MFP_V1_PRICES,
  PARTNER,
  SIMPLE_V1_PRICE,
  SIMPLE_VARIANT_ID,
  WHOLESALE_TOSH_CARR,
} from '@/subapps/catalog/__tests__/fixtures/mfp-price-list.fixture';
import { mfpVariantId } from '@/subapps/catalog/__tests__/fixtures/mfp-fan-coil-products.fixture';
import type { PriceQuoteRequest } from '@/subapps/catalog/types/price-list-requests';
import { ARIES, RIVAL, rejectionOf } from './catalog-writer-seed';
import { realCondition, seedPricing, version1Inputs, type SeededPricing } from './catalog-pricing-seed';

const fake = new FakeFirestore();
const recordTrackedEntityWrite = jest.fn(async (_input: { entityType: string }) => undefined);

jest.mock('@/lib/firebaseAdmin', () => ({ getAdminFirestore: (): Firestore => fake as unknown as Firestore }));
jest.mock('@/services/entity-audit-tracked-write', () => ({
  recordTrackedEntityWrite: (input: { entityType: string }) => recordTrackedEntityWrite(input),
}));

/* eslint-disable import/first -- τα mocks πρέπει να δηλωθούν πριν φορτωθούν οι γραφείς */
import { createDiscountCondition } from '../discount-condition-writer.server';
import { createCatalogPriceList, updateCatalogPriceList } from '../price-list-writer.server';
import { savePriceLines } from '../price-line-writer.server';
import { previewPublication, publishPriceListVersion } from '../price-publication.server';
import { quoteCatalogPrice } from '../price-quote.server';
import { createPriceListVersion, seedPriceListVersion } from '../price-version-writer.server';
import { deletePricingGroup } from '../pricing-group-writer.server';
import type { StoredPriceVersion } from '../price-version-aggregate.server';
/* eslint-enable import/first */

const V1_FROM = '2026-01-01T00:00:00.000Z';
const V2_FROM = '2026-07-01T00:00:00.000Z';
const V3_FROM = '2027-01-01T00:00:00.000Z';

beforeEach(() => {
  fake.reset();
  recordTrackedEntityWrite.mockClear();
});

/** Πρόχειρη → γραμμές → δημοσίευση χωρίς φράχτη (η πρώτη έκδοση δεν έχει βάση σύγκρισης). */
async function publishVersion1(seeded: SeededPricing): Promise<StoredPriceVersion> {
  const draft = await createPriceListVersion(ARIES, seeded.priceListId, { validFrom: V1_FROM, basedOn: 'empty' });
  const saved = await savePriceLines(ARIES, draft.id, { expectedLinesRevision: 0, upserts: version1Inputs(seeded.toshCarrId), deletes: [] });
  return publishPriceListVersion(ARIES, draft.id, { expectedRevision: draft.revision, expectedLinesRevision: saved.linesRevision, confirmedDiffDigest: null });
}

/** «Νέα έκδοση από την τρέχουσα» + αναπροσαρμογή όλων κατά `factorPercent`. */
async function draftFromCurrent(seeded: SeededPricing, validFrom: string, factorPercent: number) {
  const draft = await createPriceListVersion(ARIES, seeded.priceListId, { validFrom, basedOn: 'latestPublished' });
  const saved = await savePriceLines(ARIES, draft.id, {
    expectedLinesRevision: draft.derived.linesRevision,
    upserts: version1Inputs(seeded.toshCarrId, factorPercent),
    deletes: [],
  });
  return { draft, linesRevision: saved.linesRevision };
}

const quote = (request: Partial<PriceQuoteRequest>, variantIndex = 0): PriceQuoteRequest => ({
  viewAs: { kind: 'anonymous' },
  subject: { kind: 'variant', variantId: mfpVariantId(variantIndex) },
  quantity: 1,
  at: '2026-08-01T00:00:00.000Z',
  priceListId: null,
  ...request,
});

describe('εκδόσεις — πρόχειρη · δημοσίευση · αμετάβλητη', () => {
  it('η έκδοση 1 δημοσιεύεται με σφραγίδα: hash, πλήθος, φράχτης της λίστας, καμία επιβεβαίωση', async () => {
    const seeded = await seedPricing(fake);
    const published = await publishVersion1(seeded);
    expect(published.status).toBe('published');
    expect(published.seal).toEqual(
      expect.objectContaining({ lineCount: 8, fenceBp: 2000, fencedCount: 0, confirmedDiffDigest: null, publishedBy: ARIES.uid }),
    );
    expect(published.seal?.linesHash).toMatch(/^[0-9a-f]{16}$/);
  });

  it('⛔ γραμμή σε ΔΗΜΟΣΙΕΥΜΕΝΗ έκδοση = versionNotDraft (το αμετάβλητο ζει στον γραφέα)', async () => {
    const seeded = await seedPricing(fake);
    const published = await publishVersion1(seeded);
    const error = await rejectionOf(
      savePriceLines(ARIES, published.id, { expectedLinesRevision: published.derived.linesRevision, upserts: version1Inputs(seeded.toshCarrId, 50), deletes: [] }),
    );
    expect(error.kind).toBe('immutable');
    expect(error.issues).toEqual([{ code: 'versionNotDraft', path: 'status' }]);
  });

  it('«από την τρέχουσα»: σπορά όλων των γραμμών, ΧΩΡΙΣ ίχνος ανά γραμμή, ιδεμπότητη· +8% ⇒ η 1 γίνεται superseded', async () => {
    const seeded = await seedPricing(fake);
    const v1 = await publishVersion1(seeded);
    recordTrackedEntityWrite.mockClear();
    const draft = await createPriceListVersion(ARIES, seeded.priceListId, { validFrom: V2_FROM, basedOn: 'latestPublished' });
    expect(draft.derived.seed).toEqual({ fromVersionId: v1.id, copied: 8, cursor: expect.any(String), done: true });
    expect(recordTrackedEntityWrite.mock.calls.map(([input]) => input.entityType)).toEqual(['catalog_price_list_version']);
    const again = await seedPriceListVersion(ARIES, draft.id);
    expect(again.derived).toEqual(draft.derived);
    const saved = await savePriceLines(ARIES, draft.id, { expectedLinesRevision: draft.derived.linesRevision, upserts: version1Inputs(seeded.toshCarrId, 108), deletes: [] });
    await publishPriceListVersion(ARIES, draft.id, { expectedRevision: draft.revision, expectedLinesRevision: saved.linesRevision, confirmedDiffDigest: null });
    expect(fake.getData('catalog_price_list_versions', v1.id)).toEqual(expect.objectContaining({ status: 'superseded' }));
  });

  it('⛔ δημοσίευση με μπαγιάτικο linesRevision (γραμμή άλλαξε, χωρίς φράχτη) = revisionMismatch', async () => {
    const seeded = await seedPricing(fake);
    const draft = await createPriceListVersion(ARIES, seeded.priceListId, { validFrom: V1_FROM, basedOn: 'empty' });
    const first = await savePriceLines(ARIES, draft.id, { expectedLinesRevision: 0, upserts: version1Inputs(seeded.toshCarrId), deletes: [] });
    await savePriceLines(ARIES, draft.id, { expectedLinesRevision: first.linesRevision, upserts: version1Inputs(seeded.toshCarrId, 101), deletes: [] });
    const error = await rejectionOf(
      publishPriceListVersion(ARIES, draft.id, { expectedRevision: draft.revision, expectedLinesRevision: first.linesRevision, confirmedDiffDigest: null }),
    );
    expect(error.kind).toBe('revisionMismatch');
  });

  it('σπορά σε ΠΟΛΛΑ τμήματα: ο δρομέας προχωρά και αντιγράφονται ΟΛΕΣ οι γραμμές (401 > 400 ανά τμήμα)', async () => {
    const seeded = await seedPricing(fake);
    const draft = await createPriceListVersion(ARIES, seeded.priceListId, { validFrom: V1_FROM, basedOn: 'empty' });
    const work = (index: number) => ({
      subject: { kind: 'costItem' as const, atoeCode: `OIK-${String(index).padStart(4, '0')}`, region: null },
      netPrice: 100,
      priceQuantity: 1 as const,
      unitCode: 'm2',
      discountGroupId: null,
      breakdown: { material: 60, labor: 30, equipment: 10, defaultWasteBp: 0, materialVariantId: null },
    });
    const all = Array.from({ length: 401 }, (_, index) => work(index));
    const a = await savePriceLines(ARIES, draft.id, { expectedLinesRevision: 0, upserts: all.slice(0, 400), deletes: [] });
    const b = await savePriceLines(ARIES, draft.id, { expectedLinesRevision: a.linesRevision, upserts: all.slice(400), deletes: [] });
    await publishPriceListVersion(ARIES, draft.id, { expectedRevision: draft.revision, expectedLinesRevision: b.linesRevision, confirmedDiffDigest: null });
    const next = await createPriceListVersion(ARIES, seeded.priceListId, { validFrom: V2_FROM, basedOn: 'latestPublished' });
    expect(next.derived.seed).toEqual(expect.objectContaining({ copied: 401, done: true }));
    const copied = Object.values(fake.getAllDocs('catalog_price_list_lines')).filter((line) => line.versionId === next.id);
    expect(copied).toHaveLength(401);
  });

  it('⛔ CAS γραμμών: δέσμη με μπαγιάτικο linesRevision = revisionMismatch', async () => {
    const seeded = await seedPricing(fake);
    const draft = await createPriceListVersion(ARIES, seeded.priceListId, { validFrom: V1_FROM, basedOn: 'empty' });
    await savePriceLines(ARIES, draft.id, { expectedLinesRevision: 0, upserts: version1Inputs(seeded.toshCarrId), deletes: [] });
    const stale = await rejectionOf(savePriceLines(ARIES, draft.id, { expectedLinesRevision: 0, upserts: [], deletes: [] }));
    expect(stale.kind).toBe('revisionMismatch');
  });
});

describe('φράχτης — «επιβεβαιώνεις ό,τι είδες» (απόφαση Γ)', () => {
  async function fencedDraft() {
    const seeded = await seedPricing(fake);
    await publishVersion1(seeded);
    const { draft, linesRevision } = await draftFromCurrent(seeded, V3_FROM, 100);
    const inputs = version1Inputs(seeded.toshCarrId);
    const tenfold = await savePriceLines(ARIES, draft.id, { expectedLinesRevision: linesRevision, upserts: [{ ...inputs[0], netPrice: inputs[0].netPrice * 10 }], deletes: [] });
    return { seeded, draft, inputs, linesRevision: tenfold.linesRevision };
  }

  it('×10 σε μία γραμμή ⇒ η προεπισκόπηση φράζει ΜΙΑ και δίνει αποτύπωμα', async () => {
    const { draft } = await fencedDraft();
    const preview = await previewPublication(ARIES, draft.id);
    expect(preview.diff.fenced).toBe(1);
    expect(preview.diffDigest).toMatch(/^[0-9a-f]{16}$/);
    // Ο άνθρωπος επιβεβαιώνει ΚΩΔΙΚΟΥΣ: κάθε παραλλαγή της διαφοράς έρχεται με το αναγνωριστικό της (ίδιο `expand` με τις γραμμές).
    const variantIds = preview.diff.changes.flatMap((change) => [change.before, change.after].flatMap((line) => (line?.subject.kind === 'variant' ? [line.subject.variantId] : [])));
    expect(variantIds.length).toBeGreaterThan(0);
    expect(Object.keys(preview.skuIdentifiers).sort()).toEqual([...new Set(variantIds)].sort());
  });

  it('⛔ χωρίς επιβεβαίωση ⇒ 409 fenceConfirmationRequired · ⛔ λάθος αποτύπωμα ⇒ fenceDigestStale', async () => {
    const { draft, linesRevision } = await fencedDraft();
    const base = { expectedRevision: draft.revision, expectedLinesRevision: linesRevision };
    const missing = await rejectionOf(publishPriceListVersion(ARIES, draft.id, { ...base, confirmedDiffDigest: null }));
    expect(missing.kind).toBe('confirmationRequired');
    expect(missing.issues.map((issue) => issue.code)).toEqual(['fenceConfirmationRequired']);
    const wrong = await rejectionOf(publishPriceListVersion(ARIES, draft.id, { ...base, confirmedDiffDigest: '0123456789abcdef' }));
    expect(wrong.issues.map((issue) => issue.code)).toEqual(['fenceDigestStale']);
  });

  it('⛔ γραμμή που άλλαξε ΜΕΤΑ την προεπισκόπηση ⇒ το παλιό αποτύπωμα δεν δημοσιεύει τίποτα', async () => {
    const { draft, inputs, linesRevision } = await fencedDraft();
    const seen = await previewPublication(ARIES, draft.id);
    const later = await savePriceLines(ARIES, draft.id, { expectedLinesRevision: linesRevision, upserts: [{ ...inputs[1], netPrice: inputs[1].netPrice * 20 }], deletes: [] });
    const error = await rejectionOf(
      publishPriceListVersion(ARIES, draft.id, { expectedRevision: draft.revision, expectedLinesRevision: later.linesRevision, confirmedDiffDigest: seen.diffDigest }),
    );
    expect(error.issues.map((issue) => issue.code)).toEqual(['fenceDigestStale']);
  });

  it('✅ το σωστό αποτύπωμα δημοσιεύει και σφραγίζει ΤΙ επιβεβαιώθηκε', async () => {
    const { draft, linesRevision } = await fencedDraft();
    const preview = await previewPublication(ARIES, draft.id);
    const published = await publishPriceListVersion(ARIES, draft.id, { expectedRevision: draft.revision, expectedLinesRevision: linesRevision, confirmedDiffDigest: preview.diffDigest });
    expect(published.seal).toEqual(expect.objectContaining({ fencedCount: 1, confirmedDiffDigest: preview.diffDigest }));
  });

  it('φράχτης ΑΝΑ ΛΙΣΤΑ (απόφαση Β): με 50% το ×1,3 δεν θέλει επιβεβαίωση', async () => {
    const seeded = await seedPricing(fake);
    const list = fake.getData('catalog_price_lists', seeded.priceListId) as { revision: number };
    await updateCatalogPriceList(ARIES, seeded.priceListId, list.revision, { ...MFP_PRICE_LIST.definition, changeFenceBp: 5000 });
    await publishVersion1(seeded);
    const { draft } = await draftFromCurrent(seeded, V3_FROM, 130);
    const preview = await previewPublication(ARIES, draft.id);
    expect(preview.fenceBp).toBe(5000);
    expect(preview.diff.fenced).toBe(0);
    expect(preview.diffDigest).toBeNull();
  });
});

describe('ασάφεια = άρνηση αποθήκευσης, και υπό ταυτοχρονισμό', () => {
  it('⛔ δεύτερη συνθήκη χονδρεμπόρου «TOSH-CARR» σε επικαλυπτόμενη περίοδο', async () => {
    const seeded = await seedPricing(fake);
    const twin = realCondition({ ...WHOLESALE_TOSH_CARR.definition, rule: { kind: 'chain', steps: [4000] } }, seeded);
    const error = await rejectionOf(createDiscountCondition(ARIES, twin));
    expect(error.issues.map((issue) => issue.code)).toEqual(['discountConditionAmbiguous']);
  });

  // ⚠️ ΟΧΙ `Promise.all` δύο εγγραφών: το fake δηλώνει commit «σειριακό, όχι ατομικό» (DECLARED_DEVIATIONS) — θα
  //    μετρούσε το όριο του fake, όχι τον κώδικα (μετρήθηκε: γράφτηκαν και οι δύο). Ο ντετερμινιστικός ανταγωνιστής
  //    γράφει ό,τι θα έγραφε η ταυτόχρονη συνθήκη ΑΝΑΜΕΣΑ στην ανάγνωση και στο commit — το σενάριο της υποδοχής.
  it('⛔ ταυτόχρονη ασαφής συνθήκη που πρόλαβε μέσα στη συναλλαγή: η υποδοχή τη βλέπει και αρνείται', async () => {
    const seeded = await seedPricing(fake);
    const november = { validFrom: '2026-11-01T00:00:00.000Z', validUntil: '2026-12-01T00:00:00.000Z' };
    const promo = realCondition({ ...WHOLESALE_TOSH_CARR.definition, ...november, audience: { kind: 'signedIn' } }, seeded);
    const slotId = generateDeterministicCatalogPricingSlotId(ARIES.companyId, conditionSlotKey(promo));
    fake.interfere = () => {
      const member = { holderId: 'cdcnd_rival_promo', ...november };
      fake.write('catalog_pricing_slots', slotId, { id: slotId, companyId: ARIES.companyId, slotKey: conditionSlotKey(promo), members: [member] });
    };
    const error = await rejectionOf(createDiscountCondition(ARIES, promo));
    expect(error.issues).toEqual([{ code: 'discountConditionAmbiguous', path: 'validFrom', params: { conditionId: 'cdcnd_rival_promo' } }]);
  });

  it('✅ η ίδια περίοδος με ΑΛΛΗ ομάδα ή κοινό είναι άλλη υποδοχή — καμία ψευδής ασάφεια', async () => {
    const seeded = await seedPricing(fake);
    const november = { validFrom: '2026-11-01T00:00:00.000Z', validUntil: '2026-12-01T00:00:00.000Z' };
    const promo = realCondition({ ...WHOLESALE_TOSH_CARR.definition, ...november, audience: { kind: 'anonymous' } }, seeded);
    await expect(createDiscountCondition(ARIES, promo)).resolves.toEqual(expect.objectContaining({ validFrom: november.validFrom }));
  });

  it('✅ Γ5: το id που προ-γέννησε ο πελάτης ΚΡΑΤΙΕΤΑΙ · ⛔ ξένο πρόθεμα ή ήδη υπάρχον αρνείται', async () => {
    const seeded = await seedPricing(fake);
    const november = { validFrom: '2026-11-01T00:00:00.000Z', validUntil: '2026-12-01T00:00:00.000Z' };
    const promo = realCondition({ ...WHOLESALE_TOSH_CARR.definition, ...november, audience: { kind: 'anonymous' } }, seeded);
    const requested = generateCatalogDiscountConditionId();
    await expect(createDiscountCondition(ARIES, promo, requested)).resolves.toEqual(expect.objectContaining({ id: requested }));
    const foreign = await rejectionOf(createDiscountCondition(ARIES, { ...promo, audience: { kind: 'signedIn' } }, 'prod_not-a-condition'));
    expect(foreign.issues).toEqual([{ code: 'invalidCode', path: 'id' }]);
    const reused = await rejectionOf(createDiscountCondition(ARIES, { ...promo, audience: { kind: 'signedIn' } }, requested));
    expect(reused.kind).toBe('duplicateCode');
  });

  it('⛔ δεύτερη λίστα πώλησης για το ΙΔΙΟ κοινό · ⛔ λίστα κόστους με κοινό', async () => {
    await seedPricing(fake);
    const twin = await rejectionOf(createCatalogPriceList(ARIES, { ...MFP_PRICE_LIST.definition, code: 'gen_2' }));
    expect(twin.issues.map((issue) => issue.code)).toEqual(['priceListAudienceAmbiguous']);
    const cost = await rejectionOf(createCatalogPriceList(ARIES, { ...MFP_PRICE_LIST.definition, code: 'master', kind: 'cost' }));
    expect(cost.issues.map((issue) => issue.code)).toEqual(['costListHasAudience']);
  });
});

describe('η τιμή από τον διακομιστή — «δες σαν τον Χ» (αποφάσεις Α + Δ)', () => {
  async function twoVersions(): Promise<SeededPricing> {
    const seeded = await seedPricing(fake);
    await publishVersion1(seeded);
    const { draft, linesRevision } = await draftFromCurrent(seeded, V2_FROM, 108);
    await publishPriceListVersion(ARIES, draft.id, { expectedRevision: draft.revision, expectedLinesRevision: linesRevision, confirmedDiffDigest: null });
    return seeded;
  }
  const netOf = async (request: PriceQuoteRequest): Promise<number> => {
    const result = await quoteCatalogPrice(ARIES, request);
    if (result.kind !== 'priced') throw new Error(`expected priced, got ${result.kind}`);
    return result.quote.netAmount;
  };
  const v2Price = Math.round(MFP_V1_PRICES[0] * 1.08);

  it('χονδρέμπορος «TOSH-CARR −50%» · συνεργάτης «50+10» (ειδικότερος νικά) · ανώνυμος = τιμή λίστας', async () => {
    const seeded = await twoVersions();
    expect(await netOf(quote({ viewAs: { kind: 'customerGroup', customerGroupId: seeded.wholesaleId } }))).toBe(v2Price / 2);
    expect(await netOf(quote({ viewAs: { kind: 'partner', party: PARTNER } }))).toBe(applyDiscountSteps(v2Price, [5000, 1000]).net);
    expect(await netOf(quote({}))).toBe(v2Price);
  });

  it('επιλογή ΛΙΣΤΑΣ κατά κοινό: ο χονδρέμπορος παίρνει τη λίστα του, ο ανώνυμος τη γενική (ο ειδικότερος νικά)', async () => {
    const seeded = await twoVersions();
    const own = await createCatalogPriceList(ARIES, {
      ...MFP_PRICE_LIST.definition,
      code: 'wholesale_list',
      audience: { kind: 'customerGroup', customerGroupId: seeded.wholesaleId },
    });
    const asWholesale = await quoteCatalogPrice(ARIES, quote({ viewAs: { kind: 'customerGroup', customerGroupId: seeded.wholesaleId } }));
    expect(asWholesale).toEqual({ kind: 'noVersion', priceListId: own.id });
    const asAnonymous = await quoteCatalogPrice(ARIES, quote({}));
    expect(asAnonymous.kind === 'priced' && asAnonymous.quote.priceListId).toBe(seeded.priceListId);
  });

  it('ως προς ημερομηνία: τον Μάρτιο ισχύει η έκδοση 1', async () => {
    await twoVersions();
    expect(await netOf(quote({ at: '2026-03-01T00:00:00.000Z' }))).toBe(MFP_V1_PRICES[0]);
  });

  it('το απλό SKU χωρίς ομάδα παίρνει μόνο το «−5% σε όλα» των συνδεδεμένων', async () => {
    await twoVersions();
    const simple = quote({ viewAs: { kind: 'signedIn' }, subject: { kind: 'variant', variantId: SIMPLE_VARIANT_ID } });
    expect(await netOf(simple)).toBe(applyDiscountSteps(Math.round(SIMPLE_V1_PRICE * 1.08), [500]).net);
  });

  it('⛔ θεατής από ωμό id που δεν υπάρχει = unknownReference (ο διακομιστής χτίζει τον θεατή)', async () => {
    await twoVersions();
    const error = await rejectionOf(quoteCatalogPrice(ARIES, quote({ viewAs: { kind: 'customerGroup', customerGroupId: 'ccgrp_forged' } })));
    expect(error.issues).toEqual([{ code: 'unknownReference', path: 'viewAs.customerGroupId' }]);
  });
});

describe('σύνορα — ξένος χώρος ≡ ανύπαρκτο · χρήση · κλείδωμα σημασίας', () => {
  it('⛔ ο αντίπαλος δεν αγγίζει ούτε τιμολογεί τη λίστα της Aries', async () => {
    const seeded = await seedPricing(fake);
    expect((await rejectionOf(updateCatalogPriceList(RIVAL, seeded.priceListId, 1, MFP_PRICE_LIST.definition))).kind).toBe('notFound');
    expect((await rejectionOf(quoteCatalogPrice(RIVAL, quote({ priceListId: seeded.priceListId })))).kind).toBe('notFound');
  });

  it('⛔ ομάδα έκπτωσης σε χρήση δεν διαγράφεται', async () => {
    const seeded = await seedPricing(fake);
    const group = fake.getData('catalog_discount_groups', seeded.toshCarrId) as { revision: number };
    expect((await rejectionOf(deletePricingGroup(ARIES, 'discountGroup', seeded.toshCarrId, group.revision))).kind).toBe('inUse');
  });

  it('⛔ ο τύπος τιμής κλειδώνει μόλις υπάρξει έκδοση (αλλιώς οι δημοσιευμένες τιμές αλλάζουν σημασία)', async () => {
    const seeded = await seedPricing(fake);
    await publishVersion1(seeded);
    const list = fake.getData('catalog_price_lists', seeded.priceListId) as { revision: number };
    const error = await rejectionOf(updateCatalogPriceList(ARIES, seeded.priceListId, list.revision, { ...MFP_PRICE_LIST.definition, priceType: 'net_customer' }));
    expect(error.issues).toEqual([{ code: 'typeLockedInUse', path: 'priceType' }]);
  });
});
