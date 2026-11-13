/**
 * Η «Ηλεκτρική παροχή» του fan coil (ADR-923 §21.6 · IEC 61293): τρεις δομημένες ιδιότητες (φάσεις · τάση · συχνότητα) και η
 * σύνθετη ένδειξή τους «1~ 230 V 50 Hz». Κοινό fixture για σύνθεση, πίνακα, κάρτες και επεξεργαστή.
 */
import { PLATFORM_MEASUREMENT_REGISTRY } from '../../measurement/measurement-registry';
import type { CatalogAttributeDefinition } from '../../types/attribute';
import type { CompositeDisplay } from '../../types/family';
import type { AttributeValue } from '../../types/product';
import type { ValueTextContext } from '../../values/value-text-codec';
import { MFP_ATTRIBUTE_MAP } from './mfp-fan-coil.fixture';

export const supplyCodec = (language: 'el' | 'en' = 'el'): ValueTextContext => ({
  registry: PLATFORM_MEASUREMENT_REGISTRY,
  language,
  assetIdByCode: new Map(),
  assetCodeById: new Map(),
  yes: 'Ναι',
  no: 'Όχι',
});

const weight = MFP_ATTRIBUTE_MAP.get('weight')!;
export const VOLTAGE = { ...weight, code: 'connection_voltage', labels: { el: 'Τάση', en: 'Voltage' }, type: 'measurement', config: { measurementFamilyCode: 'voltage', defaultUnitCode: 'V', min: 0, max: null, decimals: 0, negativeAllowed: false } } as CatalogAttributeDefinition;
export const FREQUENCY = {
  ...weight, code: 'supply_frequency', labels: { el: 'Συχνότητα', en: 'Frequency' }, type: 'select',
  config: { options: [{ code: 'hz_50', labels: { el: '50 Hz', en: '50 Hz' } }, { code: 'hz_50_60', labels: { el: '50/60 Hz', en: '50/60 Hz' } }] },
} as CatalogAttributeDefinition;
export const PHASES = { ...weight, code: 'phases', labels: { el: 'Φάσεις', en: 'Phases' }, type: 'number', config: { min: 1, max: 3, decimals: 0, negativeAllowed: false } } as CatalogAttributeDefinition;

/** id ιδιότητας → ορισμός (με `id`, όπως τα δέχεται ο πίνακας). */
export const SUPPLY_ATTRIBUTES = new Map<string, CatalogAttributeDefinition & { readonly id: string }>([
  ['phases', { ...PHASES, id: 'phases' }],
  ['voltage', { ...VOLTAGE, id: 'voltage' }],
  ['frequency', { ...FREQUENCY, id: 'frequency' }],
  ['weight', { ...weight, id: 'weight' }],
]);

export const SUPPLY: CompositeDisplay = {
  id: 'cd_supply',
  labels: { el: 'Ηλεκτρική παροχή', en: 'Power supply' },
  separator: ' ',
  parts: [
    { attributeId: 'phases', displayUnitCode: null, affix: { before: '', after: '~' } },
    { attributeId: 'voltage', displayUnitCode: null, affix: { before: '', after: '' } },
    { attributeId: 'frequency', displayUnitCode: null, affix: { before: '', after: '' } },
  ],
};

export const FULL_SUPPLY: Readonly<Record<string, AttributeValue>> = {
  phases: { type: 'number', amount: '1' },
  voltage: { type: 'measurement', amount: '230', unitCode: 'V' },
  frequency: { type: 'select', optionCode: 'hz_50' },
};
