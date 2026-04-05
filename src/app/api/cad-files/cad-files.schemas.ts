/**
 * 📐 CAD FILES API — Zod Schemas (ADR-288)
 *
 * Validation for the centralized cadFiles metadata endpoint. All writes from
 * DXF auto-save / wizard upload flows go through these schemas.
 */

import { z } from 'zod';

/** Single security validation result (loose — producer owns the shape) */
const SecurityValidationResultSchema = z
  .object({
    isValid: z.boolean(),
  })
  .passthrough();

/** Aggregated security validation snapshot persisted alongside metadata */
const SecurityValidationSchema = z.object({
  validationResults: z.array(SecurityValidationResultSchema),
  isSecure: z.boolean(),
});

/**
 * Optional entity-link context for dual-write to the `files` collection
 * (enterprise FileRecord schema). When absent, dual-write uses defaults.
 */
const FilesContextSchema = z
  .object({
    projectId: z.string().max(128).optional(),
    buildingId: z.string().max(128).optional(),
    floorId: z.string().max(128).optional(),
    entityType: z.enum(['building', 'floor', 'property']).optional(),
    filesCategory: z.enum(['drawings', 'floorplans']).optional(),
    purpose: z.string().max(200).optional(),
    entityLabel: z.string().max(300).optional(),
    canonicalScenePath: z.string().max(1000).optional(),
  })
  .optional();

/**
 * Upsert schema — client supplies fileId.
 * - If the doc exists (same tenant) → metadata is updated, version incremented.
 * - If the doc does not exist → doc is created with this fileId, version=1.
 *
 * The client-supplied fileId is trusted because enterprise-id.service is used
 * client-side to pre-generate it. Tenant isolation is enforced server-side.
 */
export const UpsertCadFileSchema = z.object({
  fileId: z.string().min(1).max(128),
  fileName: z.string().min(1).max(300),
  storageUrl: z.string().min(1).max(2000),
  storagePath: z.string().min(1).max(1000),
  sizeBytes: z.number().int().min(0).max(5_000_000_000),
  entityCount: z.number().int().min(0).max(10_000_000),
  checksum: z.string().max(64).optional(),
  securityValidation: SecurityValidationSchema.optional(),
  context: FilesContextSchema,
});

export type UpsertCadFileInput = z.infer<typeof UpsertCadFileSchema>;
