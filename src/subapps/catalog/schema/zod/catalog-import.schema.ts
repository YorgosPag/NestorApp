/**
 * Zod των **σωμάτων αιτήματος** της εισαγωγής (ADR-923 §5.5.1) — δομή του σύρματος. Τη σημασιολογία (ποιος στόχος υπάρχει,
 * τι επιτρέπεται) την κρίνουν οι γραφείς. Τα συμβόλαια ζουν στο `types/catalog-import-requests.ts`.
 * @module subapps/catalog/schema/zod/catalog-import.schema
 */

import { z } from 'zod';
import { HUMAN_LANGUAGES } from '@/i18n/languages';
import { UOM_CODES } from '@/lib/uom/uom-registry';
import type { ImportBatchTarget, ImportLineDecision, ImportProfileDefinition, ImportTarget } from '../../types/catalog-import';
import type {
  AddImportAxisOptionsRequest,
  AttachImportFileRequest,
  ClearLabelMemoryRequest,
  CreateImportBatchRequest,
  FetchImportAssetRequest,
  ImportMemoryActionRequest,
  ProposalActionRequest,
  ReadImportPageRequest,
  SetImportLineRequest,
  SetImportPriceTargetRequest,
  SetImportSupplierRequest,
  UpdateImportProposalRequest,
} from '../../types/catalog-import-requests';
import { ANY_SLOT } from '../../types/product';
import { CATALOG_CHANNELS } from '../../vocabulary/channels';
import {
  IMPORT_LINE_BIND_LEVELS,
  IMPORT_LINE_MAX_TARGETS,
  IMPORT_MAX_FILE_BYTES,
  IMPORT_PRICE_FIELDS,
  IMPORT_PURPOSES,
  IMPORT_SOURCE_KINDS,
} from '../../vocabulary/catalog-import';
import { ASSET_URI_MAX_LENGTH } from '../../vocabulary/asset-fetch';
import { CATALOG_LIMITS } from '../../vocabulary/catalog-limits';
import { BRAND_FIELD, TRADE_IDENTITY_FIELDS } from '../../values/trade-identity';
import { attributeDefinitionSchema } from './attribute.schema';
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
  z.object({ kind: z.literal('noValueReason'), attributeId: entityIdSchema }),
  z.object({ kind: z.literal('tradeIdentity'), field: z.enum([...TRADE_IDENTITY_FIELDS, BRAND_FIELD]) }),
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
    priceListVersionId: entityIdSchema.nullable().optional(),
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

/** ADR-934 §5.2.2 Μ-β4 — η διεύθυνση κρίνεται στον γραφέα (πρέπει να τη ζητά η παρτίδα)· εδώ μόνο το σχήμα. */
export const fetchImportAssetBodySchema: z.ZodType<FetchImportAssetRequest> = z.object({
  uri: z.string().min(1).max(ASSET_URI_MAX_LENGTH),
  retry: z.boolean().optional(),
});

/** Κλειδιά πίνακα της ανασύνθεσης (`t0`, `t1`…): μικρά, χωρίς διαχωριστικά. */
const TABLE_KEY_MAX = 40;
const MAX_TABLE_LINE = 1000;

/** §5.5.2 Β3 Γ13: κάθε στόχος της γραμμής μία φορά — ούτε διπλότυπο στη λίστα, ούτε η κύρια ξανά. */
const distinctTargets = ({ attributeId, alsoAttributeIds }: { readonly attributeId: string; readonly alsoAttributeIds?: readonly string[] }): boolean =>
  alsoAttributeIds === undefined || new Set([attributeId, ...alsoAttributeIds]).size === alsoAttributeIds.length + 1;

const attributeLineDecisionSchema = z.object({
  kind: z.literal('attribute'),
  attributeId: entityIdSchema,
  alsoAttributeIds: z.array(entityIdSchema).min(1).max(IMPORT_LINE_MAX_TARGETS - 1).optional(),
}).refine(distinctTargets, { path: ['alsoAttributeIds'] });

// Το `discriminatedUnion` δέχεται μόνο σκέτα `z.object`: ο έλεγχος των στόχων μένει στο `refine` του κλάδου, γι' αυτό `union`.
const importLineDecisionSchema: z.ZodType<ImportLineDecision> = z.union([
  attributeLineDecisionSchema,
  z.object({ kind: z.literal('price'), unitCode: z.enum(UOM_CODES) }),
  z.object({ kind: z.literal('ignore') }),
  z.object({ kind: z.literal('axis'), attributeId: entityIdSchema }),
]);

export const setImportLineBodySchema: z.ZodType<SetImportLineRequest, z.ZodTypeDef, unknown> = z.object({
  page: z.number().int().min(1),
  table: z.string().min(1).max(TABLE_KEY_MAX),
  line: z.number().int().min(0).max(MAX_TABLE_LINE),
  decision: importLineDecisionSchema.nullable(),
  bind: z.enum(IMPORT_LINE_BIND_LEVELS).nullable(),
  // §5.5.2 Β9δ: η επιστροφή στη μνήμη υπάρχει μόνο ως αναίρεση — ποτέ δίπλα σε απόφαση.
  fallback: z.literal('memory').optional(),
  // §5.5.2 Β3 Γ11: τον ορισμό τον κρίνει ο γραφέας ιδιοτήτων (βιβλιοθήκη, ομάδα, μητρώο)· εδώ μόνο το σχήμα.
  create: z.object({
    definition: attributeDefinitionSchema,
    requiredChannels: z.array(z.enum(CATALOG_CHANNELS)).max(CATALOG_CHANNELS.length),  }).optional(),
}).refine((body) => body.fallback === undefined || body.decision === null, { path: ['fallback'] })
  .refine((body) => body.create === undefined || (body.decision === null && body.bind !== null && body.fallback === undefined), { path: ['create'] });

/** §5.5.2 Β7. Τον κωδικό και την ετικέτα τα κρίνει η απόδειξη (`withAxisOptions`) και ο γραφέας ιδιοτήτων· εδώ μόνο το σχήμα. */
export const addImportAxisOptionsBodySchema: z.ZodType<AddImportAxisOptionsRequest> = z.object({
  page: z.number().int().min(1),
  table: z.string().min(1).max(TABLE_KEY_MAX),
  attributeId: entityIdSchema,
  expectedRevision: expectedRevisionSchema,
  options: z.array(z.object({ code: z.string().max(100), label: z.string().max(CATALOG_LIMITS.maxLabelLength) })).max(CATALOG_LIMITS.maxSelectOptions),
});

const fieldAddress = { rowKey: z.string().min(1).max(200), targetKey: z.string().min(1).max(300) };

export const updateImportProposalBodySchema: z.ZodType<UpdateImportProposalRequest> = z.object({
  expectedRevision: expectedRevisionSchema,
  decisions: z.array(z.object({ ...fieldAddress, decision: z.enum(['accept', 'reject']).nullable() })).max(MAX_FIELD_CHANGES),
  // §5.5.2 Β10: η επιστροφή στη μνήμη τιμών υπάρχει μόνο μαζί με αναίρεση — ο πελάτης δεν δηλώνει ποτέ ο ίδιος προέλευση.
  edits: z.array(z.object({ ...fieldAddress, text: z.string().max(MAX_CELL_TEXT), revert: z.boolean().optional(), fallback: z.literal('memory').optional() })
    .refine((edit) => edit.fallback === undefined || edit.revert === true, { path: ['fallback'] })).max(MAX_FIELD_CHANGES),
  modelCode: z.string().max(CATALOG_LIMITS.maxLabelLength).nullable(),
});

export const proposalActionBodySchema: z.ZodType<ProposalActionRequest> = z.object({ expectedRevision: expectedRevisionSchema });

export const setImportPriceTargetBodySchema: z.ZodType<SetImportPriceTargetRequest> = z.object({
  expectedRevision: expectedRevisionSchema,
  priceListVersionId: entityIdSchema.nullable(),
});

export const setImportSupplierBodySchema: z.ZodType<SetImportSupplierRequest> = z.object({
  expectedRevision: expectedRevisionSchema,
  supplierContactId: entityIdSchema.nullable(),
  learnLabels: z.boolean().optional(),
});

/** §5.5.2 Β5.2: ρητή εφαρμογή / αναίρεση της μνήμης σε υπάρχουσα παρτίδα. */
export const importMemoryActionBodySchema: z.ZodType<ImportMemoryActionRequest> = z.object({ action: z.enum(['apply', 'undo']) });

/** §5.5.2 Β5.2: άδειασμα της μνήμης ενός προμηθευτή. */
export const clearLabelMemoryBodySchema: z.ZodType<ClearLabelMemoryRequest> = z.object({ supplierContactId: entityIdSchema });

export const saveImportProfileBodySchema = z.object({ definition: importProfileDefinitionSchema });
export const updateImportProfileBodySchema = z.object({ expectedRevision: expectedRevisionSchema, definition: importProfileDefinitionSchema });
