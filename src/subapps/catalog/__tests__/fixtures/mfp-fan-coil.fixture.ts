/**
 * Η οικογένεια «Fan coil» (MFP) του καταλόγου Aries, σελ. 60 — το **κριτήριο εξόδου** της
 * Φάσης 1 (ADR-923 §9) ως δεδομένα: αν ο επικυρωτής τη δέχεται, το σχήμα μπορεί να την
 * εκφράσει. Τα id είναι ίσα με τους κωδικούς για αναγνωσιμότητα.
 */

import type { CatalogAttributeDefinition, AttributeMappings } from '../../types/attribute';
import type { CatalogFamilyDefinition } from '../../types/family';
import type { CatalogChannel } from '../../vocabulary/channels';

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

const airflow = (code: string, el: string): CatalogAttributeDefinition => ({
  ...base(code, 'performance', el),
  type: 'measurement',
  config: { measurementFamilyCode: 'volume_flow', defaultUnitCode: 'm3_h', min: 0, max: null, decimals: 0, negativeAllowed: false },
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
  airflow('airflow_h', 'Παροχή αέρα H'),
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
  // ── Φάση 2α: οι υπόλοιπες γραμμές της σελ. 60 + κοινές τιμές του μοντέλου ──
  power('heating_m', 'Θερμική ισχύς M'),
  power('heating_l', 'Θερμική ισχύς L'),
  airflow('airflow_m', 'Παροχή αέρα M'),
  airflow('airflow_l', 'Παροχή αέρα L'),
  {
    ...base('description', 'general', 'Περιγραφή'),
    localizable: true,
    type: 'richText',
    config: { maxLength: 4000 },
  },
  { ...base('power_supply', 'general', 'Ηλεκτρική παροχή'), type: 'text', config: { maxLength: 40, pattern: null } },
  { ...base('water_connections', 'dimensions', 'Συνδέσεις εισαγωγή-επιστροφή'), type: 'text', config: { maxLength: 40, pattern: null } },
];

export const MFP_ATTRIBUTE_MAP: ReadonlyMap<string, CatalogAttributeDefinition> = new Map(
  MFP_ATTRIBUTES.map((attribute) => [attribute.code, attribute]),
);

/** Ό,τι διαφέρει ανά μέγεθος (επίπεδο 1)· τα υπόλοιπα (περιγραφή, παροχή, συνδέσεις, φωτογραφία) είναι κοινά. */
export const MFP_VARIANT_ATTRIBUTES = [
  'model_code', 'cooling_h', 'cooling_m', 'cooling_l', 'heating_h', 'heating_m', 'heating_l',
  'airflow_h', 'airflow_m', 'airflow_l', 'sound_pressure', 'weight', 'dimensions',
];

/** Υποχρεωτικά ανά κανάλι: η φωτογραφία και η περιγραφή μόνο στη βιτρίνα, τα υπόλοιπα και στο έντυπο. */
const requiredChannelsOf = (code: string): CatalogChannel[] =>
  code === 'photo' || code === 'description' ? ['storefront'] : ['print', 'storefront'];

export const MFP_FAMILY: CatalogFamilyDefinition = {
  code: 'fan_coil',
  labels: { el: 'Fan coil', en: 'Fan coil' },
  description: {},
  attributes: MFP_ATTRIBUTES.map((attribute) => ({
    attributeId: attribute.code,
    requiredChannels: requiredChannelsOf(attribute.code),
  })),
  labelAttributeId: 'model_code',
  imageAttributeId: 'photo',
  variantSchemes: [
    { code: 'by_size', labels: { el: 'Ανά μέγεθος' }, levels: [{ axisAttributeIds: ['size'], attributeIds: MFP_VARIANT_ATTRIBUTES }] },
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
    // Η ΠΡΑΓΜΑΤΙΚΗ αστοχία του gpt-4o (Φάση 0 §21.3): η θέρμανση H/M μετατοπισμένη κατά μία στήλη.
    {
      id: 'rule_heat_hml', kind: 'orderAcrossAttributes', attributeIds: ['heating_h', 'heating_m', 'heating_l'],
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
