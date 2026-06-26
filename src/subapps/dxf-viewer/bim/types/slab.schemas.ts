/**
 * Slab Zod Schemas (ADR-369 §9 Q7 + Q8) — Phase A4
 *
 * Strict runtime validation για SlabParams + SlabEntity, focused στα νέα
 * ADR-369 πεδία (top-face semantic + geometryType + IfcEntityMixin).
 *
 *   - `SlabParamsSchema`  — full param validation με geometryType↔slope
 *     superRefine discriminator.
 *   - `SlabEntitySchema`  — factory output validation (params + kind +
 *     IfcEntityMixin + type='slab'). Δεν επικυρώνει BaseEntity tenant fields.
 *
 * Refinements (superRefine):
 *   - `geometryType='tilted'` MUST provide `slope`.
 *   - `geometryType='box'` MUST NOT provide `slope`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-369-bim-elevation-convention-revit-alignment.md §9 Q7, Q8
 */

import { z } from 'zod';
import {
  IfcGuidSchema,
  IfcPropertySetSchema,
} from './ifc-entity-mixin';
import { EnvelopeLayerSchema } from './thermal-envelope.schemas';

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

// ─── Enums (mirror slab-types.ts unions) ─────────────────────────────────────

export const SlabKindSchema = z.enum([
  'floor',
  'ceiling',
  'roof',
  'ground',
  'foundation',
]);

export const SlabReinforcementSchema = z.enum([
  'one-way',
  'two-way',
  'waffle',
  'flat',
]);

/** ADR-369 §9 Q7 Phase 1 subset — mesh deferred. */
export const SlabGeometryTypeSchema = z.enum(['box', 'tilted']);

export const SlabPivotEdgeSchema = z.enum(['N', 'S', 'E', 'W', 'center']);

/** Slab-specific IFC4 class. */
export const SlabIfcTypeSchema = z.literal('IfcSlab');

/** Slab layer functional zone (Revit Core Boundary). */
export const SlabLayerZoneSchema = z.enum(['top', 'core', 'bottom']);

// ─── DNA build-up schema (composite slab types) ──────────────────────────────

export const SlabDnaLayerSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    thickness: z.number().positive(),
    materialId: z.string().min(1),
    zone: SlabLayerZoneSchema,
  })
  .strict();

export const SlabDnaSchema = z
  .object({
    layers: z.array(SlabDnaLayerSchema).min(1),
    totalThickness: z.number().positive(),
  })
  .strict();

// ─── Slope schema (required when geometryType='tilted') ──────────────────────

export const SlabSlopeSchema = z
  .object({
    direction: z.number().finite(),
    angle: z.number().positive(),
    pivotEdge: SlabPivotEdgeSchema.optional(),
  })
  .strict();

// ─── Params schema ──────────────────────────────────────────────────────────

const SlabParamsBaseSchema = z
  .object({
    kind: SlabKindSchema,
    outline: Polygon3DSchema,
    levelElevation: z.number().finite(),
    heightOffsetFromLevel: z.number().finite().optional(),
    thickness: z.number().positive(),
    geometryType: SlabGeometryTypeSchema,
    slope: SlabSlopeSchema.optional(),
    slabOpeningIds: z.array(z.string().min(1)).optional(),
    reinforcement: SlabReinforcementSchema.optional(),
    material: z.string().min(1).optional(),
    dna: SlabDnaSchema.optional(),
    sceneUnits: z.string().optional(),
    storeyId: z.string().min(1).optional(),
    offsetFromStorey: z.number().finite().optional(),
    // ─── ADR-396 P7 — ETICS exposed-slab insulation layer (Z2 soffit / Z3 top)
    envelopeLayer: EnvelopeLayerSchema.optional(),
    // ─── ADR-534 Φ4 — soffit finish (ceiling paint/plaster, references wall-covering catalog)
    soffitFinish: z.object({ materialId: z.string().min(1) }).optional(),
  })
  .strict();

/**
 * SlabParamsSchema με refinement για geometryType↔slope discriminator.
 * Reject αν:
 *   - geometryType='tilted' && !slope
 *   - geometryType='box'    && slope !== undefined
 */
export const SlabParamsSchema = SlabParamsBaseSchema.superRefine((data, ctx) => {
  if (data.geometryType === 'tilted' && data.slope === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['slope'],
      message:
        "SlabParams: geometryType='tilted' απαιτεί slope (direction + angle).",
    });
  }
  if (data.geometryType === 'box' && data.slope !== undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['slope'],
      message:
        "SlabParams: slope επιτρέπεται μόνο όταν geometryType='tilted'.",
    });
  }
  // SSoT: όταν υπάρχει dna, το thickness παράγεται από το totalThickness
  // (μηδέν διπλο-καταχώρηση — ίδιος κανόνας με WallParams.thickness).
  if (
    data.dna !== undefined &&
    Math.abs(data.thickness - data.dna.totalThickness) > 1e-3
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['thickness'],
      message:
        'SlabParams: όταν υπάρχει dna, thickness πρέπει να ισούται με dna.totalThickness.',
    });
  }
});

export type SlabParamsParsed = z.infer<typeof SlabParamsSchema>;

// ─── Entity schema (factory output — focused) ───────────────────────────────

/**
 * Validates the ADR-369-relevant shape of a SlabEntity emitted από factory:
 *   id, type='slab', kind, params (full SlabParams), ifcGuid, ifcType='IfcSlab', pset?
 * Επιπλέον BaseEntity πεδία (geometry, validation, tenant scope) ΔΕΝ
 * επικυρώνονται εδώ — αρμοδιότητα persistence layer.
 */
export const SlabEntitySchema = z
  .object({
    id: z.string().min(1),
    type: z.literal('slab'),
    kind: SlabKindSchema,
    params: SlabParamsSchema,
    ifcGuid: IfcGuidSchema,
    ifcType: SlabIfcTypeSchema,
    pset: IfcPropertySetSchema.optional(),
  })
  .passthrough();

export type SlabEntityParsed = z.infer<typeof SlabEntitySchema>;
