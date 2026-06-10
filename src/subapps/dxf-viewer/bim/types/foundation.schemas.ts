/**
 * Foundation Zod Schemas (ADR-436, Slice 0).
 *
 * Mirror του `column.schemas.ts`. Strict runtime validation για `FoundationParams`
 * (discriminated union ανά `kind`) + `FoundationEntity` με IfcEntityMixin πεδία.
 *
 * Refinements (pad):
 *   - profile='stepped' MUST provide `stepped` block.
 *   - profile='sloped'  MUST provide `sloped` block.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-436-bim-foundation-discipline.md
 */

import { z } from 'zod';
import {
  IfcGuidSchema,
  IfcPropertySetSchema,
} from './ifc-entity-mixin';

// ─── Point3D ──────────────────────────────────────────────────────────────────

const Point3DSchema = z
  .object({
    x: z.number().finite(),
    y: z.number().finite(),
    z: z.number().finite().optional(),
  })
  .strict();

// ─── Enums (mirror foundation-types.ts unions) ───────────────────────────────

export const FoundationKindSchema = z.enum(['pad', 'strip', 'tie-beam']);

export const FoundationProfileSchema = z.enum(['flat', 'stepped', 'sloped']);

export const FoundationAnchorSchema = z.enum([
  'center', 'n', 's', 'e', 'w', 'nw', 'ne', 'sw', 'se',
]);

export const FoundationPredefinedTypeSchema = z.enum([
  'PAD_FOOTING', 'STRIP_FOOTING', 'FOOTING_BEAM',
]);

export const FoundationIfcTypeSchema = z.literal('IfcFooting');

// ─── Variant sub-param schemas ───────────────────────────────────────────────

const PadSteppedParamsSchema = z
  .object({
    topWidth: z.number().positive(),
    topLength: z.number().positive(),
    stepThicknessMm: z.number().positive(),
  })
  .strict();

const PadSlopedParamsSchema = z
  .object({
    topWidth: z.number().positive(),
    topLength: z.number().positive(),
  })
  .strict();

// ─── Common params shape (shared across discriminated-union members) ──────────

const CommonParamsShape = {
  topElevationMm: z.number().finite(),
  thicknessMm: z.number().positive(),
  material: z.string().min(1).optional(),
  sceneUnits: z.string().optional(),
  storeyId: z.string().min(1).optional(),
  offsetFromStorey: z.number().finite().optional(),
  catalogProfile: z.string().min(1).optional(),
};

// ─── Per-kind param schemas (plain objects — required by discriminatedUnion) ──

const PadFootingParamsSchema = z
  .object({
    kind: z.literal('pad'),
    ...CommonParamsShape,
    position: Point3DSchema,
    width: z.number().positive(),
    length: z.number().positive(),
    rotation: z.number().finite(),
    anchor: FoundationAnchorSchema,
    profile: FoundationProfileSchema,
    stepped: PadSteppedParamsSchema.optional(),
    sloped: PadSlopedParamsSchema.optional(),
  })
  .strict();

const StripFootingParamsSchema = z
  .object({
    kind: z.literal('strip'),
    ...CommonParamsShape,
    start: Point3DSchema,
    end: Point3DSchema,
    width: z.number().positive(),
  })
  .strict();

const TieBeamParamsSchema = z
  .object({
    kind: z.literal('tie-beam'),
    ...CommonParamsShape,
    start: Point3DSchema,
    end: Point3DSchema,
    width: z.number().positive(),
  })
  .strict();

// ─── Params union schema ──────────────────────────────────────────────────────

const FoundationParamsBaseSchema = z.discriminatedUnion('kind', [
  PadFootingParamsSchema,
  StripFootingParamsSchema,
  TieBeamParamsSchema,
]);

export const FoundationParamsSchema = FoundationParamsBaseSchema.superRefine(
  (data, ctx) => {
    if (data.kind === 'pad') {
      if (data.profile === 'stepped' && data.stepped === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['stepped'],
          message: "PadFootingParams: profile='stepped' απαιτεί stepped block.",
        });
      }
      if (data.profile === 'sloped' && data.sloped === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['sloped'],
          message: "PadFootingParams: profile='sloped' απαιτεί sloped block.",
        });
      }
    }
  },
);

export type FoundationParamsParsed = z.infer<typeof FoundationParamsSchema>;

// ─── Entity schema (focused factory output) ──────────────────────────────────

export const FoundationEntitySchema = z
  .object({
    id: z.string().min(1),
    type: z.literal('foundation'),
    kind: FoundationKindSchema,
    params: FoundationParamsSchema,
    predefinedType: FoundationPredefinedTypeSchema,
    ifcGuid: IfcGuidSchema,
    ifcType: FoundationIfcTypeSchema,
    pset: IfcPropertySetSchema.optional(),
  })
  .passthrough();

export type FoundationEntityParsed = z.infer<typeof FoundationEntitySchema>;
