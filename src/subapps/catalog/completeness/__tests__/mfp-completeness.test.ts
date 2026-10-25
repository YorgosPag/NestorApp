import { MFP_ATTRIBUTE_MAP, MFP_FAMILY } from '../../__tests__/fixtures/mfp-fan-coil.fixture';
import {
  MFP_MODEL,
  MFP_MODEL_ID,
  MFP_SETTINGS,
  MFP_VARIANTS,
  mfpChain,
  mfpVariantId,
} from '../../__tests__/fixtures/mfp-fan-coil-products.fixture';
import type { CatalogProductDefinition } from '../../types/product';
import { resolveInheritedValues } from '../../values/resolve-inherited';
import { completeChannelKeys, completenessPercent, computeCompleteness, summarizeCompleteness } from '../compute-completeness';
import { completenessInputsHash, isCompletenessStale } from '../inputs-hash';

const scheme = MFP_FAMILY.variantSchemes[0];

const completenessOf = (variant: CatalogProductDefinition, index = 0, model = MFP_MODEL) =>
  computeCompleteness({
    family: MFP_FAMILY,
    attributes: MFP_ATTRIBUTE_MAP,
    settings: MFP_SETTINGS,
    resolved: resolveInheritedValues(
      [{ id: MFP_MODEL_ID, kind: 'productModel', revision: 1, holder: model }, { id: mfpVariantId(index), kind: 'product', revision: 1, holder: variant }],
      scheme,
    ),
  });

describe('resolveInheritedValues — τιμή ΚΑΙ ιδιοκτήτης', () => {
  const resolved = resolveInheritedValues(mfpChain(MFP_VARIANTS[0], 0), scheme);

  it('η παραλλαγή «έχει» 18 τιμές: 14 δικές της + 4 του μοντέλου', () => {
    expect(resolved.values.size).toBe(18);
    expect(resolved.values.get('cooling_h')?.owner).toEqual({ id: mfpVariantId(0), kind: 'product', depth: 1 });
    expect(resolved.values.get('description')?.owner).toEqual({ id: MFP_MODEL_ID, kind: 'productModel', depth: 0 });
    expect(resolved.misplaced).toEqual([]);
  });

  it('κατηγορίες: ένωση κατά μήκος της αλυσίδας', () => {
    const variant = { ...MFP_VARIANTS[0], categoryIds: ['cat_floor', 'cat_fan_coils'] };
    expect(resolveInheritedValues(mfpChain(variant, 0), scheme).categoryIds).toEqual(['cat_fan_coils', 'cat_floor']);
  });

  it('🔴 τιμή σε λάθος επίπεδο ΔΕΝ σκιάζει την αληθινή — αγνοείται ΚΑΙ αναφέρεται', () => {
    const model = { ...MFP_MODEL, values: { ...MFP_MODEL.values, cooling_h: { '*': { '*': { type: 'measurement' as const, amount: '1', unitCode: 'W' } } } } };
    const chain = mfpChain(MFP_VARIANTS[0], 0);
    const result = resolveInheritedValues([{ ...chain[0], holder: model }, chain[1]], scheme);
    expect(result.values.get('cooling_h')?.owner.kind).toBe('product');
    expect(result.misplaced).toEqual([{ attributeId: 'cooling_h', holderId: MFP_MODEL_ID, ownerDepth: 1 }]);
  });
});

describe('πληρότητα MFP × 7 — κανάλι × γλώσσα (Δ7)', () => {
  it('Έντυπο/el: 100% για ΚΑΙ τις 7 παραλλαγές (η περιγραφή/φωτογραφία δεν ζητούνται στο έντυπο)', () => {
    MFP_VARIANTS.forEach((variant, index) => {
      const cell = completenessOf(variant, index).print.el;
      expect(cell).toEqual({ required: 16, filled: 16, missing: [] });
    });
  });

  it('Βιτρίνα/en: πλήρες — η αγγλική περιγραφή του μοντέλου κληρονομείται', () => {
    expect(completenessOf(MFP_VARIANTS[0]).storefront.en).toEqual({ required: 18, filled: 18, missing: [] });
  });

  it('χωρίς αγγλική περιγραφή: Βιτρίνα/en ελλιπής, Βιτρίνα/el πλήρης, Έντυπο ανεπηρέαστο', () => {
    const greekOnly = { '*': { el: { type: 'richText' as const, html: '<p>Fan coil δαπέδου.</p>' } } };
    const matrix = completenessOf(MFP_VARIANTS[0], 0, { ...MFP_MODEL, values: { ...MFP_MODEL.values, description: greekOnly } });
    expect(matrix.storefront.en?.missing).toEqual([{ attributeId: 'description', cause: 'empty' }]);
    expect(completenessPercent(matrix.storefront.en!)).toBe(94);
    expect(matrix.storefront.el?.missing).toEqual([]);
    expect(completeChannelKeys(matrix)).toEqual(['print:el', 'storefront:el', 'portal:el', 'quote:el']);
  });

  it('ETIM: «δεν εφαρμόζεται» = πλήρες · «άγνωστο» = ελλιπές ΜΕ αιτία (≠ «ξεχάστηκε»)', () => {
    const { weight: _w, dimensions: _d, ...values } = MFP_VARIANTS[0].values;
    const variant = { ...MFP_VARIANTS[0], values, noValueReasons: { weight: 'notApplicable' as const, dimensions: 'unknown' as const } };
    expect(completenessOf(variant).print.el?.missing).toEqual([{ attributeId: 'dimensions', cause: 'unknown' }]);
  });

  it('περίληψη μοντέλου: «πλήρεις 6/7» όταν σε μία λείπει τιμή', () => {
    const matrices = MFP_VARIANTS.map((variant, index) => {
      if (index !== 3) return completenessOf(variant, index);
      const { airflow_m: _a, ...values } = variant.values;
      return completenessOf({ ...variant, values }, index);
    });
    expect(summarizeCompleteness(matrices, MFP_SETTINGS).print.el).toEqual({ complete: 6, total: 7 });
    expect(summarizeCompleteness(matrices, MFP_SETTINGS).storefront.en).toEqual({ complete: 6, total: 7 });
  });
});

describe('αποτύπωμα εισόδων — η μπαγιατίλα ΑΠΟΔΕΙΚΝΥΕΤΑΙ', () => {
  const input = {
    family: MFP_FAMILY,
    attributes: MFP_ATTRIBUTE_MAP,
    settings: MFP_SETTINGS,
    scheme,
    chain: mfpChain(MFP_VARIANTS[0], 0),
  };
  const hash = completenessInputsHash(input);

  it('ντετερμινιστικό και με έκδοση μηχανής', () => {
    expect(hash).toMatch(/^c1:[0-9a-f]{16}$/);
    expect(completenessInputsHash({ ...input })).toBe(hash);
    expect(isCompletenessStale(hash, input)).toBe(false);
    expect(isCompletenessStale(null, input)).toBe(true);
  });

  it.each([
    ['νέα απαίτηση καναλιού', { family: { ...MFP_FAMILY, attributes: MFP_FAMILY.attributes.map((b) => (b.attributeId === 'photo' ? { ...b, requiredChannels: ['print' as const, 'storefront' as const] } : b)) } }],
    ['νέα γλώσσα στο κανάλι', { settings: { channelLocales: { ...MFP_SETTINGS.channelLocales, print: ['el' as const, 'en' as const] } } }],
    ['αλλαγή στο μοντέλο (αναθεώρηση προγόνου)', { chain: mfpChain(MFP_VARIANTS[0], 0, { model: 2, product: 1 }) }],
    ['η ιδιότητα έγινε ανά κανάλι', { attributes: new Map([...MFP_ATTRIBUTE_MAP, ['weight', { ...MFP_ATTRIBUTE_MAP.get('weight')!, scopable: true }]]) }],
  ])('🔴 μπαγιάτικο μετά από: %s', (_, change) => {
    expect(isCompletenessStale(hash, { ...input, ...change })).toBe(true);
  });

  it('✅ ΟΧΙ μπαγιάτικο μετά από μετονομασία οικογένειας ή αλλαγή κανόνων (ίδιο αποτέλεσμα, καμία εργασία)', () => {
    const renamed = { ...MFP_FAMILY, labels: { el: 'Άλλο όνομα' }, consistencyRules: [] };
    expect(isCompletenessStale(hash, { ...input, family: renamed })).toBe(false);
  });
});
