import { PLATFORM_MEASUREMENT_REGISTRY } from '../../measurement/measurement-registry';
import type { CatalogAttributeDefinition } from '../../types/attribute';
import { listingKindOf, type CatalogFamilyDefinition, type ConsistencyRule, type FamilyTableRow } from '../../types/family';
import { MFP_ATTRIBUTE_MAP, MFP_FAMILY } from '../../__tests__/fixtures/mfp-fan-coil.fixture';
import { validateFamily } from '../validate-family';

const issueCodes = (family: CatalogFamilyDefinition, attributes = MFP_ATTRIBUTE_MAP) =>
  validateFamily(family, attributes, PLATFORM_MEASUREMENT_REGISTRY).map((issue) => issue.code);

const withRules = (...rules: ConsistencyRule[]): CatalogFamilyDefinition => ({ ...MFP_FAMILY, consistencyRules: rules });

describe('validateFamily — exit criterion', () => {
  it('accepts the full MFP fan coil family (Aries p.60)', () => {
    expect(validateFamily(MFP_FAMILY, MFP_ATTRIBUTE_MAP, PLATFORM_MEASUREMENT_REGISTRY)).toEqual([]);
  });
});

describe('validateFamily — attributes', () => {
  it('reports unknown and duplicate attribute bindings', () => {
    const family: CatalogFamilyDefinition = {
      ...MFP_FAMILY,
      attributes: [...MFP_FAMILY.attributes, { attributeId: 'ghost', requiredChannels: [] }, MFP_FAMILY.attributes[0]],
    };
    expect(issueCodes(family)).toEqual(expect.arrayContaining(['attributeUnknown', 'attributeDuplicate']));
  });

  it('requires a text label attribute and an image asset attribute', () => {
    expect(issueCodes({ ...MFP_FAMILY, labelAttributeId: 'cooling_h', imageAttributeId: 'model_code' }))
      .toEqual(expect.arrayContaining(['labelAttributeType', 'imageAttributeType']));
  });
});

describe('validateFamily — είδος καταχώρισης (§22)', () => {
  const service: CatalogAttributeDefinition = { ...MFP_ATTRIBUTE_MAP.get('model_code')!, code: 'installation', type: 'reference' } as CatalogAttributeDefinition;
  const attributes = new Map([...MFP_ATTRIBUTE_MAP, ['installation', service]]);
  const bound: CatalogFamilyDefinition = { ...MFP_FAMILY, attributes: [...MFP_FAMILY.attributes, { attributeId: 'installation', requiredChannels: [] }] };
  const codes = (family: CatalogFamilyDefinition) => issueCodes(family, attributes).filter((code) => code.startsWith('installation'));

  it('οικογένεια χωρίς το πεδίο είναι προϊόν, χωρίς κανένα εύρημα', () => {
    expect(listingKindOf(MFP_FAMILY)).toBe('product');
    expect(codes(bound)).toEqual([]);
  });

  it('η υπηρεσία δέχεται το ίδιο σχήμα', () => {
    expect(codes({ ...bound, listingKind: 'service' })).toEqual([]);
  });

  it('🔴 προϊόν με τοποθέτηση χωρίς δεσμό απορρίπτεται', () => {
    expect(codes({ ...bound, listingKind: 'productWithInstallation', installationAttributeId: null })).toEqual(['installationAttributeRequired']);
  });

  it('🔴 ο δεσμός πρέπει να είναι ιδιότητα αναφοράς της οικογένειας', () => {
    expect(codes({ ...bound, listingKind: 'productWithInstallation', installationAttributeId: 'model_code' })).toEqual(['installationAttributeType']);
    expect(codes({ ...MFP_FAMILY, listingKind: 'productWithInstallation', installationAttributeId: 'installation' })).toEqual(['installationAttributeType']);
    expect(codes({ ...bound, listingKind: 'productWithInstallation', installationAttributeId: 'installation' })).toEqual([]);
  });

  it('🔴 δεσμός σε άλλο είδος απαγορεύεται', () => {
    expect(codes({ ...bound, listingKind: 'service', installationAttributeId: 'installation' })).toEqual(['installationAttributeForbidden']);
  });
});

describe('validateFamily — variants', () => {
  it('rejects a text attribute as axis, too many levels and an attribute placed twice', () => {
    const family: CatalogFamilyDefinition = {
      ...MFP_FAMILY,
      tableSpec: null,
      consistencyRules: [],
      variantSchemes: [{
        code: 'broken',
        labels: { el: 'x' },
        levels: [
          { axisAttributeIds: ['dimensions'], attributeIds: ['weight'] },
          { axisAttributeIds: ['size'], attributeIds: ['weight'] },
          { axisAttributeIds: ['size'], attributeIds: [] },
        ],
      }],
    };
    expect(issueCodes(family)).toEqual(
      expect.arrayContaining(['axisTypeNotAllowed', 'variantLevelsCount', 'attributeInMultipleLevels']),
    );
  });

  it('rejects a localizable axis', () => {
    const size = MFP_ATTRIBUTE_MAP.get('size') as CatalogAttributeDefinition;
    const attributes = new Map(MFP_ATTRIBUTE_MAP).set('size', { ...size, localizable: true });
    expect(issueCodes(MFP_FAMILY, attributes)).toContain('axisLocalizedOrScoped');
  });
});

describe('validateFamily — table layout', () => {
  const withRows = (...rows: FamilyTableRow[]): CatalogFamilyDefinition => ({
    ...MFP_FAMILY,
    tableSpec: { variantSchemeCode: 'by_size', rows },
  });

  it('rejects an axis filter on an option that does not exist', () => {
    expect(issueCodes(withRows({
      kind: 'attribute', id: 'r1', attributeId: 'cooling_h', labelOverride: null, displayUnitCode: null,
      axisFilter: { axisAttributeId: 'size', optionCode: 'mfp_999' }, merge: 'none',
    }))).toContain('tableAxisFilterInvalid');
  });

  it('rejects a display unit from another measurement family', () => {
    expect(issueCodes(withRows({
      kind: 'attribute', id: 'r1', attributeId: 'cooling_h', labelOverride: null, displayUnitCode: 'm3_h',
      axisFilter: null, merge: 'none',
    }))).toContain('measurementUnitUnknown');
  });

  it('rejects an unknown variant scheme', () => {
    expect(issueCodes({ ...MFP_FAMILY, tableSpec: { variantSchemeCode: 'nope', rows: [] } })).toContain('tableSchemeUnknown');
  });
});

describe('validateFamily — consistency rules', () => {
  it('rejects comparing power with air flow (different dimensions)', () => {
    expect(issueCodes(withRules({
      id: 'r', kind: 'compare', leftAttributeId: 'cooling_h', operator: 'gte',
      right: { kind: 'attribute', attributeId: 'airflow_h' }, severity: 'error',
    }))).toContain('ruleMeasurementMismatch');
  });

  it('rejects an order rule over a non-numeric attribute and a monotonic rule on a non-axis', () => {
    expect(issueCodes(withRules(
      { id: 'a', kind: 'orderAcrossAttributes', attributeIds: ['cooling_h', 'dimensions'], direction: 'descending', strict: false, severity: 'error' },
      { id: 'b', kind: 'monotonicAlongAxis', attributeId: 'cooling_h', axisAttributeId: 'weight', direction: 'ascending', strict: false, severity: 'error' },
    ))).toEqual(expect.arrayContaining(['ruleAttributeNotNumeric', 'ruleAxisUnknown']));
  });

  it('requires a constant in a unit of the attribute family', () => {
    expect(issueCodes(withRules({
      id: 'r', kind: 'compare', leftAttributeId: 'cooling_h', operator: 'gte',
      right: { kind: 'constant', value: 5, unitCode: 'kg' }, severity: 'error',
    }))).toContain('ruleConstantUnitUnknown');
  });

  it('reports duplicate rule ids', () => {
    const rule: ConsistencyRule = { id: 'dup', kind: 'unique', attributeId: 'model_code', severity: 'error' };
    expect(issueCodes(withRules(rule, rule))).toContain('duplicateCode');
  });
});
