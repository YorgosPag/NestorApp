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
 *   - topBinding='attached' MUST provide non-empty `attachTopToIds` (ADR-401).
 *   - topBinding !== 'attached' MUST NOT provide `attachTopToIds`.
 *   - baseBinding='attached' MUST provide non-empty `attachBaseToIds` (ADR-401 γ).
 *   - baseBinding !== 'attached' MUST NOT provide `attachBaseToIds`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-369-bim-elevation-convention-revit-alignment.md §9 Q5, Q8
 * @see docs/centralized-systems/reference/adrs/ADR-401-bim-wall-top-base-constraints-attach-to-structural.md §2.1
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
import { EnvelopeFunctionSchema } from './thermal-envelope.schemas';

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

// ─── ADR-404 — tilt (battered wall) ─────────────────────────────────────────

const WallTiltSchema = z
  .object({
    angle: z.number().finite(),
  })
  .strict();

// ─── Params schema ──────────────────────────────────────────────────────────

const WallParamsBaseSchema = z
  .object({
    category: WallCategorySchema,
    start: Point3DSchema,
    end: Point3DSchema,
    height: z.number().positive(),
    thickness: z.number().positive(),
    flip: z.boolean(),
    // ─── ADR-404 — 3Δ κλίση (optional, absent = κατακόρυφος) ──────────────────
    tilt: WallTiltSchema.optional(),
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
    // ─── ADR-401 — Attach-to-structural ───────────────────────────────────────
    attachTopToIds: z.array(z.string().min(1)).optional(),
    attachBaseToIds: z.array(z.string().min(1)).optional(),
    // ─── ADR-396 v2 Φάση 4 — ETICS classification override (Στρ.3) ─────────────
    envelopeFunction: EnvelopeFunctionSchema.optional(),
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
  // ─── ADR-401 — attach refinement ──────────────────────────────────────────
  if (data.topBinding === 'attached' && (data.attachTopToIds === undefined || data.attachTopToIds.length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['attachTopToIds'],
      message: "WallParams: topBinding='attached' απαιτεί ≥1 attachTopToIds (host FK).",
    });
  }
  if (data.topBinding !== 'attached' && data.attachTopToIds !== undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['attachTopToIds'],
      message: "WallParams: attachTopToIds επιτρέπεται μόνο όταν topBinding='attached'.",
    });
  }
  // ─── ADR-401 (γ) — base attach refinement ─────────────────────────────────
  if (data.baseBinding === 'attached' && (data.attachBaseToIds === undefined || data.attachBaseToIds.length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['attachBaseToIds'],
      message: "WallParams: baseBinding='attached' απαιτεί ≥1 attachBaseToIds (host FK).",
    });
  }
  if (data.baseBinding !== 'attached' && data.attachBaseToIds !== undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['attachBaseToIds'],
      message: "WallParams: attachBaseToIds επιτρέπεται μόνο όταν baseBinding='attached'.",
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
