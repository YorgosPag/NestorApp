/**
 * ADR-923 §5.10.4 Β3/Β4 — κείμενο ⇄ τιμή ιδιότητας: ό,τι γράφει ο προμηθευτής στο Excel, round-trip για κάθε τύπο.
 */
import { MFP_ATTRIBUTE_MAP } from '../../__tests__/fixtures/mfp-fan-coil.fixture';
import { PLATFORM_MEASUREMENT_REGISTRY } from '../../measurement/measurement-registry';
import type { CatalogAttributeDefinition } from '../../types/attribute';
import type { AttributeValue } from '../../types/product';
import { displayAmount, formatAttributeValue, hasTextForm, parseAttributeText, type ValueTextContext } from '../value-text-codec';

const ctx = (language: 'el' | 'en' = 'el'): ValueTextContext => ({
  registry: PLATFORM_MEASUREMENT_REGISTRY,
  language,
  assetIdByCode: new Map([['hero', 'casst_hero'], ['plan', 'casst_plan']]),
  assetCodeById: new Map([['casst_hero', 'hero'], ['casst_plan', 'plan']]),
  yes: language === 'el' ? 'Ναι' : 'Yes',
  no: language === 'el' ? 'Όχι' : 'No',
});

const attr = (id: string): CatalogAttributeDefinition => MFP_ATTRIBUTE_MAP.get(id)!;
const base = { ...attr('model_code'), unique: false };
const of = <T extends CatalogAttributeDefinition['type']>(type: T, config: unknown) => ({ ...base, type, config }) as CatalogAttributeDefinition;
const value = (a: CatalogAttributeDefinition, text: string, c = ctx()) => {
  const parsed = parseAttributeText(a, text, c);
  return parsed.ok ? parsed.value : parsed;
};

describe('μέτρηση — όπως τη γράφει ο προμηθευτής', () => {
  const power = attr('cooling_h');
  const airflow = attr('airflow_h');

  it('«2,5 kW» · «2.5kW» · «2500 W» · σκέτος αριθμός ⇒ μονάδα προεπιλογής', () => {
    expect(value(power, '2,5 kW')).toEqual({ type: 'measurement', amount: '2.5', unitCode: 'kW' });
    expect(value(power, '2.5kW')).toEqual({ type: 'measurement', amount: '2.5', unitCode: 'kW' });
    expect(value(power, '2500 W')).toEqual({ type: 'measurement', amount: '2500', unitCode: 'W' });
    expect(value(power, '3,10')).toEqual({ type: 'measurement', amount: '3.10', unitCode: 'kW' });
  });

  it('🔴 «MW» ≠ «mW»: ακριβής αντιστοίχιση πρώτα · «m3/h» (απλό 3) ≡ «m³/h» · «BTU/h»', () => {
    expect(value(power, '1 MW')).toEqual({ type: 'measurement', amount: '1', unitCode: 'MW' });
    expect(value(airflow, '380 m3/h')).toEqual({ type: 'measurement', amount: '380', unitCode: 'm3_h' });
    expect(value(airflow, '380 m³/h')).toEqual({ type: 'measurement', amount: '380', unitCode: 'm3_h' });
    expect(value(power, '12000 BTU/h')).toMatchObject({ unitCode: 'BTU_h' });
  });

  it('άγνωστη μονάδα · μη αριθμός ⇒ εύρημα, ποτέ σιωπηλή απώλεια μονάδας', () => {
    expect(value(power, '2,5 furlong')).toEqual({ ok: false, issue: 'measurementUnitUnknown', params: { unit: '2,5 furlong' } });
    expect(value(power, 'abc kW')).toEqual({ ok: false, issue: 'valueNotNumber', params: undefined });
  });
});

describe('επιλογή · πολλαπλή · ναι/όχι · ημερομηνία · μέσο', () => {
  it('επιλογή: κωδικός ή ετικέτα, χωρίς τόνους/κεφαλαία · άγνωστη ⇒ optionUnknown', () => {
    expect(value(attr('size'), 'MFP-34')).toEqual({ type: 'select', optionCode: 'mfp_34' });
    expect(value(attr('size'), 'mfp_51')).toEqual({ type: 'select', optionCode: 'mfp_51' });
    expect(value(attr('size'), 'MFP-999')).toMatchObject({ ok: false, issue: 'optionUnknown' });
  });

  it('πολλαπλή: «;» ή αλλαγή γραμμής (όχι κόμμα: οι ετικέτες έχουν κόμματα) · χωρίς διπλά', () => {
    const multi = of('multiSelect', { ...attr('size').config, maxSelections: null });
    expect(value(multi, 'MFP-34; mfp_51\nMFP-34')).toEqual({ type: 'multiSelect', optionCodes: ['mfp_34', 'mfp_51'] });
  });

  it('ναι/όχι σε κάθε γλώσσα και ως 1/0/✓', () => {
    const bool = of('boolean', {});
    for (const yes of ['Ναι', 'ναι', 'yes', 'TRUE', '1', '✓']) expect(value(bool, yes)).toEqual({ type: 'boolean', value: true });
    for (const no of ['Όχι', 'οχι', 'No', '0']) expect(value(bool, no)).toEqual({ type: 'boolean', value: false });
    expect(value(bool, 'ίσως')).toMatchObject({ ok: false, issue: 'valueTypeMismatch' });
  });

  it('ημερομηνία: ISO ή «ηη/μμ/εεεε» · ανύπαρκτη μέρα (31/02) ⇒ invalidDate', () => {
    const date = of('date', { min: null, max: null });
    expect(value(date, '26/10/2026')).toEqual({ type: 'date', date: '2026-10-26' });
    expect(value(date, '2026-10-26')).toEqual({ type: 'date', date: '2026-10-26' });
    expect(value(date, '31/02/2026')).toEqual({ ok: false, issue: 'invalidDate', params: undefined });
  });

  it('μέσο: κωδικοί ⇄ ids · άγνωστος κωδικός ⇒ unknownReference', () => {
    const asset = of('asset', { assetKinds: ['image'], maxFiles: 5 });
    expect(value(asset, 'hero; plan')).toEqual({ type: 'asset', assetIds: ['casst_hero', 'casst_plan'] });
    expect(value(asset, 'nope')).toMatchObject({ ok: false, issue: 'unknownReference' });
  });

  it('κενό ⇒ null (η θέση σβήνεται) · αναφορά/πίνακας ΧΩΡΙΣ κειμενική μορφή', () => {
    expect(value(attr('cooling_h'), '  ')).toBeNull();
    expect(hasTextForm('reference')).toBe(false);
    expect(hasTextForm('table')).toBe(false);
    expect(hasTextForm('measurement')).toBe(true);
  });
});

describe('🔑 round-trip: format → parse = η ΙΔΙΑ τιμή, σε el και en', () => {
  const cases: ReadonlyArray<readonly [CatalogAttributeDefinition, AttributeValue]> = [
    [attr('cooling_h'), { type: 'measurement', amount: '2.50', unitCode: 'kW' }],
    [attr('cooling_h'), { type: 'measurement', amount: '-3.5', unitCode: 'W' }],
    [attr('airflow_h'), { type: 'measurement', amount: '380', unitCode: 'm3_h' }],
    [attr('size'), { type: 'select', optionCode: 'mfp_136' }],
    [attr('model_code'), { type: 'text', text: '016-15-001' }],
    [of('number', { min: null, max: null, decimals: 3, negativeAllowed: true }), { type: 'number', amount: '1200.500' }],
    [of('boolean', {}), { type: 'boolean', value: false }],
    [of('date', { min: null, max: null }), { type: 'date', date: '2026-02-28' }],
    [of('asset', { assetKinds: ['image'], maxFiles: 5 }), { type: 'asset', assetIds: ['casst_plan', 'casst_hero'] }],
  ];
  it.each(['el', 'en'] as const)('%s', (language) => {
    for (const [attribute, original] of cases) {
      const text = formatAttributeValue(attribute, original, ctx(language));
      expect(parseAttributeText(attribute, text, ctx(language))).toEqual({ ok: true, value: original });
    }
  });

  it('προβολή ποσού στη γλώσσα: «2,50» (el) · «2.50» (en) · μείον U+2212', () => {
    expect(displayAmount('2.50', 'el')).toBe('2,50');
    expect(displayAmount('2.50', 'en')).toBe('2.50');
    expect(displayAmount('-3.5', 'el')).toBe('−3,5');
  });
});
