/**
 * Wall Zod Schemas (ADR-369 §9 Q5 + Q8) — Phase A3
 *
 * Strict runtime validation για WallParams + WallEntity, με focus στα νέα
 * ADR-369 πεδία (binding + IfcEntityMixin). Καλύπτει:
 *   - `WallParamsSchema`  — full param validation (existing + binding fields).
 *   - `WallEntitySchema`  — focused factory output validation (params + kind +
 *     IfcEntityMixin + type='wall'). Δεν επικυρώνει BaseEntity tenant fields
 *     (createdAt/updatedAt/etc) — αυτό κάνει το persistence layer.
 *
 * Refinements:
 *   - topBinding='unconnected' MUST provide positive `unconnectedHeight`.
 *   - topBinding !== 'unconnected' MUST NOT provide `unconnectedHeight`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-369-bim-elevation-convention-revit-alignment.md §9 Q5, Q8
 */

import { z } from 'zod';
import {
  WallBaseBindingSchema,
  WallTopBindingSchema,
} from './bim-binding';
import {
  IfcGuidSchema,
  IfcPropertySetSchema,
} from './ifc-entity-mixin';

// ─── Primitive schemas (Point3D) ─────────────────────────────────────────────

const Point3DSchema = z
  .object({
    x: z.number().finite(),
    y: z.number().finite(),
    z: z.number().finite().optional(),
  })
  .strict();

// ─── Enums (mirror wall-types.ts unions) ─────────────────────────────────────

export const WallKindSchema = z.enum(['straight', 'curved', 'polyline']);

export const WallCategorySchema = z.enum([
  'exterior',
  'interior',
  'partition',
  'parapet',
  'fence',
]);

// ─── IfcType narrowed for Wall ──────────────────────────────────────────────

/** Wall-specific IFC4 classes (subset of IfcEntityType). */
export const WallIfcTypeSchema = z.enum(['IfcWall', 'IfcWallStandardCase']);

// ─── Params schema ──────────────────────────────────────────────────────────

const WallParamsBaseSchema = z
  .object({
    category: WallCategorySchema,
    start: Point3DSchema,
    end: Point3DSchema,
    height: z.number().positive(),
    thickness: z.number().positive(),
    flip: z.boolean(),
    measurementLength: z.number().positive().optional(),
    // dna: opaque pass-through (validated by wall-dna-types layer)
    dna: z.unknown().optional(),
    startBevel: z.number().min(0).optional(),
    endBevel: z.number().min(0).optional(),
    polylineVertices: z.array(Point3DSchema).optional(),
    curveControl: Point3DSchema.optional(),
    material: z.string().min(1).optional(),
    sceneUnits: z.string().optional(),
    storeyId: z.string().min(1).optional(),
    offsetFromStorey: z.number().finite().optional(),
    // ─── ADR-369 §9 Q5 binding ──────────────────────────────────────────────
    baseBinding: WallBaseBindingSchema,
    topBinding: WallTopBindingSchema,
    baseOffset: z.number().finite(),
    topOffset: z.number().finite(),
    unconnectedHeight: z.number().positive().optional(),
  })
  .strict();

/**
 * WallParamsSchema με refinement για unconnected validation.
 * Reject αν:
 *   - topBinding='unconnected' && !unconnectedHeight
 *   - topBinding !== 'unconnected' && unconnectedHeight !== undefined
 */
export const WallParamsSchema = WallParamsBaseSchema.superRefine((data, ctx) => {
  if (data.topBinding === 'unconnected' && data.unconnectedHeight === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['unconnectedHeight'],
      message:
        "WallParams: topBinding='unconnected' απαιτεί unconnectedHeight (mm > 0).",
    });
  }
  if (data.topBinding !== 'unconnected' && data.unconnectedHeight !== undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['unconnectedHeight'],
      message:
        "WallParams: unconnectedHeight επιτρέπεται μόνο όταν topBinding='unconnected'.",
    });
  }
});

export type WallParamsParsed = z.infer<typeof WallParamsSchema>;

// ─── Entity schema (factory output — focused) ───────────────────────────────

/**
 * Validates the ADR-369-relevant shape of a WallEntity emitted από factory:
 *   id, type='wall', kind, params (full WallParams), ifcGuid, ifcType, pset?
 * Επιπλέον BaseEntity πεδία (geometry, validation, tenant scope) ΔΕΝ
 * επικυρώνονται εδώ — αρμοδιότητα persistence layer.
 */
export const WallEntitySchema = z
  .object({
    id: z.string().min(1),
    type: z.literal('wall'),
    kind: WallKindSchema,
    params: WallParamsSchema,
    ifcGuid: IfcGuidSchema,
    ifcType: WallIfcTypeSchema,
    pset: IfcPropertySetSchema.optional(),
  })
  // Allow other BaseEntity-derived fields without validating them here.
  .passthrough();

export type WallEntityParsed = z.infer<typeof WallEntitySchema>;
