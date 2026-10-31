/**
 * Οι γραφείς των ΔΕΔΟΜΕΝΩΝ του καταλόγου (ADR-923 §5.10 · Φάση 2β) πάνω στο **επαληθευμένο** ψεύτικο Firestore
 * (ίδιο συμβόλαιο με τον emulator). Από άκρη σε άκρη: το MFP με τις 7 παραλλαγές της σελ. 60 χτίζεται μέσα από τους
 * γραφείς, και κάθε αναλλοίωτη δοκιμάζεται στο «επιτρέπεται» ΚΑΙ στο «απαγορεύεται» — με **ανταγωνιστή** ανάμεσα
 * σε ανάγνωση και commit, όπου μετρά.
 */

import type { Firestore } from 'firebase-admin/firestore';

import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';
import type { CatalogProductDefinition } from '@/subapps/catalog/types/product';
import type { StoredCatalogProductDefinition, StoredCatalogProductModelDefinition } from '@/subapps/catalog/types/product-derived';
import { MFP_ATTRIBUTES } from '@/subapps/catalog/__tests__/fixtures/mfp-fan-coil.fixture';
import {
  AI_SHIFTED_HEATING,
  ARIES_DUPLICATE_CODE,
  MFP_MODEL,
  MFP_SETTINGS,
  MFP_VARIANTS,
  mfpVariant,
} from '@/subapps/catalog/__tests__/fixtures/mfp-fan-coil-products.fixture';
import {
  ARIES,
  MFP_GROUP_CODES,
  RIVAL,
  SEED_RIGHTS,
  mfpFamilyWith,
  mfpModelWith,
  mfpProductWith,
  rejectionOf,
  type IdMap,
} from './catalog-writer-seed';

const fake = new FakeFirestore();
const recordTrackedEntityWrite = jest.fn(async (_input: { entityType: string; entityId: string; before: unknown; after: unknown }) => undefined);

jest.mock('@/lib/firebaseAdmin', () => ({ getAdminFirestore: (): Firestore => fake as unknown as Firestore }));
jest.mock('@/services/entity-audit-tracked-write', () => ({
  recordTrackedEntityWrite: (input: { entityType: string; entityId: string; before: unknown; after: unknown }) => recordTrackedEntityWrite(input),
}));

/* eslint-disable import/first -- τα mocks πρέπει να δηλωθούν πριν φορτωθούν οι γραφείς */
import { createCatalogAttributeGroup } from '../attribute-group-writer.server';
import { createCatalogAttribute, updateCatalogAttribute } from '../attribute-writer.server';
import { createCatalogCategory } from '../category-writer.server';
import { createCatalogFamily, deleteCatalogFamily, updateCatalogFamily } from '../family-writer.server';
import { createCatalogAsset, deleteCatalogAsset } from '../asset-writer.server';
import { saveCatalogSettings } from '../catalog-settings-writer.server';
import { createCatalogProductModel, deleteCatalogProductModel, updateCatalogProductModel } from '../product-model-writer.server';
import { createCatalogProduct, deleteCatalogProduct, saveCatalogVariants, updateCatalogProduct } from '../product-writer.server';
import { recomputeCatalogDerived } from '../completeness-recompute.server';
/* eslint-enable import/first */

type Model = StoredCatalogProductModelDefinition & { id: string; revision: number };
type Product = StoredCatalogProductDefinition & { id: string; revision: number };

interface Seeded {
  readonly ids: IdMap;
  readonly familyId: string;
}

/** Η βιβλιοθήκη, η οικογένεια, η κατηγορία, το μέσο και οι ρυθμίσεις του MFP — όλα μέσα από τους γραφείς. */
async function seedMfp(): Promise<Seeded> {
  const ids = new Map<string, string>();
  const groups = new Map<string, string>();
  for (const code of MFP_GROUP_CODES) {
    groups.set(code, (await createCatalogAttributeGroup(ARIES, { code, labels: { el: code }, orderKey: 'a0' })).id);
  }
  for (const attribute of MFP_ATTRIBUTES) {
    ids.set(attribute.code, (await createCatalogAttribute(ARIES, { ...attribute, groupId: groups.get(attribute.groupId) ?? '' })).id);
  }
  const family = await createCatalogFamily(ARIES, mfpFamilyWith(ids));
  ids.set('fan_coil', family.id);
  const category = await createCatalogCategory(ARIES, { code: 'fan_coils', labels: { el: 'Fan coils' }, parentId: null, orderKey: 'a0', mappings: { atoeCode: null } });
  ids.set('cat_fan_coils', category.id);
  const asset = await createCatalogAsset(ARIES, { code: 'mfp_hero', role: 'photo', kind: 'image', labels: { el: 'MFP' }, description: {}, rights: SEED_RIGHTS });
  ids.set('cas_mfp_hero', asset.id);
  await saveCatalogSettings(ARIES, 0, MFP_SETTINGS);
  return { ids, familyId: family.id };
}

const variantsOf = (seeded: Seeded, modelId: string, variants: readonly CatalogProductDefinition[] = MFP_VARIANTS) =>
  variants.map((variant) => ({ id: null, expectedRevision: null, definition: mfpProductWith(variant, seeded.ids, modelId) }));

/** Το MFP ολόκληρο: μοντέλο + δέσμη 7 παραλλαγών. */
async function seedMfpWithVariants() {
  const seeded = await seedMfp();
  const model = await createCatalogProductModel(ARIES, mfpModelWith(MFP_MODEL, seeded.ids));
  const batch = await saveCatalogVariants(ARIES, model.id, { upserts: variantsOf(seeded, model.id), deletes: [] });
  return { seeded, model: batch.model as Model, variants: batch.variants as Product[] };
}

const codeAttributeId = (seeded: Seeded) => seeded.ids.get('model_code') ?? '';
const reservations = () => Object.values(fake.getAllDocs('catalog_unique_values'));

beforeEach(() => {
  fake.reset();
  recordTrackedEntityWrite.mockClear();
});

describe('κριτήριο εξόδου — το MFP με 7 παραλλαγές, από τους γραφείς', () => {
  it('μοντέλο + δέσμη ⇒ ευρετήριο, περίληψη 7/7, κρατήσεις, παράγωγα, ίχνος ανά εγγραφή', async () => {
    const { seeded, model, variants } = await seedMfpWithVariants();
    expect(variants).toHaveLength(7);
    expect(Object.keys(model.derived.descendants)).toHaveLength(7);
    expect(model.derived.summary?.print.el).toEqual({ complete: 7, total: 7 });
    expect(model.derived.summary?.storefront.en).toEqual({ complete: 7, total: 7 });
    expect(model.derived.findings).toEqual([]);
    expect(reservations().map((r) => r.uniqueKey).sort()).toEqual(variants.map((v) => v.derived.uniqueKeys[codeAttributeId(seeded)]).sort());
    expect(variants[0].derived).toEqual(expect.objectContaining({ rootModelId: model.id, label: '099-01-001', completeChannels: expect.arrayContaining(['print:el', 'storefront:en']) }));
    expect(model.derived.assetIds).toEqual([seeded.ids.get('cas_mfp_hero')]);
    const productTraces = recordTrackedEntityWrite.mock.calls.filter(([input]) => input.entityType === 'catalog_product');
    expect(productTraces).toHaveLength(7);
  });

  it('ιστορικό ΑΝΑ ΙΔΙΟΤΗΤΑ: η τιμή γράφεται ως συλλογή `{attributeId, slots}`, όχι ως ένα JSON του χάρτη', async () => {
    const { variants } = await seedMfpWithVariants();
    const trace = recordTrackedEntityWrite.mock.calls.find(([input]) => input.entityId === variants[0].id)?.[0];
    expect(Array.isArray((trace?.after as { values: unknown }).values)).toBe(true);
    expect((trace?.after as { values: Array<{ attributeId: string }> }).values.length).toBe(Object.keys(variants[0].values).length);
  });
});

describe('κρατήσεις μοναδικότητας (Δ3)', () => {
  const twins = () => [0, 1].map((index) => mfpVariant(index, { code: [ARIES_DUPLICATE_CODE, ARIES_DUPLICATE_CODE] }));

  it('⛔ ο διπλός 016-15-001 μέσα στην ΙΔΙΑ δέσμη — τον πιάνει ΠΡΩΤΑ ο κανόνας της οικογένειας (κανόνες πριν από κρατήσεις)', async () => {
    const seeded = await seedMfp();
    const model = await createCatalogProductModel(ARIES, mfpModelWith(MFP_MODEL, seeded.ids));
    const error = await rejectionOf(saveCatalogVariants(ARIES, model.id, { upserts: variantsOf(seeded, model.id, twins()), deletes: [] }));
    expect(new Set(error.issues.map((issue) => issue.params?.ruleId))).toEqual(new Set(['rule_unique_code']));
    expect(reservations()).toEqual([]);
  });

  it('⛔ … και χωρίς κανόνα οικογένειας, τον πιάνει η ΚΡΑΤΗΣΗ (η μοναδικότητα δεν εξαρτάται από το αν κάποιος έγραψε κανόνα)', async () => {
    const seeded = await seedMfp();
    const family = fake.getData('catalog_families', seeded.familyId) as ReturnType<typeof mfpFamilyWith> & { revision: number };
    const withoutUniqueRule = { ...family, consistencyRules: family.consistencyRules.filter((rule) => rule.kind !== 'unique') };
    await updateCatalogFamily(ARIES, seeded.familyId, family.revision, withoutUniqueRule);
    const model = await createCatalogProductModel(ARIES, mfpModelWith(MFP_MODEL, seeded.ids));
    const error = await rejectionOf(saveCatalogVariants(ARIES, model.id, { upserts: variantsOf(seeded, model.id, twins()), deletes: [] }));
    expect(error.issues.map((issue) => issue.code)).toEqual(['uniqueValueTaken']);
    expect(reservations()).toEqual([]);
  });

  it('⛔ ο ίδιος κωδικός σε ΑΛΛΟ προϊόν (απλό) — «016–15–001» με en dash είναι ο ίδιος', async () => {
    const { seeded } = await seedMfpWithVariants();
    const lone = mfpProductWith(mfpVariant(0, { code: ['099–01–001'] }), seeded.ids, null);
    const error = await rejectionOf(createCatalogProduct(ARIES, { ...lone, values: { [codeAttributeId(seeded)]: lone.values[codeAttributeId(seeded)] } }));
    expect(error.issues.map((issue) => issue.code)).toEqual(['uniqueValueTaken']);
  });

  it('✅ ανταλλαγή κωδικών ανάμεσα σε δύο παραλλαγές στην ΙΔΙΑ δέσμη', async () => {
    const { seeded, model, variants } = await seedMfpWithVariants();
    const attr = codeAttributeId(seeded);
    const [a, b] = variants;
    const swapped = await saveCatalogVariants(ARIES, model.id, {
      upserts: [
        { id: a.id, expectedRevision: a.revision, definition: { ...a, values: { ...a.values, [attr]: b.values[attr] } } },
        { id: b.id, expectedRevision: b.revision, definition: { ...b, values: { ...b.values, [attr]: a.values[attr] } } },
      ],
      deletes: [],
    });
    expect(swapped.variants.map((v) => (v as Product).derived.label)).toEqual(['099-01-002', '099-01-001']);
    expect(reservations()).toHaveLength(7);
  });

  it('✅ διαγραφή απελευθερώνει τον κωδικό — νέο προϊόν τον ξαναπαίρνει', async () => {
    const { seeded, variants } = await seedMfpWithVariants();
    await deleteCatalogProduct(ARIES, variants[0].id, variants[0].revision);
    expect(reservations()).toHaveLength(6);
    const lone = mfpProductWith(mfpVariant(0), seeded.ids, null);
    const attr = codeAttributeId(seeded);
    const created = await createCatalogProduct(ARIES, { ...lone, values: { [attr]: lone.values[attr] } });
    expect(created.derived.uniqueKeys[attr]).toBe('099-01-001');
  });
});

describe('κανόνες συνέπειας ανά μοντέλο (Δ8)', () => {
  it('⛔ η θέρμανση H/M του gpt-4o ⇒ 422 ανά κελί, ΚΑΙ στις 7 παραλλαγές', async () => {
    const seeded = await seedMfp();
    const model = await createCatalogProductModel(ARIES, mfpModelWith(MFP_MODEL, seeded.ids));
    const shifted = MFP_VARIANTS.map((_, index) => mfpVariant(index, AI_SHIFTED_HEATING));
    const error = await rejectionOf(saveCatalogVariants(ARIES, model.id, { upserts: variantsOf(seeded, model.id, shifted), deletes: [] }));
    expect(error.kind).toBe('invalid');
    const variantsHit = new Set(error.issues.filter((i) => i.code === 'consistencyRuleViolated').map((i) => i.path.split('.')[1]));
    expect(variantsHit.size).toBe(7);
  });

  it('⛔ δύο παραλλαγές με το ΙΔΙΟ μέγεθος ⇒ axisComboDuplicate', async () => {
    const { seeded, model } = await seedMfpWithVariants();
    const again = mfpProductWith(mfpVariant(0, { code: ['099-99-001'] }), seeded.ids, model.id);
    const error = await rejectionOf(createCatalogProduct(ARIES, again));
    expect(error.issues.map((issue) => issue.code)).toEqual(['axisComboDuplicate']);
  });
});

describe('ταυτοχρονισμός και παράγωγα', () => {
  it('ο συνάδελφος πρόλαβε ΑΝΑΜΕΣΑ στην ανάγνωση και στο commit ⇒ CAS αρνείται, καμία κράτηση δεν άλλαξε', async () => {
    const { seeded, variants } = await seedMfpWithVariants();
    const target = variants[2];
    const before = JSON.stringify(reservations());
    fake.interfere = () => fake.write('catalog_products', target.id, { ...fake.getData('catalog_products', target.id), revision: target.revision + 1 });
    const attr = codeAttributeId(seeded);
    const next = { ...target, values: { ...target.values, [attr]: { '*': { '*': { type: 'text' as const, text: '099-77-003' } } } } };
    const error = await rejectionOf(updateCatalogProduct(ARIES, target.id, target.revision, next));
    expect(error.kind).toBe('revisionMismatch');
    expect(JSON.stringify(reservations())).toBe(before);
  });

  it('αλλαγή της ΡΙΖΑΣ ⇒ οι 7 παραλλαγές ξαναϋπολογίζονται ΧΩΡΙΣ αναθεώρηση και ΧΩΡΙΣ ίχνος (stageDerived)', async () => {
    const { seeded, model, variants } = await seedMfpWithVariants();
    recordTrackedEntityWrite.mockClear();
    const description = seeded.ids.get('description') ?? '';
    const withoutEnglish = { ...model, values: { ...model.values, [description]: { '*': { el: model.values[description]['*']?.el } } } };
    const updated = (await updateCatalogProductModel(ARIES, model.id, model.revision, mfpModelWith(withoutEnglish as typeof MFP_MODEL, seeded.ids))) as Model;
    expect(updated.derived.summary?.storefront.en).toEqual({ complete: 0, total: 7 });
    const reread = fake.getData('catalog_products', variants[0].id) as Product;
    expect(reread.revision).toBe(variants[0].revision);
    expect(reread.derived.completeChannels).not.toContain('storefront:en');
    expect(recordTrackedEntityWrite.mock.calls.map(([input]) => input.entityType)).toEqual(['catalog_product_model']);
  });

  it('διαγραφή μοντέλου ⇒ καταρράκτης στις παραλλαγές + απελευθέρωση όλων των κρατήσεων', async () => {
    const { model } = await seedMfpWithVariants();
    await deleteCatalogProductModel(ARIES, model.id, model.revision);
    const products = Object.values(fake.getAllDocs('catalog_products')) as Product[];
    expect(products.every((product) => product.isDeleted)).toBe(true);
    expect(reservations()).toEqual([]);
  });

  it('ξένος χώρος ≡ ανύπαρκτος', async () => {
    const { variants } = await seedMfpWithVariants();
    const error = await rejectionOf(deleteCatalogProduct(RIVAL, variants[0].id, variants[0].revision));
    expect(error.kind).toBe('notFound');
  });
});

describe('σκληρύνσεις σχήματος με προϊόντα (Θωράκιση 2–3)', () => {
  /** Η οικογένεια όπως είναι, με το (μοναδικό) επίπεδο του `by_size` αλλαγμένο από `edit`. */
  const familyWithLevel = (seeded: Seeded, edit: (level: { axisAttributeIds: string[]; attributeIds: string[] }) => object) => {
    const family = fake.getData('catalog_families', seeded.familyId) as ReturnType<typeof mfpFamilyWith> & { revision: number };
    const variantSchemes = family.variantSchemes.map((scheme) => ({
      ...scheme,
      levels: scheme.levels.map((level) => edit({ axisAttributeIds: [...level.axisAttributeIds], attributeIds: [...level.attributeIds] })),
    }));
    return { family, next: { ...family, variantSchemes } as ReturnType<typeof mfpFamilyWith> };
  };

  it('⛔ δεύτερος άξονας σε σχήμα που χρησιμοποιείται (έγκυρη οικογένεια, αλλά οι παραλλαγές θα άλλαζαν ταυτότητα)', async () => {
    const { seeded } = await seedMfpWithVariants();
    const sound = seeded.ids.get('sound_pressure') ?? '';
    const { family, next } = familyWithLevel(seeded, (level) => ({
      axisAttributeIds: [...level.axisAttributeIds, sound],
      attributeIds: level.attributeIds.filter((id) => id !== sound),
    }));
    const error = await rejectionOf(updateCatalogFamily(ARIES, seeded.familyId, family.revision, next));
    expect(error.kind).toBe('inUse');
    expect(error.issues.map((i) => i.code)).toEqual(['variantSchemeLockedInUse']);
  });

  it('⛔ μετακίνηση ιδιότητας ΜΕ ΤΙΜΕΣ από το επίπεδο στο κοινό · ⛔ διαγραφή οικογένειας με προϊόντα', async () => {
    const { seeded } = await seedMfpWithVariants();
    const weight = seeded.ids.get('weight') ?? '';
    const { family, next } = familyWithLevel(seeded, (level) => ({ ...level, attributeIds: level.attributeIds.filter((id) => id !== weight) }));
    const moved = await rejectionOf(updateCatalogFamily(ARIES, seeded.familyId, family.revision, next));
    expect(moved.issues).toEqual([{ code: 'attributeLevelLockedInUse', path: 'variantSchemes[0]', params: { attributeId: weight } }]);
    expect((await rejectionOf(deleteCatalogFamily(ARIES, seeded.familyId, family.revision))).kind).toBe('inUse');
  });

  it('⛔ αλλαγή είδους καταχώρισης σε οικογένεια με προϊόντα (§22 Υ2) · το ίδιο είδος περνά', async () => {
    const { seeded } = await seedMfpWithVariants();
    const family = fake.getData('catalog_families', seeded.familyId) as ReturnType<typeof mfpFamilyWith> & { revision: number };
    const error = await rejectionOf(updateCatalogFamily(ARIES, seeded.familyId, family.revision, { ...family, listingKind: 'service' }));
    expect(error.kind).toBe('inUse');
    expect(error.issues).toEqual([{ code: 'listingKindLockedInUse', path: 'listingKind' }]);
    await expect(updateCatalogFamily(ARIES, seeded.familyId, family.revision, { ...family, listingKind: 'product' })).resolves.toBeDefined();
  });

  it('⛔ `scopable` σε ιδιότητα με τιμές · ⛔ αφαίρεση επιλογής σε χρήση', async () => {
    const { seeded } = await seedMfpWithVariants();
    const weightId = seeded.ids.get('weight') ?? '';
    const weight = fake.getData('catalog_attributes', weightId) as (typeof MFP_ATTRIBUTES)[number] & { revision: number };
    const flipped = await rejectionOf(updateCatalogAttribute(ARIES, weightId, weight.revision, { ...weight, scopable: true }));
    expect(flipped.issues).toEqual([{ code: 'attributeFlagLockedInUse', path: 'scopable' }]);
    const sizeId = seeded.ids.get('size') ?? '';
    const size = fake.getData('catalog_attributes', sizeId) as Extract<(typeof MFP_ATTRIBUTES)[number], { type: 'select' }> & { revision: number };
    const trimmed = { ...size, config: { ...size.config, options: size.config.options.slice(1) } };
    expect((await rejectionOf(updateCatalogAttribute(ARIES, sizeId, size.revision, trimmed))).issues.map((i) => i.code)).toContain('optionLockedInUse');
  });

  it('⛔ αφαίρεση γλώσσας σε χρήση από τις ρυθμίσεις · ⛔ διαγραφή μέσου σε χρήση', async () => {
    const { seeded } = await seedMfpWithVariants();
    const error = await rejectionOf(saveCatalogSettings(ARIES, 1, { channelLocales: { ...MFP_SETTINGS.channelLocales, storefront: ['el'] } }));
    expect(error.issues).toEqual([{ code: 'localeLockedInUse', path: 'channelLocales', params: { locale: 'en' } }]);
    const assetId = seeded.ids.get('cas_mfp_hero') ?? '';
    expect((await rejectionOf(deleteCatalogAsset(ARIES, assetId, 1))).kind).toBe('inUse');
  });
});

describe('εργασία επανυπολογισμού (Δ7)', () => {
  it('ρυθμίσεις αλλάζουν ⇒ η εργασία διορθώνει τα παράγωγα· δεύτερη εκτέλεση = μηδέν εγγραφές', async () => {
    const { model } = await seedMfpWithVariants();
    await saveCatalogSettings(ARIES, 1, { channelLocales: { ...MFP_SETTINGS.channelLocales, print: ['el', 'en'] } });
    let cursor: string | null = null;
    do {
      cursor = (await recomputeCatalogDerived(ARIES, { familyId: null, cursor })).nextCursor;
    } while (cursor !== null);
    // Οι υποχρεωτικές του εντύπου δεν είναι localizable ⇒ πλήρεις και στα αγγλικά — η περίληψη τα ΒΛΕΠΕΙ πλέον.
    expect((fake.getData('catalog_product_models', model.id) as Model).derived.summary?.print.en).toEqual({ complete: 7, total: 7 });
    fake.clearWriteLog();
    cursor = null;
    do {
      cursor = (await recomputeCatalogDerived(ARIES, { familyId: null, cursor })).nextCursor;
    } while (cursor !== null);
    expect(fake.writeLog()).toEqual([]);
  });
});
