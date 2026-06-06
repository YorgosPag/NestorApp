/**
 * Roof Zod Schemas (ADR-417, Φ1).
 *
 * Strict runtime validation για `RoofParams` + `RoofEntity` (factory output).
 *   - `RoofParamsSchema` — footprint + per-edge slopes + slopeUnit + dna SSoT
 *     refinement (thickness == dna.totalThickness όταν υπάρχει dna).
 *   - `RoofEntitySchema` — factory output (params + type='roof' + IfcEntityMixin
 *     + ifcType='IfcRoof'). Δεν επικυρώνει BaseEntity tenant fields.
 *
 * @see bim/types/roof-types.ts
 * @see bim/types/slab.schemas.ts — το πρότυπο
 */

import { z } from 'zod';
import { IfcGuidSchema, IfcPropertySetSchema } from './ifc-entity-mixin';
import { SlabDnaSchema } from './slab.schemas';
import { RoofTypeParamsSchema } from './bim-family-type.schemas';

// ─── Primitive schemas ──────────────────────────────────────────────────────

const Point3DSchema = z
  .object({
    x: z.number().finite(),
    y: z.number().finite(),
    z: z.number().finite().optional(),
  })
  .strict();

const Polygon3DSchema = z
  .object({
    vertices: z.array(Point3DSchema).min(3),
  })
  .strict();

// ─── Enums ──────────────────────────────────────────────────────────────────

export const RoofKindSchema = z.literal('roof');
export const RoofSlopeUnitSchema = z.enum(['deg', 'percent']);
export const RoofIfcTypeSchema = z.literal('IfcRoof');

// ─── Per-edge slope ───────────────────────────────────────────────────────────

export const RoofEdgeSlopeSchema = z
  .object({
    definesSlope: z.boolean(),
    slope: z.number().finite(),
    overhangMm: z.number().finite(),
  })
  .strict();

// ─── Params schema ──────────────────────────────────────────────────────────

const RoofParamsBaseSchema = z
  .object({
    outline: Polygon3DSchema,
    edges: z.array(RoofEdgeSlopeSchema),
    slopeUnit: RoofSlopeUnitSchema,
    basePivotZ: z.number().finite(),
    thickness: z.number().positive(),
    dna: SlabDnaSchema.optional(),
    material: z.string().min(1).optional(),
    // ─── Eave detailing (ADR-417 Φ2b) — type-governed appearance (flows via
    // resolveEffectiveParams «type wins»). Overhang lives per-edge in `edges`. ──
    fasciaMaterial: z.string().min(1).optional(),
    soffitMaterial: z.string().min(1).optional(),
    fasciaHeightMm: z.number().positive().optional(),
    soffitMode: z.enum(['horizontal', 'sloped']).optional(),
    sceneUnits: z.string().optional(),
    storeyId: z.string().min(1).optional(),
    offsetFromStorey: z.number().finite().optional(),
  })
  .strict();

/**
 * RoofParamsSchema με refinements:
 *   - `edges.length` == `outline.vertices.length` (μία ακμή ανά κορυφή).
 *   - όταν υπάρχει `dna`, το `thickness` == `dna.totalThickness` (SSoT).
 */
export const RoofParamsSchema = RoofParamsBaseSchema.superRefine((data, ctx) => {
  if (data.edges.length !== data.outline.vertices.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['edges'],
      message: 'RoofParams: edges.length πρέπει να ισούται με outline.vertices.length.',
    });
  }
  if (data.dna !== undefined && Math.abs(data.thickness - data.dna.totalThickness) > 1e-3) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['thickness'],
      message: 'RoofParams: όταν υπάρχει dna, thickness πρέπει να ισούται με dna.totalThickness.',
    });
  }
});

export type RoofParamsParsed = z.infer<typeof RoofParamsSchema>;

// ─── Entity schema (factory output — focused) ───────────────────────────────

export const RoofEntitySchema = z
  .object({
    id: z.string().min(1),
    type: z.literal('roof'),
    kind: RoofKindSchema,
    params: RoofParamsSchema,
    ifcGuid: IfcGuidSchema,
    ifcType: RoofIfcTypeSchema,
    pset: IfcPropertySetSchema.optional(),
    // ADR-417 §10 #3 — family-type link (validated when present).
    typeId: z.string().min(1).optional(),
    typeOverrides: RoofTypeParamsSchema.partial().optional(),
  })
  .passthrough();

export type RoofEntityParsed = z.infer<typeof RoofEntitySchema>;
