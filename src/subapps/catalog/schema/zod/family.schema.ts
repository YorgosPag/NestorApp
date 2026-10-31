/**
 * Zod schema οικογένειας προϊόντων (ADR-923 §5.2) — δομή· η σημασιολογία απέναντι στη
 * βιβλιοθήκη ζει στο `validate-family.ts`.
 * @module subapps/catalog/schema/zod/family.schema
 */

import { z } from 'zod';
import type {
  CatalogFamilyDefinition,
  ConsistencyRule,
  FamilyTableSpec,
  FamilyTableRow,
  VariantScheme,
} from '../../types/family';
import {
  COMPARE_OPERATORS,
  ORDER_DIRECTIONS,
  RULE_SEVERITIES,
  TABLE_ROW_MERGE_MODES,
} from '../../types/family';
import { CATALOG_CHANNELS } from '../../vocabulary/channels';
import { CATALOG_LIMITS } from '../../vocabulary/catalog-limits';
import { CATALOG_LISTING_KINDS } from '../../vocabulary/listing-kinds';
import {
  catalogCodeSchema,
  descriptionSchema,
  entityIdSchema,
  expectedRevisionSchema,
  labelsSchema,
  measurementUnitCodeSchema,
} from './common.schema';

const localIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
const attributeIdList = (max: number) => z.array(entityIdSchema).max(max);

const variantSchemeSchema: z.ZodType<VariantScheme, z.ZodTypeDef, unknown> = z.object({
  code: catalogCodeSchema,
  labels: labelsSchema,
  levels: z.array(z.object({
    axisAttributeIds: attributeIdList(CATALOG_LIMITS.maxAxesPerLevel),
    attributeIds: attributeIdList(CATALOG_LIMITS.maxAttributesPerFamily),
  })).max(CATALOG_LIMITS.maxVariantLevels),
});

const tableRowSchema: z.ZodType<FamilyTableRow, z.ZodTypeDef, unknown> = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('groupHeader'), id: localIdSchema, labels: labelsSchema }),
  z.object({ kind: z.literal('axis'), id: localIdSchema, axisAttributeId: entityIdSchema }),
  z.object({
    kind: z.literal('attribute'),
    id: localIdSchema,
    attributeId: entityIdSchema,
    labelOverride: labelsSchema.nullable(),
    displayUnitCode: measurementUnitCodeSchema.nullable(),
    axisFilter: z.object({ axisAttributeId: entityIdSchema, optionCode: catalogCodeSchema }).nullable(),
    merge: z.enum(TABLE_ROW_MERGE_MODES),
  }),
]);

const tableSpecSchema: z.ZodType<FamilyTableSpec, z.ZodTypeDef, unknown> = z.object({
  variantSchemeCode: catalogCodeSchema,
  rows: z.array(tableRowSchema).max(CATALOG_LIMITS.maxTableSpecRows),
});

const ruleBase = { id: localIdSchema, severity: z.enum(RULE_SEVERITIES) };

const consistencyRuleSchema: z.ZodType<ConsistencyRule, z.ZodTypeDef, unknown> = z.discriminatedUnion('kind', [
  z.object({ ...ruleBase, kind: z.literal('unique'), attributeId: entityIdSchema }),
  z.object({
    ...ruleBase,
    kind: z.literal('orderAcrossAttributes'),
    attributeIds: attributeIdList(CATALOG_LIMITS.maxAttributesPerOrderRule),
    direction: z.enum(ORDER_DIRECTIONS),
    strict: z.boolean(),
  }),
  z.object({
    ...ruleBase,
    kind: z.literal('monotonicAlongAxis'),
    attributeId: entityIdSchema,
    axisAttributeId: entityIdSchema,
    direction: z.enum(ORDER_DIRECTIONS),
    strict: z.boolean(),
  }),
  z.object({
    ...ruleBase,
    kind: z.literal('compare'),
    leftAttributeId: entityIdSchema,
    operator: z.enum(COMPARE_OPERATORS),
    right: z.discriminatedUnion('kind', [
      z.object({ kind: z.literal('attribute'), attributeId: entityIdSchema }),
      z.object({ kind: z.literal('constant'), value: z.number().finite(), unitCode: measurementUnitCodeSchema.nullable() }),
    ]),
  }),
]);

export const familyDefinitionSchema: z.ZodType<CatalogFamilyDefinition, z.ZodTypeDef, unknown> = z.object({
  code: catalogCodeSchema,
  labels: labelsSchema,
  description: descriptionSchema,
  attributes: z.array(z.object({
    attributeId: entityIdSchema,
    requiredChannels: z.array(z.enum(CATALOG_CHANNELS)).max(CATALOG_CHANNELS.length),
  })).max(CATALOG_LIMITS.maxAttributesPerFamily),
  labelAttributeId: entityIdSchema.nullable(),
  imageAttributeId: entityIdSchema.nullable(),
  variantSchemes: z.array(variantSchemeSchema).max(CATALOG_LIMITS.maxVariantSchemes),
  tableSpec: tableSpecSchema.nullable(),
  consistencyRules: z.array(consistencyRuleSchema).max(CATALOG_LIMITS.maxConsistencyRules),
  listingKind: z.enum(CATALOG_LISTING_KINDS).optional(),
  installationAttributeId: entityIdSchema.nullable().optional(),
});

export const createFamilyBodySchema = z.object({ definition: familyDefinitionSchema });

export const updateFamilyBodySchema = z.object({
  expectedRevision: expectedRevisionSchema,
  definition: familyDefinitionSchema,
});
