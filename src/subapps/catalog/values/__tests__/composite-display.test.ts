/**
 * ADR-923 §21.6 — η σύνθετη ένδειξη «Ηλεκτρική παροχή» = «1~ 230 V 50 Hz» (IEC 61293 §4.2.5 · §4.3.1), από τρεις δομημένες ιδιότητες.
 */
import { MFP_ATTRIBUTE_MAP } from '../../__tests__/fixtures/mfp-fan-coil.fixture';
import { PLATFORM_MEASUREMENT_REGISTRY } from '../../measurement/measurement-registry';
import type { CatalogAttributeDefinition } from '../../types/attribute';
import type { CompositeDisplay } from '../../types/family';
import type { AttributeValue } from '../../types/product';
import { COMPOSITE_MISSING_MARK, composeDisplay, type CompositeSource } from '../composite-display';
import type { ValueTextContext } from '../value-text-codec';

const codec = (language: 'el' | 'en' = 'el'): ValueTextContext => ({
  registry: PLATFORM_MEASUREMENT_REGISTRY,
  language,
  assetIdByCode: new Map(),
  assetCodeById: new Map(),
  yes: 'Ναι',
  no: 'Όχι',
});

const weight = MFP_ATTRIBUTE_MAP.get('weight')!;
const voltage = { ...weight, code: 'connection_voltage', type: 'measurement', config: { measurementFamilyCode: 'voltage', defaultUnitCode: 'V', min: 0, max: null, decimals: 0, negativeAllowed: false } } as CatalogAttributeDefinition;
const frequency = {
  ...weight, code: 'supply_frequency', type: 'select',
  config: { options: [{ code: 'hz_50', labels: { el: '50 Hz', en: '50 Hz' } }, { code: 'hz_50_60', labels: { el: '50/60 Hz', en: '50/60 Hz' } }] },
} as CatalogAttributeDefinition;
const phases = { ...weight, code: 'phases', type: 'number', config: { min: 1, max: 3, decimals: 0, negativeAllowed: false } } as CatalogAttributeDefinition;
const power = MFP_ATTRIBUTE_MAP.get('cooling_h')!;

const attributeById = new Map<string, CatalogAttributeDefinition>([['phases', phases], ['voltage', voltage], ['frequency', frequency], ['power', power]]);

const SUPPLY: CompositeDisplay = {
  id: 'cd_supply',
  labels: { el: 'Ηλεκτρική παροχή', en: 'Power supply' },
  separator: ' ',
  parts: [
    { attributeId: 'phases', displayUnitCode: null, affix: { before: '', after: '~' } },
    { attributeId: 'voltage', displayUnitCode: null, affix: { before: '', after: '' } },
    { attributeId: 'frequency', displayUnitCode: null, affix: { before: '', after: '' } },
  ],
};

const FULL: Record<string, AttributeValue> = {
  phases: { type: 'number', amount: '1' },
  voltage: { type: 'measurement', amount: '230', unitCode: 'V' },
  frequency: { type: 'select', optionCode: 'hz_50' },
};

const source = (values: Record<string, AttributeValue>, language: 'el' | 'en' = 'el'): CompositeSource =>
  ({ attributeById, valueOf: (id) => values[id], codec: codec(language) });
const dash = () => COMPOSITE_MISSING_MARK;

describe('§21.6 σύνθετη ένδειξη', () => {
  it('IEC 61293: «1~ 230 V 50 Hz» — σύστημα παροχής πρώτα, αριθμός ␣ σύμβολο μονάδας', () => {
    expect(composeDisplay(SUPPLY, source(FULL), dash)).toEqual({ text: '1~ 230 V 50 Hz', missingAttributeIds: [] });
  });

  it('μονάδα προβολής: 0,4 kV, με υποδιαστολή της γλώσσας (el «,» · en «.»)', () => {
    const kv: CompositeDisplay = { ...SUPPLY, parts: [{ attributeId: 'voltage', displayUnitCode: 'kV', affix: { before: '', after: '' } }] };
    const values = { voltage: { type: 'measurement', amount: '400', unitCode: 'V' } as AttributeValue };
    const decimalVoltage = new Map(attributeById).set('voltage', { ...voltage, config: { ...voltage.config, decimals: 1 } } as CatalogAttributeDefinition);
    expect(composeDisplay(kv, { ...source(values), attributeById: decimalVoltage }, dash).text).toBe('0,4 kV');
    expect(composeDisplay(kv, { ...source(values, 'en'), attributeById: decimalVoltage }, dash).text).toBe('0.4 kV');
  });

  it('🔑 μέρος που λείπει ΔΕΝ συμπτύσσεται: «1~ 230 V —», και ο καλών μαθαίνει ποιο λείπει', () => {
    const { frequency: _omit, ...partial } = FULL;
    expect(composeDisplay(SUPPLY, source(partial), dash)).toEqual({ text: '1~ 230 V —', missingAttributeIds: ['frequency'] });
  });

  it('ο επεξεργαστής ονομάζει την ιδιότητα που λείπει — χωρίς τα σύμβολα του μέρους («~» δεν κολλά σε κενό)', () => {
    const { phases: _omit, ...partial } = FULL;
    expect(composeDisplay(SUPPLY, source(partial), (id) => `[${id}]`).text).toBe('[phases] 230 V 50 Hz');
  });

  it('λείπουν όλα ⇒ κενή ένδειξη, όπως κάθε κενό κελί (όχι «— — —»)', () => {
    expect(composeDisplay(SUPPLY, source({}), dash)).toEqual({ text: '', missingAttributeIds: ['phases', 'voltage', 'frequency'] });
  });

  it('ιδιότητα που δεν υπάρχει στη βιβλιοθήκη μετρά ως κενό, ποτέ επινοημένο κείμενο', () => {
    const ghost: CompositeDisplay = { ...SUPPLY, parts: [...SUPPLY.parts, { attributeId: 'ghost', displayUnitCode: null, affix: { before: '', after: '' } }] };
    expect(composeDisplay(ghost, source(FULL), dash)).toEqual({ text: '1~ 230 V 50 Hz —', missingAttributeIds: ['ghost'] });
  });

  it('διαχωριστής της δήλωσης (Revit «Electrical Connector Separator»): «230 V / 50 Hz»', () => {
    const slash: CompositeDisplay = { ...SUPPLY, separator: ' / ', parts: SUPPLY.parts.slice(1) };
    expect(composeDisplay(slash, source(FULL), dash).text).toBe('230 V / 50 Hz');
  });
});
