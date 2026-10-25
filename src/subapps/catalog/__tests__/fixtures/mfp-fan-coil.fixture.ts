/**
 * Η οικογένεια «Fan coil» (MFP) του καταλόγου Aries, σελ. 60 — το **κριτήριο εξόδου** της
 * Φάσης 1 (ADR-923 §9) ως δεδομένα: αν ο επικυρωτής τη δέχεται, το σχήμα μπορεί να την
 * εκφράσει. Τα id είναι ίσα με τους κωδικούς για αναγνωσιμότητα.
 */

import type { CatalogAttributeDefinition, AttributeMappings } from '../../types/attribute';
import type { CatalogFamilyDefinition } from '../../types/family';

export const NO_MAPPINGS: AttributeMappings = {
  etimFeature: null,
  bsddUri: null,
  ifc: null,
  atoeCode: null,
  platformTerm: { status: 'unbound' },
};

const base = (code: string, groupId: string, el: string) => ({
  code,
  groupId,
  labels: { el },
  description: {},
  localizable: false,
  scopable: false,
  unique: false,
  orderKey: 'a0',
  mappings: NO_MAPPINGS,
});

const power = (code: string, el: string): CatalogAttributeDefinition => ({
  ...base(code, 'performance', el),
  type: 'measurement',
  config: { measurementFamilyCode: 'power', defaultUnitCode: 'kW', min: 0, max: null, decimals: 2, negativeAllowed: false },
});

export const MFP_SIZES = ['mfp_34', 'mfp_51', 'mfp_68', 'mfp_85', 'mfp_102', 'mfp_136', 'mfp_170'] as const;

export const MFP_ATTRIBUTES: readonly CatalogAttributeDefinition[] = [
  { ...base('model_code', 'general', 'Κωδικός'), unique: true, type: 'text', config: { maxLength: 40, pattern: null } },
  {
    ...base('size', 'general', 'Μέγεθος'),
    type: 'select',
    config: { options: MFP_SIZES.map((code) => ({ code, labels: { el: code.toUpperCase().replace('_', '-') } })) },
  },
  power('cooling_h', 'Ψυκτική ισχύς H'),
  power('cooling_m', 'Ψυκτική ισχύς M'),
  power('cooling_l', 'Ψυκτική ισχύς L'),
  power('heating_h', 'Θερμική ισχύς H'),
  {
    ...base('airflow_h', 'performance', 'Παροχή αέρα H'),
    type: 'measurement',
    config: { measurementFamilyCode: 'volume_flow', defaultUnitCode: 'm3_h', min: 0, max: null, decimals: 0, negativeAllowed: false },
  },
  {
    ...base('sound_pressure', 'performance', 'Στάθμη θορύβου'),
    type: 'measurement',
    config: { measurementFamilyCode: 'sound_pressure_level', defaultUnitCode: 'dBA', min: null, max: null, decimals: 0, negativeAllowed: false },
  },
  {
    ...base('weight', 'dimensions', 'Βάρος'),
    type: 'measurement',
    config: { measurementFamilyCode: 'mass', defaultUnitCode: 'kg', min: 0, max: null, decimals: 1, negativeAllowed: false },
  },
  { ...base('dimensions', 'dimensions', 'Διαστάσεις ΠxΥxΒ'), type: 'text', config: { maxLength: 40, pattern: null } },
  { ...base('photo', 'media', 'Φωτογραφία'), type: 'asset', config: { assetKinds: ['image'], maxFiles: 5 } },
];

export const MFP_ATTRIBUTE_MAP: ReadonlyMap<string, CatalogAttributeDefinition> = new Map(
  MFP_ATTRIBUTES.map((attribute) => [attribute.code, attribute]),
);

const variantAttributes = ['model_code', 'cooling_h', 'cooling_m', 'cooling_l', 'heating_h', 'airflow_h', 'sound_pressure', 'weight', 'dimensions'];

export const MFP_FAMILY: CatalogFamilyDefinition = {
  code: 'fan_coil',
  labels: { el: 'Fan coil', en: 'Fan coil' },
  description: {},
  attributes: MFP_ATTRIBUTES.map((attribute) => ({
    attributeId: attribute.code,
    requiredChannels: attribute.code === 'photo' ? ['storefront'] : ['print', 'storefront'],
  })),
  labelAttributeId: 'model_code',
  imageAttributeId: 'photo',
  variantSchemes: [
    { code: 'by_size', labels: { el: 'Ανά μέγεθος' }, levels: [{ axisAttributeIds: ['size'], attributeIds: variantAttributes }] },
  ],
  tableSpec: {
    variantSchemeCode: 'by_size',
    rows: [
      { kind: 'axis', id: 'r_size', axisAttributeId: 'size' },
      { kind: 'groupHeader', id: 'r_cooling', labels: { el: 'Ψύξη' } },
      ...(['cooling_h', 'cooling_m', 'cooling_l'] as const).map((attributeId) => ({
        kind: 'attribute' as const, id: `r_${attributeId}`, attributeId, labelOverride: null,
        displayUnitCode: null, axisFilter: null, merge: 'none' as const,
      })),
      { kind: 'attribute', id: 'r_airflow', attributeId: 'airflow_h', labelOverride: null, displayUnitCode: 'l_s', axisFilter: null, merge: 'none' },
      { kind: 'attribute', id: 'r_dims', attributeId: 'dimensions', labelOverride: null, displayUnitCode: null, axisFilter: null, merge: 'equalAdjacent' },
    ],
  },
  consistencyRules: [
    { id: 'rule_unique_code', kind: 'unique', attributeId: 'model_code', severity: 'error' },
    {
      id: 'rule_hml', kind: 'orderAcrossAttributes', attributeIds: ['cooling_h', 'cooling_m', 'cooling_l'],
      direction: 'descending', strict: false, severity: 'error',
    },
    {
      id: 'rule_grows_with_size', kind: 'monotonicAlongAxis', attributeId: 'cooling_h', axisAttributeId: 'size',
      direction: 'ascending', strict: true, severity: 'warning',
    },
    {
      id: 'rule_min_power', kind: 'compare', leftAttributeId: 'cooling_h', operator: 'gte',
      right: { kind: 'constant', value: 500, unitCode: 'W' }, severity: 'warning',
    },
  ],
};
