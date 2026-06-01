/**
 * Column Zod Schemas (ADR-369 §9 Q5 + Q8) — Phase A3
 *
 * Mirror του wall.schemas.ts. Strict runtime validation για ColumnParams +
 * ColumnEntity με ADR-369 binding + IfcEntityMixin πεδία.
 *
 * Refinements:
 *   - topBinding='unconnected' MUST provide positive `unconnectedHeight`.
 *   - topBinding !== 'unconnected' MUST NOT provide `unconnectedHeight`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-369-bim-elevation-convention-revit-alignment.md §9 Q5, Q8
 */

import { z } from 'zod';
import {
  ColumnBaseBindingSchema,
  ColumnTopBindingSchema,
} from './bim-binding';
import {
  IfcGuidSchema,
  IfcPropertySetSchema,
} from './ifc-entity-mixin';
import {
  EnvelopeFunctionSchema,
  EnvelopeLayerSchema,
} from './thermal-envelope.schemas';

// ─── Point3D ────────────────────────────────────────────────────────────────

const Point3DSchema = z
  .object({
    x: z.number().finite(),
    y: z.number().finite(),
    z: z.number().finite().optional(),
  })
  .strict();

// ─── Enums (mirror column-types.ts unions) ───────────────────────────────────

export const ColumnKindSchema = z.enum([
  'rectangular',
  'circular',
  'L-shape',
  'T-shape',
]);

export const ColumnAnchorSchema = z.enum([
  'center',
  'n',
  's',
  'e',
  'w',
  'nw',
  'ne',
  'sw',
  'se',
]);

export const ColumnIfcTypeSchema = z.literal('IfcColumn');

// ─── Variant sub-param schemas ──────────────────────────────────────────────

const ColumnLshapeParamsSchema = z
  .object({
    armLength: z.number().positive().optional(),
    armWidth: z.number().positive().optional(),
    flipY: z.boolean().optional(),
  })
  .strict();

const ColumnTshapeParamsSchema = z
  .object({
    flangeLength: z.number().positive().optional(),
    webThickness: z.number().positive().optional(),
    flipY: z.boolean().optional(),
  })
  .strict();

// ─── ADR-404 — tilt (raking column) ─────────────────────────────────────────

const ColumnTiltSchema = z
  .object({
    direction: z.number().finite(),
    angle: z.number().finite(),
  })
  .strict();

// ─── Params schema ──────────────────────────────────────────────────────────

const ColumnParamsBaseSchema = z
  .object({
    kind: ColumnKindSchema,
    position: Point3DSchema,
    anchor: ColumnAnchorSchema,
    width: z.number().positive(),
    depth: z.number().positive(),
    height: z.number().positive(),
    rotation: z.number().finite(),
    // ─── ADR-404 — 3Δ κλίση (optional, absent = κατακόρυφη) ───────────────────
    tilt: ColumnTiltSchema.optional(),
    material: z.string().min(1).optional(),
    lshape: ColumnLshapeParamsSchema.optional(),
    tshape: ColumnTshapeParamsSchema.optional(),
    sceneUnits: z.string().optional(),
    storeyId: z.string().min(1).optional(),
    offsetFromStorey: z.number().finite().optional(),
    // ─── ADR-369 §9 Q5 binding ──────────────────────────────────────────────
    baseBinding: ColumnBaseBindingSchema,
    topBinding: ColumnTopBindingSchema,
    baseOffset: z.number().finite(),
    topOffset: z.number().finite(),
    unconnectedHeight: z.number().positive().optional(),
    // ─── ADR-401 Phase F — Attach-to-structural (mirror wall.schemas.ts) ───────
    attachTopToIds: z.array(z.string().min(1)).optional(),
    attachBaseToIds: z.array(z.string().min(1)).optional(),
    // ─── ADR-396 P7 — ETICS exterior insulation layer (Z1) ───────────────────
    envelopeLayer: EnvelopeLayerSchema.optional(),
    // ─── ADR-396 v2 Φάση 4 — ETICS classification override (Στρ.3) ─────────────
    envelopeFunction: EnvelopeFunctionSchema.optional(),
  })
  .strict();

export const ColumnParamsSchema = ColumnParamsBaseSchema.superRefine(
  (data, ctx) => {
    if (data.topBinding === 'unconnected' && data.unconnectedHeight === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['unconnectedHeight'],
        message:
          "ColumnParams: topBinding='unconnected' απαιτεί unconnectedHeight (mm > 0).",
      });
    }
    if (data.topBinding !== 'unconnected' && data.unconnectedHeight !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['unconnectedHeight'],
        message:
          "ColumnParams: unconnectedHeight επιτρέπεται μόνο όταν topBinding='unconnected'.",
      });
    }
    // ─── ADR-401 Phase F — top attach refinement ──────────────────────────────
    if (data.topBinding === 'attached' && (data.attachTopToIds === undefined || data.attachTopToIds.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['attachTopToIds'],
        message: "ColumnParams: topBinding='attached' απαιτεί ≥1 attachTopToIds (host FK).",
      });
    }
    if (data.topBinding !== 'attached' && data.attachTopToIds !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['attachTopToIds'],
        message: "ColumnParams: attachTopToIds επιτρέπεται μόνο όταν topBinding='attached'.",
      });
    }
    // ─── ADR-401 Phase F (base) — base attach refinement ──────────────────────
    if (data.baseBinding === 'attached' && (data.attachBaseToIds === undefined || data.attachBaseToIds.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['attachBaseToIds'],
        message: "ColumnParams: baseBinding='attached' απαιτεί ≥1 attachBaseToIds (host FK).",
      });
    }
    if (data.baseBinding !== 'attached' && data.attachBaseToIds !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['attachBaseToIds'],
        message: "ColumnParams: attachBaseToIds επιτρέπεται μόνο όταν baseBinding='attached'.",
      });
    }
  },
);

export type ColumnParamsParsed = z.infer<typeof ColumnParamsSchema>;

// ─── Entity schema (focused factory output) ─────────────────────────────────

export const ColumnEntitySchema = z
  .object({
    id: z.string().min(1),
    type: z.literal('column'),
    kind: ColumnKindSchema,
    params: ColumnParamsSchema,
    ifcGuid: IfcGuidSchema,
    ifcType: ColumnIfcTypeSchema,
    pset: IfcPropertySetSchema.optional(),
  })
  .passthrough();

export type ColumnEntityParsed = z.infer<typeof ColumnEntitySchema>;
