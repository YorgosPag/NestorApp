/**
 * Railing Zod Schemas (ADR-407) — strict runtime validation.
 *
 * Mirror of `mep-fixture.schemas.ts` for the path-based railing. Validates the
 * full Revit-grade `RailingType` (Rail Structure[] + Baluster Placement +
 * Top/Handrail + Infill), `RailingParams`, and `RailingEntity` (incl.
 * IfcEntityMixin fields). Strict on params/type (catch typos); passthrough on the
 * entity (Firestore docs may carry extra tenant fields).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-407-bim-railings.md
 */

import { z } from 'zod';
import { IfcGuidSchema, IfcPropertySetSchema } from './ifc-entity-mixin';

// ─── Point3D ────────────────────────────────────────────────────────────────

const Point3DSchema = z
  .object({
    x: z.number().finite(),
    y: z.number().finite(),
    z: z.number().finite().optional(),
  })
  .strict();

// ─── Profile + enums ──────────────────────────────────────────────────────────

export const RailProfileSchema = z
  .object({
    shape: z.enum(['round', 'rectangular']),
    widthMm: z.number().positive(),
    heightMm: z.number().positive(),
  })
  .strict();

export const RailingKindSchema = z.enum(['railing']);
export const RailingPredefinedTypeSchema = z.enum(['handrail', 'guardrail', 'balustrade']);
export const RailingIfcTypeSchema = z.literal('IfcRailing');

// ─── RailingType sub-systems ──────────────────────────────────────────────────

export const RailStructureRailSchema = z
  .object({
    id: z.string().min(1),
    heightMm: z.number().finite(),
    lateralOffsetMm: z.number().finite(),
    profile: RailProfileSchema,
    material: z.string().min(1).optional(),
  })
  .strict();

export const BalusterPlacementSchema = z
  .object({
    pattern: z
      .object({
        profile: RailProfileSchema,
        spacingMm: z.number().positive(),
        justification: z.enum(['start', 'center', 'end']),
        material: z.string().min(1).optional(),
      })
      .strict(),
    posts: z
      .object({
        enabled: z.boolean(),
        profile: RailProfileSchema,
        atStart: z.boolean(),
        atCorners: z.boolean(),
        atEnd: z.boolean(),
        spacingMm: z.number().positive().optional(),
        material: z.string().min(1).optional(),
      })
      .strict(),
    perTread: z
      .object({ count: z.union([z.literal(1), z.literal(2)]) })
      .strict()
      .optional(),
  })
  .strict();

export const ContinuousRailSchema = z
  .object({
    enabled: z.boolean(),
    profile: RailProfileSchema,
    heightMm: z.number().finite(),
    extension: z
      .object({
        topMm: z.number().finite().optional(),
        bottom: z.union([z.literal('one-tread'), z.number().finite()]).optional(),
        returnToWall: z.boolean().optional(),
      })
      .strict(),
    material: z.string().min(1).optional(),
  })
  .strict();

export const RailingInfillSchema = z
  .object({
    kind: z.enum(['none', 'glass', 'mesh', 'solid']),
    thicknessMm: z.number().positive().optional(),
    material: z.string().min(1).optional(),
  })
  .strict();

export const RailingTypeSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    predefinedType: RailingPredefinedTypeSchema,
    railStructure: z.array(RailStructureRailSchema),
    balusterPlacement: BalusterPlacementSchema,
    topRail: ContinuousRailSchema,
    handrail: ContinuousRailSchema,
    infill: RailingInfillSchema,
  })
  .strict();

// ─── Path source ──────────────────────────────────────────────────────────────

export const RailingPathSourceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('sketch'), path: z.array(Point3DSchema) }).strict(),
  z
    .object({
      kind: z.literal('hosted'),
      hostId: z.string().min(1),
      hostType: z.enum(['stair', 'slab-edge', 'ramp']),
      side: z.enum(['inner', 'outer']).optional(),
    })
    .strict(),
]);

// ─── Params schema ──────────────────────────────────────────────────────────

export const RailingParamsSchema = z
  .object({
    type: RailingTypeSchema,
    pathSource: RailingPathSourceSchema,
    totalHeightMm: z.number().positive(),
    baseElevationMm: z.number().finite(),
    sceneUnits: z.string().optional(),
    storeyId: z.string().min(1).optional(),
  })
  .strict();

export type RailingParamsParsed = z.infer<typeof RailingParamsSchema>;

// ─── Entity schema (focused factory output) ─────────────────────────────────

export const RailingEntitySchema = z
  .object({
    id: z.string().min(1),
    type: z.literal('railing'),
    kind: RailingKindSchema,
    params: RailingParamsSchema,
    ifcGuid: IfcGuidSchema,
    ifcType: RailingIfcTypeSchema,
    pset: IfcPropertySetSchema.optional(),
  })
  .passthrough();

export type RailingEntityParsed = z.infer<typeof RailingEntitySchema>;
