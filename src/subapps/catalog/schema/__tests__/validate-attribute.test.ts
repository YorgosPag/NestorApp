import { createMeasurementRegistry, PLATFORM_MEASUREMENT_REGISTRY } from '../../measurement/measurement-registry';
import type { CatalogAttributeDefinition, TableAttributeConfig } from '../../types/attribute';
import { MFP_ATTRIBUTES, NO_MAPPINGS } from '../../__tests__/fixtures/mfp-fan-coil.fixture';
import { validateAttribute } from '../validate-attribute';

const base = {
  code: 'x',
  groupId: 'g',
  labels: { el: 'Χ' },
  description: {},
  localizable: false,
  scopable: false,
  unique: false,
  orderKey: 'a0',
  mappings: NO_MAPPINGS,
};
const codes = (attribute: CatalogAttributeDefinition) =>
  validateAttribute(attribute, PLATFORM_MEASUREMENT_REGISTRY).map((issue) => issue.code);

describe('validateAttribute', () => {
  it('accepts every MFP attribute', () => {
    for (const attribute of MFP_ATTRIBUTES) expect({ code: attribute.code, issues: codes(attribute) }).toEqual({ code: attribute.code, issues: [] });
  });

  it('rejects an unknown measurement family and a unit from another family', () => {
    const measurement = (family: string, unit: string): CatalogAttributeDefinition => ({
      ...base,
      type: 'measurement',
      config: { measurementFamilyCode: family, defaultUnitCode: unit, min: null, max: null, decimals: 2, negativeAllowed: false },
    });
    expect(codes(measurement('warp_speed', 'c'))).toContain('measurementFamilyUnknown');
    expect(codes(measurement('power', 'kg'))).toContain('measurementUnitUnknown');
  });

  it('accepts a workspace measurement family once it is in the registry', () => {
    const registry = createMeasurementRegistry([{
      code: 'luminous_efficacy', source: 'workspace', label: { kind: 'text', text: { el: 'Απόδοση' } },
      standardUnitCode: 'lm_W', comparable: false, units: [{ code: 'lm_W', symbol: 'lm/W', factor: 1 }],
    }]);
    const attribute: CatalogAttributeDefinition = {
      ...base,
      type: 'measurement',
      config: { measurementFamilyCode: 'luminous_efficacy', defaultUnitCode: 'lm_W', min: null, max: null, decimals: 0, negativeAllowed: false },
    };
    expect(validateAttribute(attribute, registry)).toEqual([]);
  });

  it('rejects an inverted range, too many decimals and an invalid regex', () => {
    expect(codes({ ...base, type: 'number', config: { min: 10, max: 1, decimals: 9, negativeAllowed: true } }))
      .toEqual(expect.arrayContaining(['rangeInverted', 'decimalsOutOfRange']));
    expect(codes({ ...base, type: 'text', config: { maxLength: null, pattern: '([' } })).toEqual(['invalidPattern']);
  });

  it('requires unique option codes and at least one option', () => {
    const option = { code: 'a', labels: { el: 'Α' } };
    expect(codes({ ...base, type: 'select', config: { options: [option, option] } })).toContain('duplicateCode');
    expect(codes({ ...base, type: 'select', config: { options: [] } })).toContain('optionsRequired');
  });

  it('requires a keyable first table column and 2..10 columns', () => {
    const table = (columns: TableAttributeConfig['columns']) => codes({ ...base, type: 'table', config: { columns } });
    expect(table([{ code: 'ok', labels: { el: 'Ναι' }, type: 'boolean' }, { code: 'v', labels: { el: 'Τ' }, type: 'text' }]))
      .toContain('tableKeyColumnType');
    expect(table([{ code: 'flow', labels: { el: 'Παροχή' }, type: 'number', decimals: 1 }])).toContain('tableColumnsCount');
  });

  it('rejects flags the type does not support', () => {
    expect(codes({ ...base, unique: true, localizable: true, type: 'boolean', config: {} }))
      .toEqual(expect.arrayContaining(['uniqueNotSupported', 'localizableNotSupported']));
  });

  it('requires a code and a label', () => {
    expect(codes({ ...base, code: 'Bad Code', labels: { el: ' ' }, type: 'boolean', config: {} }))
      .toEqual(expect.arrayContaining(['invalidCode', 'labelRequired']));
  });
});
