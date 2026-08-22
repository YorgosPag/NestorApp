/**
 * Furniture Zod Schemas (ADR-410) — strict runtime validation.
 *
 * Mirror of `mep-fixture.schemas.ts` for the mesh-based furniture entity.
 * Validates `FurnitureParams` + `FurnitureEntity` (incl. IfcEntityMixin fields).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-410-cc0-mesh-furniture-import.md
 */

import { z } from 'zod';
import { IfcGuidSchema, IfcPropertySetSchema } from './ifc-entity-mixin';
import { Point3DSchema } from './geometry.schemas';
import { SCENE_HOST_FIELDS } from './shared-params.schemas';

// ─── Point3D ──────────────────────────────────────────────────────────────────

// ─── Enums (mirror furniture-types.ts unions) ─────────────────────────────────

export const FurnitureKindSchema = z.enum([
  'chair',
  'table',
  'bed',
  'sofa',
  'armchair',
  'desk',
  'cabinet',
  'wardrobe',
  'bookshelf',
  'nightstand',
  'bench',
  'dresser',
  'stool',
  'tvStand',
]);

export const FurnitureIfcTypeSchema = z.literal('IfcFurniture');

// ─── Params schema ──────────────────────────────────────────────────────────

export const FurnitureParamsSchema = z
  .object({
    kind: FurnitureKindSchema,
    assetId: z.string().min(1),
    position: Point3DSchema,
    rotationDeg: z.number().finite(),
    widthMm: z.number().positive(),
    depthMm: z.number().positive(),
    heightMm: z.number().positive(),
    mountingElevationMm: z.number().finite(),
    scaleOverride: z.number().positive().optional(),
    ...SCENE_HOST_FIELDS,
  })
  .strict();

export type FurnitureParamsParsed = z.infer<typeof FurnitureParamsSchema>;

// ─── Entity schema (focused factory output) ───────────────────────────────────

export const FurnitureEntitySchema = z
  .object({
    id: z.string().min(1),
    type: z.literal('furniture'),
    kind: FurnitureKindSchema,
    params: FurnitureParamsSchema,
    ifcGuid: IfcGuidSchema,
    ifcType: FurnitureIfcTypeSchema,
    pset: IfcPropertySetSchema.optional(),
  })
  .passthrough();

export type FurnitureEntityParsed = z.infer<typeof FurnitureEntitySchema>;
