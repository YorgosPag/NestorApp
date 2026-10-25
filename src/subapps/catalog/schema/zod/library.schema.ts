/**
 * Zod schemas για ομάδες ιδιοτήτων, οικογένειες μέτρησης χώρου και κατηγορίες (ADR-923 §5.2).
 * @module subapps/catalog/schema/zod/library.schema
 */

import { z } from 'zod';
import type { CatalogAttributeGroupDefinition } from '../../types/attribute-group';
import type { CatalogCategoryMappings } from '../../types/category';
import type {
  MeasurementUnitDefinition,
  WorkspaceMeasurementFamilyDefinition,
} from '../../types/measurement-family';
import { CATALOG_LIMITS } from '../../vocabulary/catalog-limits';
import {
  catalogCodeSchema,
  entityIdSchema,
  expectedRevisionSchema,
  labelsSchema,
  measurementUnitCodeSchema,
  orderKeySchema,
} from './common.schema';

// ── Ομάδα ιδιοτήτων ─────────────────────────────────────────────────────────

export const attributeGroupDefinitionSchema: z.ZodType<CatalogAttributeGroupDefinition, z.ZodTypeDef, unknown> =
  z.object({ code: catalogCodeSchema, labels: labelsSchema, orderKey: orderKeySchema });

export const createAttributeGroupBodySchema = z.object({ definition: attributeGroupDefinitionSchema });

export const updateAttributeGroupBodySchema = z.object({
  expectedRevision: expectedRevisionSchema,
  definition: attributeGroupDefinitionSchema,
});

// ── Οικογένεια μέτρησης χώρου ────────────────────────────────────────────────

const unitSchema: z.ZodType<MeasurementUnitDefinition, z.ZodTypeDef, unknown> = z.object({
  code: measurementUnitCodeSchema,
  symbol: z.string().trim().min(1).max(20),
  factor: z.number().finite().positive(),
  offset: z.number().finite().optional(),
  unece: z.string().regex(/^[A-Z0-9]{2,3}$/).optional(),
});

/** Ό,τι γράφει ο χρήστης· `source`/`comparable` **παράγονται** κατά την ανάγνωση (`fromWorkspaceDefinition`). */
export const workspaceMeasurementFamilyDefinitionSchema: z.ZodType<
  WorkspaceMeasurementFamilyDefinition,
  z.ZodTypeDef,
  unknown
> = z.object({
  code: catalogCodeSchema,
  labels: labelsSchema,
  standardUnitCode: measurementUnitCodeSchema,
  units: z.array(unitSchema).min(1).max(CATALOG_LIMITS.maxUnitsPerMeasurementFamily),
  singleUnit: z.boolean().default(false),
});

export const createMeasurementFamilyBodySchema = z.object({ definition: workspaceMeasurementFamilyDefinitionSchema });

export const updateMeasurementFamilyBodySchema = z.object({
  expectedRevision: expectedRevisionSchema,
  definition: workspaceMeasurementFamilyDefinitionSchema,
});

// ── Κατηγορία ───────────────────────────────────────────────────────────────

const categoryMappingsSchema: z.ZodType<CatalogCategoryMappings, z.ZodTypeDef, unknown> = z.object({
  atoeCode: z.string().max(40).nullable().default(null),
});

/** Δημιουργία: ο `ancestorIds` **δεν** έρχεται από τον πελάτη — τον υπολογίζει ο γραφέας. */
export const createCategoryBodySchema = z.object({
  code: catalogCodeSchema,
  labels: labelsSchema,
  parentId: entityIdSchema.nullable(),
  orderKey: orderKeySchema,
  mappings: categoryMappingsSchema.default({}),
});

export const updateCategoryBodySchema = z.object({
  expectedRevision: expectedRevisionSchema,
  labels: labelsSchema,
  mappings: categoryMappingsSchema,
});

export const moveCategoryBodySchema = z.object({
  expectedRevision: expectedRevisionSchema,
  parentId: entityIdSchema.nullable(),
  orderKey: orderKeySchema,
});
