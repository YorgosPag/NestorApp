/**
 * Zod των **σωμάτων αιτήματος** της εισαγωγής (ADR-923 §5.5.1) — δομή του σύρματος. Τη σημασιολογία (ποιος στόχος υπάρχει,
 * τι επιτρέπεται) την κρίνουν οι γραφείς. Τα συμβόλαια ζουν στο `types/catalog-import-requests.ts`.
 * @module subapps/catalog/schema/zod/catalog-import.schema
 */

import { z } from 'zod';
import { HUMAN_LANGUAGES } from '@/i18n/languages';
import type { ImportBatchTarget, ImportProfileDefinition, ImportTarget } from '../../types/catalog-import';
import type { AttachImportFileRequest, CreateImportBatchRequest, ProposalActionRequest, ReadImportPageRequest, UpdateImportProposalRequest } from '../../types/catalog-import-requests';
import { ANY_SLOT } from '../../types/product';
import { CATALOG_CHANNELS } from '../../vocabulary/channels';
import {
  IMPORT_MAX_FILE_BYTES,
  IMPORT_PRICE_FIELDS,
  IMPORT_PURPOSES,
  IMPORT_SOURCE_KINDS,
} from '../../vocabulary/catalog-import';
import { CATALOG_LIMITS } from '../../vocabulary/catalog-limits';
import { catalogCodeSchema, entityIdSchema, expectedRevisionSchema, measurementUnitCodeSchema } from './common.schema';

const MAX_COLUMNS = 200;
const MAX_FIELD_CHANGES = 2000;
const MAX_CELL_TEXT = 4000;

const importTargetSchema: z.ZodType<ImportTarget> = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('modelCode') }),
  z.object({ kind: z.literal('skuIdentifier') }),
  z.object({
    kind: z.literal('attribute'),
    attributeId: entityIdSchema,
    channel: z.enum([ANY_SLOT, ...CATALOG_CHANNELS]),
    locale: z.enum([ANY_SLOT, ...HUMAN_LANGUAGES]),
  }),
  z.object({ kind: z.literal('price'), field: z.enum(IMPORT_PRICE_FIELDS) }),
]);

const columnRuleSchema = z.object({
  header: z.string().max(CATALOG_LIMITS.maxLabelLength),
  position: z.number().int().min(0).max(MAX_COLUMNS),
  target: importTargetSchema.nullable(),
  unitCode: measurementUnitCodeSchema.nullable(),
});

export const importProfileDefinitionSchema: z.ZodType<ImportProfileDefinition> = z.object({
  code: catalogCodeSchema,
  label: z.string().min(1).max(CATALOG_LIMITS.maxLabelLength),
  purpose: z.enum(IMPORT_PURPOSES),
  supplierContactId: entityIdSchema.nullable(),
  familyId: entityIdSchema.nullable(),
  skipRows: z.number().int().min(0).max(100),
  sheetIndex: z.number().int().min(0).max(100),
  columns: z.array(columnRuleSchema).max(MAX_COLUMNS),
});

const batchTargetSchema: z.ZodType<ImportBatchTarget> = z.discriminatedUnion('purpose', [
  z.object({
    purpose: z.literal('attributes'),
    familyId: entityIdSchema,
    variantSchemeCode: catalogCodeSchema.nullable(),
    categoryIds: z.array(entityIdSchema).max(20),
  }),
  z.object({ purpose: z.literal('priceLines'), priceListVersionId: entityIdSchema, identifierAttributeId: entityIdSchema }),
]);

export const createImportBatchBodySchema: z.ZodType<CreateImportBatchRequest> = z.object({
  sourceKind: z.enum(IMPORT_SOURCE_KINDS),
  contentSha256: z.string().regex(/^[0-9a-f]{64}$/),
  fileName: z.string().min(1).max(255),
  sizeBytes: z.number().int().min(1).max(IMPORT_MAX_FILE_BYTES),
  target: batchTargetSchema,
  profileId: entityIdSchema.nullable(),
  run: z.number().int().min(0).max(1000),
  pageRange: z.object({ from: z.number().int().min(1), to: z.number().int().min(1) }).nullable(),
});

export const attachImportFileBodySchema: z.ZodType<AttachImportFileRequest> = z.object({
  expectedRevision: expectedRevisionSchema,
  fileId: entityIdSchema,
});

export const readImportPageBodySchema: z.ZodType<ReadImportPageRequest> = z.object({ page: z.number().int().min(1) });

const fieldAddress = { rowKey: z.string().min(1).max(200), targetKey: z.string().min(1).max(300) };

export const updateImportProposalBodySchema: z.ZodType<UpdateImportProposalRequest> = z.object({
  expectedRevision: expectedRevisionSchema,
  decisions: z.array(z.object({ ...fieldAddress, decision: z.enum(['accept', 'reject']) })).max(MAX_FIELD_CHANGES),
  edits: z.array(z.object({ ...fieldAddress, text: z.string().max(MAX_CELL_TEXT) })).max(MAX_FIELD_CHANGES),
  modelCode: z.string().max(CATALOG_LIMITS.maxLabelLength).nullable(),
});

export const proposalActionBodySchema: z.ZodType<ProposalActionRequest> = z.object({ expectedRevision: expectedRevisionSchema });

export const saveImportProfileBodySchema = z.object({ definition: importProfileDefinitionSchema });
export const updateImportProfileBodySchema = z.object({ expectedRevision: expectedRevisionSchema, definition: importProfileDefinitionSchema });
