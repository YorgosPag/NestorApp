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

// ─── Point3D ──────────────────────────────────────────────────────────────────

const Point3DSchema = z
  .object({
    x: z.number().finite(),
    y: z.number().finite(),
    z: z.number().finite().optional(),
  })
  .strict();

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
    sceneUnits: z.string().optional(),
    storeyId: z.string().min(1).optional(),
    material: z.string().min(1).optional(),
    hostId: z.string().min(1).optional(),
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
