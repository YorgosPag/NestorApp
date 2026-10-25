/**
 * Zod schemas ιδιότητας καταλόγου (ADR-923 §5.2) — **δομή** του σώματος αιτήματος. Η
 * σημασιολογία (υπάρχει η μονάδα; είναι ανάποδο το εύρος;) ζει στο `validate-attribute.ts`
 * και τρέχει **μετά** από αυτό, και στην οθόνη και στον γραφέα.
 * @module subapps/catalog/schema/zod/attribute.schema
 */

import { z } from 'zod';
import type { AttributeMappings, CatalogAttributeDefinition, SelectOption, TableColumn } from '../../types/attribute';
import {
  ASSET_KINDS,
  REFERENCE_RELATIONS,
} from '../../vocabulary/attribute-types';
import { CATALOG_LIMITS } from '../../vocabulary/catalog-limits';
import {
  catalogCodeSchema,
  descriptionSchema,
  entityIdSchema,
  expectedRevisionSchema,
  labelsSchema,
  measurementUnitCodeSchema,
  nullableNumberSchema,
  orderKeySchema,
} from './common.schema';

const decimalsSchema = z.number().int().min(0).max(CATALOG_LIMITS.maxDecimals);
const lengthSchema = z.number().int().positive().nullable();

const selectOptionSchema: z.ZodType<SelectOption, z.ZodTypeDef, unknown> = z.object({
  code: catalogCodeSchema,
  labels: labelsSchema,
});
const optionsSchema = z.array(selectOptionSchema).max(CATALOG_LIMITS.maxSelectOptions);

const numberConfigShape = {
  min: nullableNumberSchema,
  max: nullableNumberSchema,
  decimals: decimalsSchema,
  negativeAllowed: z.boolean(),
};

const tableColumnBase = { code: catalogCodeSchema, labels: labelsSchema };
const tableColumnSchema: z.ZodType<TableColumn, z.ZodTypeDef, unknown> = z.discriminatedUnion('type', [
  z.object({ ...tableColumnBase, type: z.literal('text') }),
  z.object({ ...tableColumnBase, type: z.literal('boolean') }),
  z.object({ ...tableColumnBase, type: z.literal('number'), decimals: decimalsSchema }),
  z.object({
    ...tableColumnBase,
    type: z.literal('measurement'),
    measurementFamilyCode: catalogCodeSchema,
    unitCode: measurementUnitCodeSchema,
    decimals: decimalsSchema,
  }),
  z.object({ ...tableColumnBase, type: z.literal('select'), options: optionsSchema }),
]);

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable();

const mappingsSchema: z.ZodType<AttributeMappings, z.ZodTypeDef, unknown> = z.object({
  etimFeature: z.string().max(40).nullable().default(null),
  bsddUri: z.string().url().max(500).nullable().default(null),
  ifc: z.object({ pset: z.string().min(1).max(100), property: z.string().min(1).max(100) }).nullable().default(null),
  atoeCode: z.string().max(40).nullable().default(null),
  // Η δέσμευση στο Κοινό Λεξικό τη γράφει η ροή του §17, **ποτέ** το σώμα αιτήματος.
  platformTerm: z.object({ status: z.literal('unbound') }).default({ status: 'unbound' }),
});

const definitionBaseShape = {
  code: catalogCodeSchema,
  groupId: entityIdSchema,
  labels: labelsSchema,
  description: descriptionSchema,
  localizable: z.boolean().default(false),
  scopable: z.boolean().default(false),
  unique: z.boolean().default(false),
  orderKey: orderKeySchema,
  mappings: mappingsSchema.default({}),
};

/** Μία επιλογή του union: κοινά πεδία + `type` + ρύθμιση του τύπου. */
function typed<TType extends string, TConfig extends z.ZodTypeAny>(type: TType, config: TConfig) {
  return z.object({ ...definitionBaseShape, type: z.literal(type), config });
}

/**
 * Πλήρης ορισμός ιδιότητας. Η ρητή επισημείωση τύπου είναι η **εγγύηση μεταγλώττισης** ότι
 * το schema και ο τύπος `CatalogAttributeDefinition` δεν αποκλίνουν.
 */
export const attributeDefinitionSchema: z.ZodType<CatalogAttributeDefinition, z.ZodTypeDef, unknown> =
  z.discriminatedUnion('type', [
    typed('text', z.object({ maxLength: lengthSchema, pattern: z.string().max(500).nullable() })),
    typed('richText', z.object({ maxLength: lengthSchema })),
    typed('number', z.object(numberConfigShape)),
    typed('measurement', z.object({
      ...numberConfigShape,
      measurementFamilyCode: catalogCodeSchema,
      defaultUnitCode: measurementUnitCodeSchema,
    })),
    typed('boolean', z.object({}).strict()),
    typed('select', z.object({ options: optionsSchema })),
    typed('multiSelect', z.object({ options: optionsSchema, maxSelections: lengthSchema })),
    typed('date', z.object({ min: isoDateSchema, max: isoDateSchema })),
    typed('asset', z.object({
      assetKinds: z.array(z.enum(ASSET_KINDS)).max(ASSET_KINDS.length),
      maxFiles: z.number().int().min(1).max(100),
    })),
    typed('reference', z.object({
      relation: z.enum(REFERENCE_RELATIONS),
      targetFamilyCodes: z.array(catalogCodeSchema).max(50),
      maxReferences: lengthSchema,
    })),
    typed('table', z.object({ columns: z.array(tableColumnSchema).max(CATALOG_LIMITS.maxTableColumns) })),
  ]);

export const createAttributeBodySchema = z.object({ definition: attributeDefinitionSchema });

/** Αντικατάσταση ορισμού: ο `code` πρέπει να είναι ίδιος (ο γραφέας το επιβάλλει). */
export const updateAttributeBodySchema = z.object({
  expectedRevision: expectedRevisionSchema,
  definition: attributeDefinitionSchema,
});

export const deleteCatalogEntityBodySchema = z.object({ expectedRevision: expectedRevisionSchema });
