import { MFP_ATTRIBUTES, MFP_FAMILY } from '../../__tests__/fixtures/mfp-fan-coil.fixture';
import { attributeDefinitionSchema } from '../zod/attribute.schema';
import { familyDefinitionSchema } from '../zod/family.schema';
import { createCategoryBodySchema, workspaceMeasurementFamilyDefinitionSchema } from '../zod/library.schema';

describe('zod body schemas', () => {
  it('round-trips every MFP attribute and the MFP family unchanged', () => {
    for (const attribute of MFP_ATTRIBUTES) {
      expect(attributeDefinitionSchema.parse(attribute)).toEqual(attribute);
    }
    expect(familyDefinitionSchema.parse(MFP_FAMILY)).toEqual(MFP_FAMILY);
  });

  it('normalizes labels and fills mapping defaults', () => {
    const parsed = attributeDefinitionSchema.parse({ ...MFP_ATTRIBUTES[0], labels: { el: '  Κωδικός ', pseudo: 'x' }, mappings: {} });
    expect(parsed.labels).toEqual({ el: 'Κωδικός' });
    expect(parsed.mappings.platformTerm).toEqual({ status: 'unbound' });
  });

  it('never accepts a platform-term binding from the client (§17 owns it)', () => {
    const result = attributeDefinitionSchema.safeParse({
      ...MFP_ATTRIBUTES[0],
      mappings: { platformTerm: { status: 'bound', termId: 't1' } },
    });
    expect(result.success).toBe(false);
  });

  it('rejects a config that belongs to another type', () => {
    const result = attributeDefinitionSchema.safeParse({ ...MFP_ATTRIBUTES[0], type: 'measurement' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid codes and order keys', () => {
    expect(createCategoryBodySchema.safeParse({ code: 'Κλιματισμός', labels: { el: 'Κ' }, parentId: null, orderKey: 'a0' }).success).toBe(false);
    expect(createCategoryBodySchema.safeParse({ code: 'hvac', labels: { el: 'Κ' }, parentId: null, orderKey: 'a00' }).success).toBe(false);
    expect(createCategoryBodySchema.safeParse({ code: 'hvac', labels: { el: 'Κ' }, parentId: null, orderKey: 'a0' }).success).toBe(true);
  });

  it('rejects a non-positive unit factor', () => {
    const result = workspaceMeasurementFamilyDefinitionSchema.safeParse({
      code: 'x', labels: { el: 'Χ' }, standardUnitCode: 'u', units: [{ code: 'u', symbol: 'u', factor: 0 }],
    });
    expect(result.success).toBe(false);
  });
});
