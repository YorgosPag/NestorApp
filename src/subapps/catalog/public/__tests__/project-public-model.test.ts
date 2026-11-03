/**
 * Η δημόσια προβολή (ADR-923 §5.13 Σ2): τι βγαίνει προς τον ανώνυμο, και κυρίως τι δεν βγαίνει ποτέ.
 */

import { MFP_ATTRIBUTE_MAP, MFP_FAMILY } from '../../__tests__/fixtures/mfp-fan-coil.fixture';
import { MFP_MODEL_ID, MFP_VARIANTS, mfpChain, mfpVariantId } from '../../__tests__/fixtures/mfp-fan-coil-products.fixture';
import type { StoredVisibilityRule } from '../../pricing/visibility';
import type { CatalogAttributeDefinition } from '../../types/attribute';
import type { CatalogFamilyDefinition } from '../../types/family';
import type { CatalogProductDefinition, ValueSlots } from '../../types/product';
import type { VisibilitySubject } from '../../types/visibility-rule';
import type { CatalogVisibility } from '../../vocabulary/pricing';
import { publicCatalogModelFromDocument } from '../public-catalog-from-document';
import type { PublicCatalogAttribute, PublicCatalogMedia, PublicCatalogModel } from '../public-catalog-schema';
import { projectPublicModel, publicAttributeIdsOf, type PublicProjectionInput } from '../project-public-model';

const NOW = Date.UTC(2026, 10, 2);
const SCHEME = MFP_FAMILY.variantSchemes[0];
const HERO: PublicCatalogMedia = { assetId: 'cas_mfp_hero', url: 'https://cdn.test/hero.webp', labels: { el: 'MFP' } };

const rule = (id: string, subject: VisibilitySubject, visibility: CatalogVisibility, audience: StoredVisibilityRule['audience'] = { kind: 'anonymous' }): StoredVisibilityRule =>
  ({ id, subject, audience, visibility });
const OPEN = rule('open', { kind: 'catalog' }, 'visible');
const hideVariant = (index: number) => rule(`hide_${index}`, { kind: 'variant', variantId: mfpVariantId(index) }, 'hidden');

const projected = (index: number, variant: CatalogProductDefinition = MFP_VARIANTS[index]) => ({
  id: mfpVariantId(index),
  code: `099-01-00${index + 1}`,
  label: `099-01-00${index + 1}`,
  chain: mfpChain(variant, index),
  ancestry: { variantId: mfpVariantId(index), modelIds: [MFP_MODEL_ID], categoryDepths: {} },
});

const inputWith = (over: Partial<PublicProjectionInput> = {}): PublicProjectionInput => ({
  companyId: 'comp_a',
  rootId: MFP_MODEL_ID,
  kind: 'productModel',
  code: 'mfp_tm',
  familyId: 'fan_coil',
  schema: { family: MFP_FAMILY, attributes: MFP_ATTRIBUTE_MAP, scheme: SCHEME },
  locales: ['el', 'en'],
  categoryLabels: new Map(),
  variants: MFP_VARIANTS.map((variant, index) => projected(index, variant)),
  rules: [OPEN],
  atMs: NOW,
  media: new Map([[HERO.assetId, HERO]]),
  ...over,
});

const project = (over: Partial<PublicProjectionInput> = {}): PublicCatalogModel => {
  const model = projectPublicModel(inputWith(over));
  if (model === null) throw new Error('expected a public model');
  return model;
};

const row = (rows: readonly PublicCatalogAttribute[], attributeId: string) => rows.find((candidate) => candidate.attributeId === attributeId);

function keysOf(value: unknown): readonly string[] {
  if (Array.isArray(value)) return value.flatMap(keysOf);
  if (value === null || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, child]) => [key, ...keysOf(child)]);
}

describe('το είδος καταχώρισης (§22)', () => {
  it('παλιά οικογένεια χωρίς πεδίο ⇒ `product` · υπηρεσία ⇒ `service`', () => {
    expect(project().listingKind).toBe('product');
    const schema = { family: { ...MFP_FAMILY, listingKind: 'service' as const }, attributes: MFP_ATTRIBUTE_MAP, scheme: SCHEME };
    expect(project({ schema }).listingKind).toBe('service');
  });
});

describe('ποιος μπαίνει', () => {
  it('χωρίς κανόνα ⇒ null: η προεπιλογή είναι `hidden`', () => {
    expect(projectPublicModel(inputWith({ rules: [] }))).toBeNull();
  });

  it('κανόνας μόνο για συνδεδεμένους ⇒ null: ο ανώνυμος δεν βλέπει τίποτα', () => {
    expect(projectPublicModel(inputWith({ rules: [rule('signed', { kind: 'catalog' }, 'visible', { kind: 'signedIn' })] }))).toBeNull();
  });

  it('`visibleNoPrice` μπαίνει: το προϊόν φαίνεται, η τιμή κρίνεται αλλού', () => {
    expect(project({ rules: [rule('open', { kind: 'catalog' }, 'visibleNoPrice')] }).variants).toHaveLength(7);
  });

  it('κρυφό SKU ⇒ λείπει, χωρίς ίχνος στο έγγραφο', () => {
    const model = project({ rules: [OPEN, hideVariant(2)] });
    expect(model.variants.map((variant) => variant.variantId)).not.toContain(mfpVariantId(2));
    expect(model.variants).toHaveLength(6);
    expect(JSON.stringify(model)).not.toContain(mfpVariantId(2));
  });

  it('όλα τα SKU κρυφά ⇒ null, ίδιο με το ανύπαρκτο', () => {
    expect(projectPublicModel(inputWith({ rules: [OPEN, ...MFP_VARIANTS.map((_, index) => hideVariant(index))] }))).toBeNull();
  });

  it('η κατηγορία κρυφού SKU δεν διαρρέει', () => {
    const secret = { ...MFP_VARIANTS[1], categoryIds: ['cat_secret'] };
    const open = { ...MFP_VARIANTS[0], categoryIds: ['cat_open'] };
    const categoryLabels = new Map([['cat_open', { el: 'Ανοιχτή' }], ['cat_secret', { el: 'Κρυφή' }]]);
    const model = project({ categoryLabels, rules: [OPEN, hideVariant(1)], variants: [projected(0, open), projected(1, secret)] });
    expect(model.categoryIds).toContain('cat_open');
    expect(model.categoryIds).not.toContain('cat_secret');
    expect(model.categoryLabels).toEqual({ cat_open: { el: 'Ανοιχτή' } });
  });

  it('κατηγορία χωρίς ενεργή εγγραφή δεν βγάζει κενό όνομα', () => {
    const open = { ...MFP_VARIANTS[0], categoryIds: ['cat_gone'] };
    expect(project({ variants: [projected(0, open)] }).categoryLabels).toEqual({});
  });
});

describe('ποια ιδιότητα βγαίνει', () => {
  const NOTE = 'internal_note';
  const noteAttribute = { ...MFP_ATTRIBUTE_MAP.get('power_supply'), code: NOTE } as CatalogAttributeDefinition;
  const familyWith = (requiredChannels: CatalogFamilyDefinition['attributes'][number]['requiredChannels']): CatalogFamilyDefinition => ({
    ...MFP_FAMILY,
    attributes: [...MFP_FAMILY.attributes, { attributeId: NOTE, requiredChannels }],
  });
  const noted: CatalogProductDefinition = { ...MFP_VARIANTS[0], values: { ...MFP_VARIANTS[0].values, [NOTE]: { '*': { '*': { type: 'text', text: 'κρυφό σημείωμα' } } } } };
  const withNote = (family: CatalogFamilyDefinition) => project({
    schema: { family, attributes: new Map([...MFP_ATTRIBUTE_MAP, [NOTE, noteAttribute]]), scheme: { ...SCHEME, levels: [{ ...SCHEME.levels[0], attributeIds: [...SCHEME.levels[0].attributeIds, NOTE] }] } },
    variants: [projected(0, noted)],
  });

  it('🔒 ιδιότητα χωρίς δήλωση `storefront` δεν βγαίνει, ακόμη κι αν έχει τιμή', () => {
    expect(publicAttributeIdsOf(familyWith(['print']))).not.toContain(NOTE);
    expect(JSON.stringify(withNote(familyWith(['print'])))).not.toContain('κρυφό σημείωμα');
  });

  it('ιδιότητα δηλωμένη για `storefront` βγαίνει', () => {
    expect(JSON.stringify(withNote(familyWith(['storefront'])))).toContain('κρυφό σημείωμα');
  });

  it('ο άξονας βγαίνει και χωρίς δήλωση: χωρίς αυτόν οι παραλλαγές δεν ξεχωρίζουν', () => {
    const family = { ...MFP_FAMILY, attributes: MFP_FAMILY.attributes.map((binding) => (binding.attributeId === 'size' ? { ...binding, requiredChannels: [] } : binding)) };
    expect(publicAttributeIdsOf(family)).toContain('size');
  });

  it('η ιδιότητα της ρίζας μένει στο μοντέλο, του SKU στο SKU', () => {
    const model = project();
    expect(row(model.attributes, 'power_supply')).toBeDefined();
    expect(row(model.variants[0].attributes, 'power_supply')).toBeUndefined();
    expect(row(model.attributes, 'size')).toBeUndefined();
    expect(row(model.variants[0].attributes, 'size')?.values.el).toEqual(expect.objectContaining({ type: 'option' }));
  });
});

describe('ανά γλώσσα και κανάλι', () => {
  const DESCRIPTION = 'description';

  it('κάθε γλώσσα παίρνει τη δική της τιμή, και γλώσσα εκτός βιτρίνας δεν βγαίνει', () => {
    const both = row(project().attributes, DESCRIPTION);
    expect(both?.values.el).toEqual(expect.objectContaining({ type: 'richText', html: expect.stringContaining('δαπέδου') }));
    expect(both?.values.en).toEqual(expect.objectContaining({ type: 'richText', html: expect.stringContaining('Floor-standing') }));
    const onlyGreek = row(project({ locales: ['el'] }).attributes, DESCRIPTION);
    expect(onlyGreek?.values.en).toBeUndefined();
  });

  it('🔒 ανά κανάλι: η τιμή `print` δεν βγαίνει, η `storefront` βγαίνει', () => {
    const scopable = 'note_scoped';
    const attribute = { ...MFP_ATTRIBUTE_MAP.get('power_supply'), code: scopable, scopable: true } as CatalogAttributeDefinition;
    const family: CatalogFamilyDefinition = { ...MFP_FAMILY, attributes: [{ attributeId: scopable, requiredChannels: ['storefront'] }] };
    const slots: ValueSlots = { print: { '*': { type: 'text', text: 'μόνο χαρτί' } }, storefront: { '*': { type: 'text', text: 'για βιτρίνα' } } };
    const variant = { ...MFP_VARIANTS[0], values: { [scopable]: slots } };
    const model = project({
      schema: { family, attributes: new Map([[scopable, attribute]]), scheme: { ...SCHEME, levels: [{ ...SCHEME.levels[0], attributeIds: [scopable] }] } },
      variants: [projected(0, variant)],
    });
    expect(JSON.stringify(model)).toContain('για βιτρίνα');
    expect(JSON.stringify(model)).not.toContain('μόνο χαρτί');
  });
});

describe('τύποι που δεν δημοσιεύονται ποτέ', () => {
  const OWNED = 'odd';
  const asType = (type: 'table' | 'reference') => ({ ...MFP_ATTRIBUTE_MAP.get('power_supply'), code: OWNED, type }) as unknown as CatalogAttributeDefinition;
  const family: CatalogFamilyDefinition = { ...MFP_FAMILY, attributes: [{ attributeId: OWNED, requiredChannels: ['storefront'] }] };
  const levels = [{ ...SCHEME.levels[0], attributeIds: [OWNED] }];
  const withValue = (attribute: CatalogAttributeDefinition, slots: ValueSlots) => project({
    schema: { family, attributes: new Map([[OWNED, attribute]]), scheme: { ...SCHEME, levels } },
    variants: [projected(0, { ...MFP_VARIANTS[0], values: { [OWNED]: slots } })],
  });

  it('🔒 πίνακας: μπορεί να κρατά στήλη τιμής', () => {
    const model = withValue(asType('table'), { '*': { '*': { type: 'table', rows: [{ price: '100' }] } } });
    expect(model.variants[0].attributes).toEqual([]);
  });

  it('🔒 αναφορά: μπορεί να δείχνει κρυφό προϊόν', () => {
    const model = withValue(asType('reference'), { '*': { '*': { type: 'reference', targets: [{ kind: 'product', id: 'cpr_secret' }] } } });
    expect(JSON.stringify(model)).not.toContain('cpr_secret');
  });

  it('κενή τιμή δεν γίνεται γραμμή', () => {
    const model = withValue(MFP_ATTRIBUTE_MAP.get('power_supply') as CatalogAttributeDefinition, { '*': { '*': { type: 'text', text: '  ' } } });
    expect(model.variants[0].attributes).toEqual([]);
  });

  it('τιμή άλλου τύπου από την ιδιότητα δεν βγαίνει', () => {
    const model = withValue(MFP_ATTRIBUTE_MAP.get('power_supply') as CatalogAttributeDefinition, { '*': { '*': { type: 'number', amount: '5' } } });
    expect(model.variants[0].attributes).toEqual([]);
  });
});

describe('μέσα', () => {
  it('🔒 μέσο εκτός ελεγμένου χάρτη δεν δημοσιεύεται', () => {
    expect(project({ media: new Map() }).media).toEqual([]);
  });

  it('το ελεγμένο μέσο βγαίνει μία φορά, ακόμη κι αν το δείχνουν δύο γλώσσες', () => {
    expect(project().media).toEqual([HERO]);
  });
});

describe('🔒 το δημόσιο έγγραφο είναι κλειστό (Ε4)', () => {
  const FORBIDDEN = /amount|price|cost|discount|currency|margin|audience|partner|relationship|derived|searchText|searchPrefixes|taxFingerprint|gemi/i;

  it('κανένα κλειδί ποσού, κοινού, έκπτωσης, σχέσης ή παραγώγου, σε κανένα βάθος', () => {
    expect(keysOf(project()).filter((key) => FORBIDDEN.test(key))).toEqual([]);
  });

  it('ο έλεγχος πιάνει πραγματικά το απαγορευμένο κλειδί, σε βάθος', () => {
    expect(keysOf({ variants: [{ attributes: [{ values: { el: { amount: '1' } } }] }] }).some((key) => FORBIDDEN.test(key))).toBe(true);
  });

  it('η προβολή περνά το ίδιο της το σύνορο ανάγνωσης', () => {
    const model = project();
    expect(publicCatalogModelFromDocument(JSON.parse(JSON.stringify(model)), MFP_MODEL_ID)).toEqual(model);
  });
});
