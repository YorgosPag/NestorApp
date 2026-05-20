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
    material: z.string().min(1).optional(),
    lshape: ColumnLshapeParamsSchema.optional(),
    tshape: ColumnTshapeParamsSchema.optional(),
    sceneUnits: z.string().optional(),
    // ─── ADR-369 §9 Q5 binding ──────────────────────────────────────────────
    baseBinding: ColumnBaseBindingSchema,
    topBinding: ColumnTopBindingSchema,
    baseOffset: z.number().finite(),
    topOffset: z.number().finite(),
    unconnectedHeight: z.number().positive().optional(),
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
