import { PLATFORM_MEASUREMENT_REGISTRY } from '../../measurement/measurement-registry';
import { MFP_ATTRIBUTE_MAP, MFP_FAMILY } from '../../__tests__/fixtures/mfp-fan-coil.fixture';
import {
  MFP_ASSETS,
  MFP_MODEL,
  MFP_SETTINGS,
  MFP_VARIANTS,
  mfpVariant,
} from '../../__tests__/fixtures/mfp-fan-coil-products.fixture';
import type { CatalogProductDefinition, CatalogValueHolder, ValueSlots } from '../../types/product';
import type { CatalogIssueCode } from '../catalog-issues';
import type { ProductValuesContext } from '../product-validation-context';
import { validateHolderValues } from '../validate-product-values';
import { checkDescendantBudget, placeProduct, placeProductModel } from '../validate-product-placement';
import { attributeValueSchema, catalogSettingsSchema, productDefinitionSchema, productModelDefinitionSchema } from '../zod/product.schema';

const scheme = MFP_FAMILY.variantSchemes[0];

const context = (depth: number, overrides: Partial<ProductValuesContext> = {}): ProductValuesContext => ({
  family: MFP_FAMILY,
  attributes: MFP_ATTRIBUTE_MAP,
  registry: PLATFORM_MEASUREMENT_REGISTRY,
  settings: MFP_SETTINGS,
  scheme,
  depth,
  assets: MFP_ASSETS,
  categories: new Set(['cat_fan_coils']),
  references: new Map(),
  ...overrides,
});

const codes = (holder: CatalogValueHolder, depth: number, overrides?: Partial<ProductValuesContext>): CatalogIssueCode[] =>
  validateHolderValues(holder, context(depth, overrides)).map((issue) => issue.code);

const withValues = (variant: CatalogProductDefinition, values: Record<string, ValueSlots>): CatalogProductDefinition => ({
  ...variant,
  values: { ...variant.values, ...values },
});

const one = (value: ValueSlots['*']): ValueSlots => ({ '*': value });

describe('MFP × 7 — οι πραγματικές τιμές της σελ. 60 περνούν ΚΑΘΑΡΕΣ', () => {
  it('το μοντέλο (κοινές τιμές, βάθος 0)', () => {
    expect(validateHolderValues(MFP_MODEL, context(0))).toEqual([]);
  });

  it.each(MFP_VARIANTS.map((variant, index) => [index, variant] as const))('παραλλαγή %p (βάθος 1)', (_, variant) => {
    expect(validateHolderValues(variant, context(1))).toEqual([]);
  });

  it('τοποθέτηση: μοντέλο-ρίζα βάθος 0, SKU κάτω από ρίζα σε σχήμα 1 επιπέδου ⇒ βάθος 1', () => {
    expect(placeProductModel(MFP_MODEL, null, MFP_FAMILY)).toEqual({ issues: [], placement: { scheme, depth: 0 } });
    expect(placeProduct(MFP_VARIANTS[0], MFP_MODEL, MFP_FAMILY)).toEqual({ issues: [], placement: { scheme, depth: 1 } });
  });

  it('το zod διασχίζει μοντέλο και παραλλαγές ΑΜΕΤΑΒΛΗΤΑ', () => {
    expect(productModelDefinitionSchema.parse(MFP_MODEL)).toEqual(MFP_MODEL);
    MFP_VARIANTS.forEach((variant) => expect(productDefinitionSchema.parse(variant)).toEqual(variant));
    expect(catalogSettingsSchema.parse(MFP_SETTINGS)).toEqual(MFP_SETTINGS);
  });
});

describe('αυστηρή κληρονομιά (Δ1): κάθε ιδιότητα σε ΕΝΑ επίπεδο', () => {
  it('🔴 τιμή μεγέθους πάνω στο μοντέλο ⇒ λάθος επίπεδο (καμία υπέρβαση)', () => {
    const model = { ...MFP_MODEL, values: { ...MFP_MODEL.values, cooling_h: MFP_VARIANTS[0].values.cooling_h } };
    expect(codes(model, 0)).toEqual(['valueWrongLevel']);
  });

  it('🔴 κοινή τιμή πάνω στην παραλλαγή ⇒ λάθος επίπεδο', () => {
    expect(codes(withValues(MFP_VARIANTS[0], { power_supply: MFP_MODEL.values.power_supply }), 1)).toEqual(['valueWrongLevel']);
  });

  it('ιδιότητα εκτός οικογένειας ⇒ attributeUnknown', () => {
    expect(codes(withValues(MFP_VARIANTS[0], { stranger: MFP_MODEL.values.power_supply }), 1)).toEqual(['attributeUnknown']);
  });

  it('παραλλαγή χωρίς τιμή άξονα ⇒ axisValueMissing', () => {
    const { size: _size, ...rest } = MFP_VARIANTS[0].values;
    expect(codes({ ...MFP_VARIANTS[0], values: rest }, 1)).toEqual(['axisValueMissing']);
  });
});

describe('θέσεις κανάλι × γλώσσα', () => {
  it('μη localizable ιδιότητα με γλώσσα ⇒ valueLocaleSlotInvalid', () => {
    const variant = withValues(MFP_VARIANTS[0], { dimensions: one({ el: { type: 'text', text: '858x596x250' } }) });
    expect(codes(variant, 1)).toEqual(['valueLocaleSlotInvalid']);
  });

  it('μη scopable ιδιότητα σε κανάλι ⇒ valueChannelSlotInvalid', () => {
    const variant = withValues(MFP_VARIANTS[0], { dimensions: { print: { '*': { type: 'text', text: 'x' } } } });
    expect(codes(variant, 1)).toEqual(['valueChannelSlotInvalid']);
  });

  it('localizable σε γλώσσα που ΔΕΝ είναι ενεργή σε κανένα κανάλι ⇒ localeNotEnabled', () => {
    const settings = { channelLocales: { ...MFP_SETTINGS.channelLocales, storefront: ['el' as const] } };
    expect(codes(MFP_MODEL, 0, { settings })).toEqual(['localeNotEnabled']);
  });

  it('localizable χωρίς γλώσσα (στο `*`) ⇒ valueLocaleSlotInvalid', () => {
    const model = { ...MFP_MODEL, values: { ...MFP_MODEL.values, description: one({ '*': { type: 'richText', html: '<p>x</p>' } }) } };
    expect(codes(model, 0)).toEqual(['valueLocaleSlotInvalid']);
  });
});

describe('η ίδια η τιμή', () => {
  const variant = MFP_VARIANTS[0];
  const measure = (amount: string, unitCode: string): ValueSlots => one({ '*': { type: 'measurement', amount, unitCode } });

  it.each<[string, ValueSlots, CatalogIssueCode]>([
    ['τύπος', one({ '*': { type: 'number', amount: '1' } }), 'valueTypeMismatch'],
    ['μη κανονικό ποσό («2,50»)', measure('2,50', 'kW'), 'valueNotNumber'],
    ['άγνωστη μονάδα', measure('2.5', 'hp'), 'measurementUnitUnknown'],
    ['πολλά δεκαδικά (2 επιτρέπονται στα kW)', measure('2.505', 'kW'), 'valueTooManyDecimals'],
    ['αρνητικό', measure('-2', 'kW'), 'valueNegative'],
    ['κενό κείμενο', one({ '*': { type: 'text', text: ' ' } }), 'valueEmpty'],
  ])('%s', (_, slots, expected) => {
    const attribute = expected === 'valueTypeMismatch' || expected === 'valueEmpty' ? 'dimensions' : 'cooling_h';
    expect(codes(withValues(variant, { [attribute]: slots }), 1)).toEqual([expected]);
  });

  it('τα όρια κρίνονται στη ΜΟΝΑΔΑ ΠΡΟΒΟΛΗΣ: 41 dB(A) με max 40 ⇒ εκτός, 1800 W με min 0 kW ⇒ εντός', () => {
    const attributes = new Map(MFP_ATTRIBUTE_MAP);
    const sound = MFP_ATTRIBUTE_MAP.get('sound_pressure');
    if (sound?.type !== 'measurement') throw new Error('fixture');
    attributes.set('sound_pressure', { ...sound, config: { ...sound.config, max: 40 } });
    expect(codes(MFP_VARIANTS[2], 1, { attributes })).toEqual(['valueOutOfRange']);
    expect(codes(MFP_VARIANTS[0], 1, { attributes })).toEqual([]);
  });

  it('επιλογή που δεν υπάρχει ⇒ optionUnknown', () => {
    expect(codes(withValues(variant, { size: one({ '*': { type: 'select', optionCode: 'mfp_999' } }) }), 1)).toEqual(['optionUnknown']);
  });

  it('μέσο που δεν υπάρχει / λάθος είδος', () => {
    const photo = (assetId: string) => ({ ...MFP_MODEL, values: { ...MFP_MODEL.values, photo: one({ '*': { type: 'asset', assetIds: [assetId] } }) } });
    expect(codes(photo('cas_missing'), 0)).toEqual(['unknownReference']);
    expect(codes(photo('cas_pdf'), 0, { assets: new Map([['cas_pdf', { kind: 'document' }]]) })).toEqual(['assetKindNotAllowed']);
  });
});

describe('ό,τι θέλει ανάγνωση — ο γραφέας το δίνει στο πλαίσιο (Φάση 2β)', () => {
  const inCategory = (categoryIds: string[]): CatalogValueHolder => ({ ...MFP_MODEL, categoryIds });

  it('κατηγορία που δεν υπάρχει (ή είναι ξένη/διαγραμμένη) ⇒ unknownReference', () => {
    expect(codes(inCategory(['cat_fan_coils']), 0)).toEqual([]);
    expect(codes(inCategory(['cat_fan_coils', 'cat_gone']), 0)).toEqual(['unknownReference']);
  });

  const accessory = {
    ...(MFP_ATTRIBUTE_MAP.get('power_supply') as NonNullable<ReturnType<typeof MFP_ATTRIBUTE_MAP.get>>),
    code: 'accessory',
    type: 'reference' as const,
    config: { relation: 'accessory' as const, targetFamilyCodes: ['valves'], maxReferences: null },
  };
  const withAccessory = (overrides: Partial<ProductValuesContext>) => ({
    family: { ...MFP_FAMILY, attributes: [...MFP_FAMILY.attributes, { attributeId: 'accessory', requiredChannels: [] }] },
    attributes: new Map([...MFP_ATTRIBUTE_MAP, ['accessory', accessory]]),
    ...overrides,
  });
  const pointingTo = (id: string): CatalogValueHolder => ({
    ...MFP_MODEL,
    values: { ...MFP_MODEL.values, accessory: one({ '*': { type: 'reference', targets: [{ kind: 'product', id }] } }) },
  });

  it('στόχος αναφοράς: υπάρχει ⇒ ✅ · δεν υπάρχει ⇒ unknownReference · άλλη οικογένεια ⇒ referenceFamilyNotAllowed', () => {
    const references = new Map([['product:cprod_valve', { familyCode: 'valves' }], ['product:cprod_pump', { familyCode: 'pumps' }]]);
    expect(codes(pointingTo('cprod_valve'), 0, withAccessory({ references }))).toEqual([]);
    expect(codes(pointingTo('cprod_missing'), 0, withAccessory({ references }))).toEqual(['unknownReference']);
    expect(codes(pointingTo('cprod_pump'), 0, withAccessory({ references }))).toEqual(['referenceFamilyNotAllowed']);
  });

  it('`richText` εκτός γραμματικής ⇒ richTextUnsafe (απόρριψη, όχι καθάρισμα)', () => {
    const description = (html: string): CatalogValueHolder => ({
      ...MFP_MODEL,
      values: { ...MFP_MODEL.values, description: { '*': { el: { type: 'richText', html } } } },
    });
    expect(codes(description('<p>Σωστό <strong>κείμενο</strong></p>'), 0)).toEqual([]);
    expect(codes(description('<p onclick="x()">κακό</p>'), 0)).toEqual(['richTextUnsafe']);
  });
});

describe('ρητή απουσία (Δ5)', () => {
  it('«δεν εφαρμόζεται» σε κανονική ιδιότητα περνά', () => {
    const { weight: _weight, ...values } = MFP_VARIANTS[0].values;
    expect(codes({ ...MFP_VARIANTS[0], values, noValueReasons: { weight: 'notApplicable' } }, 1)).toEqual([]);
  });

  it('🔴 λόγος ΜΑΖΙ με τιμή ⇒ noValueConflict· σε άξονα ⇒ noValueOnAxis', () => {
    expect(codes({ ...MFP_VARIANTS[0], noValueReasons: { weight: 'unknown' } }, 1)).toEqual(['noValueConflict']);
    expect(codes({ ...MFP_VARIANTS[0], noValueReasons: { size: 'unknown' } }, 1)).toEqual(['noValueOnAxis', 'noValueConflict']);
  });
});

describe('τοποθέτηση και όρια', () => {
  it('SKU με άλλη οικογένεια από το μοντέλο ⇒ familyMismatch', () => {
    expect(placeProduct({ ...MFP_VARIANTS[0], familyId: 'other' }, MFP_MODEL, MFP_FAMILY).issues.map((i) => i.code)).toEqual(['familyMismatch']);
  });

  it('υπο-μοντέλο σε σχήμα 1 επιπέδου ⇒ modelHierarchyInvalid, χωρίς τοποθέτηση', () => {
    const result = placeProductModel({ ...MFP_MODEL, code: 'mfp_sub', parentId: 'cpm_mfp' }, MFP_MODEL, MFP_FAMILY);
    expect(result.issues.map((i) => i.code)).toEqual(['modelHierarchyInvalid']);
    expect(result.placement).toBeNull();
  });

  it('άγνωστο σχήμα ⇒ variantSchemeUnknown', () => {
    expect(placeProductModel({ ...MFP_MODEL, variantSchemeCode: 'nope' }, null, MFP_FAMILY).issues.map((i) => i.code))
      .toEqual(['variantSchemeUnknown']);
  });

  it('απλό προϊόν (χωρίς μοντέλο) κατέχει τα πάντα σε βάθος 0', () => {
    const simple = { ...mfpVariant(0), modelId: null, values: { ...mfpVariant(0).values, ...MFP_MODEL.values } };
    expect(placeProduct(simple, null, MFP_FAMILY).placement).toEqual({ scheme: null, depth: 0 });
    expect(codes(simple, 0, { scheme: null })).toEqual([]);
  });

  it('απόγονοι ανά μοντέλο ≤ 200 (μία συναλλαγή)', () => {
    expect(checkDescendantBudget(193, 7)).toEqual([]);
    expect(checkDescendantBudget(194, 7).map((i) => i.code)).toEqual(['tooManyDescendants']);
  });

  it('zod: κλειδί καναλιού εκτός ρίζας απορρίπτεται στη δομή', () => {
    expect(productDefinitionSchema.safeParse({ ...MFP_VARIANTS[0], values: { size: { web: { '*': { type: 'boolean', value: true } } } } }).success)
      .toBe(false);
    expect(attributeValueSchema.safeParse({ type: 'select', optionCode: 'Not A Code' }).success).toBe(false);
  });
});
