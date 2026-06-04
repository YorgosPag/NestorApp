/**
 * MEP Segment Zod Schemas (ADR-408 Φ8) — strict runtime validation.
 *
 * Validates `MepSegmentParams` + the persisted `MepSegmentEntity` shape. Mirror
 * of `mep-fixture.schemas.ts` / `beam` schemas. The `connectors` array reuses the
 * shared {@link MepConnectorSchema} (forward hook for duct/pipe systems).
 *
 * @see ./mep-segment-types.ts
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md §Φ8
 */

import { z } from 'zod';
import { MepConnectorSchema, PlumbingSystemClassificationSchema } from './mep-connector.schemas';

const Point3DSchema = z
  .object({
    x: z.number().finite(),
    y: z.number().finite(),
    z: z.number().finite().optional(),
  })
  .strict();

export const MepSegmentDomainSchema = z.enum(['duct', 'pipe']);

export const MepSegmentSectionKindSchema = z.enum(['rectangular', 'round']);

export const MepSegmentIfcTypeSchema = z.enum(['IfcDuctSegment', 'IfcPipeSegment']);

const SceneUnitsSchema = z.enum(['mm', 'cm', 'm']);

export const MepSegmentParamsSchema = z
  .object({
    domain: MepSegmentDomainSchema,
    sectionKind: MepSegmentSectionKindSchema,
    startPoint: Point3DSchema,
    endPoint: Point3DSchema,
    width: z.number().positive().optional(),
    height: z.number().positive().optional(),
    diameter: z.number().positive().optional(),
    wallThickness: z.number().positive().optional(),
    centerlineElevationMm: z.number().finite(),
    material: z.string().min(1).optional(),
    // ADR-408 Φ14 — drainage/plumbing instance hints (System owns classification once joined).
    classification: PlumbingSystemClassificationSchema.optional(),
    slopePercent: z.number().finite().optional(),
    sceneUnits: SceneUnitsSchema.optional(),
    storeyId: z.string().min(1).optional(),
    // Forward hook (duct/pipe systems) — empty in the element-only slice.
    connectors: z.array(MepConnectorSchema).optional(),
  })
  .strict()
  .superRefine((params, ctx) => {
    if (params.sectionKind === 'round') {
      if (params.diameter === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'round section requires `diameter`',
          path: ['diameter'],
        });
      }
    } else if (params.width === undefined || params.height === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'rectangular section requires `width` and `height`',
        path: ['width'],
      });
    }
    // A pipe is always round (Revit: pipes have no rectangular section).
    if (params.domain === 'pipe' && params.sectionKind !== 'round') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'pipe domain must use a round section',
        path: ['sectionKind'],
      });
    }
  });

export type MepSegmentParamsParsed = z.infer<typeof MepSegmentParamsSchema>;

/** Focused entity schema (passthrough for tenant/timestamp fields). */
export const MepSegmentEntitySchema = z
  .object({
    id: z.string().min(1),
    type: z.literal('mep-segment'),
    kind: MepSegmentDomainSchema,
    params: MepSegmentParamsSchema,
    ifcType: MepSegmentIfcTypeSchema,
  })
  .passthrough();

export type MepSegmentEntityParsed = z.infer<typeof MepSegmentEntitySchema>;
