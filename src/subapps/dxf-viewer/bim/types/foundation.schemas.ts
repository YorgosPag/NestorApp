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
import { GuideBindingsSchema } from './guide-binding.schemas';
import {
  BeamRebarLayerSchema,
  BeamReinforcementSchema,
  BeamStirrupsSchema,
} from './beam.schemas';

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

/** ADR-441 Slice 5a — Location Line γραμμικού πεδίλου/συνδετήριας. */
export const StripJustificationSchema = z.enum(['center', 'left', 'right']);

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

// ─── ADR-459 Phase 4b — οπλισμός θεμελίωσης (strict, per-kind) ─────────────────

/** Σχάρα/πλέγμα ράβδων (Ø/βήμα). */
const RebarMeshSchema = z
  .object({
    diameterMm: z.number().positive(),
    spacingMm: z.number().positive(),
  })
  .strict();

/** Οπλισμός πεδίλου — δι-διευθυντική κάτω σχάρα + προαιρετική άνω. */
const PadReinforcementSchema = z
  .object({
    kind: z.literal('pad'),
    bottomMeshX: RebarMeshSchema,
    bottomMeshY: RebarMeshSchema,
    topMesh: RebarMeshSchema.optional(),
    coverMm: z.number().positive(),
  })
  .strict();

/** Οπλισμός πεδιλοδοκού — εγκάρσιες + διαμήκεις διανομής + προαιρετικοί συνδετήρες (reuse beam). */
const StripReinforcementSchema = z
  .object({
    kind: z.literal('strip'),
    transverse: RebarMeshSchema,
    longitudinal: BeamRebarLayerSchema,
    stirrups: BeamStirrupsSchema.optional(),
    coverMm: z.number().positive(),
  })
  .strict();

/** Οπλισμός συνδετήριας δοκού — REUSE BeamReinforcementSchema + discriminator. */
const TieBeamReinforcementSchema = BeamReinforcementSchema.extend({
  kind: z.literal('tie-beam'),
});

// ─── Common params shape (shared across discriminated-union members) ──────────

const CommonParamsShape = {
  topElevationMm: z.number().finite(),
  thicknessMm: z.number().positive(),
  material: z.string().min(1).optional(),
  sceneUnits: z.string().optional(),
  storeyId: z.string().min(1).optional(),
  offsetFromStorey: z.number().finite().optional(),
  catalogProfile: z.string().min(1).optional(),
  // ADR-459 Phase 7 — provenance flag (auto-foundation reconciler ownership).
  autoDesigned: z.boolean().optional(),
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
    reinforcement: PadReinforcementSchema.optional(),
  })
  .strict();

const StripFootingParamsSchema = z
  .object({
    kind: z.literal('strip'),
    ...CommonParamsShape,
    start: Point3DSchema,
    end: Point3DSchema,
    width: z.number().positive(),
    justification: StripJustificationSchema.optional(),
    justificationManual: z.boolean().optional(),
    reinforcement: StripReinforcementSchema.optional(),
  })
  .strict();

const TieBeamParamsSchema = z
  .object({
    kind: z.literal('tie-beam'),
    ...CommonParamsShape,
    start: Point3DSchema,
    end: Point3DSchema,
    width: z.number().positive(),
    justification: StripJustificationSchema.optional(),
    justificationManual: z.boolean().optional(),
    reinforcement: TieBeamReinforcementSchema.optional(),
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
    // ADR-441 — associative grid hosting (Slice 0). Optional → backward-compatible.
    guideBindings: GuideBindingsSchema,
  })
  .passthrough();

export type FoundationEntityParsed = z.infer<typeof FoundationEntitySchema>;
