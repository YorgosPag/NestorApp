/**
 * MEP Fitting Zod Schemas (ADR-408 Φ11) — strict runtime validation.
 *
 * Validates `MepFittingParams` + the persisted `MepFittingEntity` shape. Mirror
 * of `mep-segment.schemas.ts`. The `connectors` array reuses the shared
 * {@link MepConnectorSchema} (forward hook for downstream system routing).
 *
 * @see ./mep-fitting-types.ts
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md §Φ11
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

export const MepFittingDomainSchema = z.enum(['pipe', 'duct']);

export const MepFittingKindSchema = z.enum([
  'elbow',
  'coupling',
  'reducer',
  'tee',
  'cross',
  'cap',
]);

export const ElbowStyleSchema = z.enum(['radiused', 'mitered']);

export const MepFittingIfcTypeSchema = z.enum(['IfcPipeFitting', 'IfcDuctFitting']);

const SceneUnitsSchema = z.enum(['mm', 'cm', 'm']);

const MepFittingIncidentSchema = z
  .object({
    // Canonical FK (ADR-408 Φ-B2b EXT #2). Both ids are optional + refined so
    // pre-migration docs (segmentId only) AND new docs (entityId) both validate.
    entityId: z.string().min(1).optional(),
    segmentId: z.string().min(1).optional(),
    connectorId: z.string().min(1),
    directionUnit: Point3DSchema,
    diameterMm: z.number().positive(),
    // Transient point-host marker — host nodes never persist (kind → null), so a
    // persisted incident is normally `false`/absent; accepted for forward-compat.
    host: z.boolean().optional(),
  })
  .strict()
  .refine((i) => i.entityId !== undefined || i.segmentId !== undefined, {
    message: 'incident requires `entityId` (or legacy `segmentId`)',
  });

export const MepFittingParamsSchema = z
  .object({
    domain: MepFittingDomainSchema,
    kind: MepFittingKindSchema,
    junctionKey: z.string().min(1),
    position: Point3DSchema,
    centerlineElevationMm: z.number().finite(),
    incidents: z.array(MepFittingIncidentSchema),
    primaryDiameterMm: z.number().positive(),
    secondaryDiameterMm: z.number().positive().optional(),
    // ADR-408 Φ14 — classification inherited from the incident pipes (drives V/G
    // category + standalone colour). Mirror of MepSegmentParamsSchema.classification.
    classification: PlumbingSystemClassificationSchema.optional(),
    elbowStyle: ElbowStyleSchema.optional(),
    sceneUnits: SceneUnitsSchema.optional(),
    storeyId: z.string().min(1).optional(),
    // Forward hook (downstream system routing) — empty in the foundation slice.
    connectors: z.array(MepConnectorSchema).optional(),
  })
  .strict()
  .superRefine((params, ctx) => {
    // A reducer requires the smaller Ø to be present.
    if (params.kind === 'reducer' && params.secondaryDiameterMm === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'reducer requires `secondaryDiameterMm`',
        path: ['secondaryDiameterMm'],
      });
    }
    // An elbow style is only meaningful on an elbow.
    if (params.elbowStyle !== undefined && params.kind !== 'elbow') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '`elbowStyle` is only valid for an elbow',
        path: ['elbowStyle'],
      });
    }
  });

export type MepFittingParamsParsed = z.infer<typeof MepFittingParamsSchema>;

/** Focused entity schema (passthrough for tenant/timestamp fields). */
export const MepFittingEntitySchema = z
  .object({
    id: z.string().min(1),
    type: z.literal('mep-fitting'),
    kind: MepFittingKindSchema,
    params: MepFittingParamsSchema,
    ifcType: MepFittingIfcTypeSchema,
  })
  .passthrough();

export type MepFittingEntityParsed = z.infer<typeof MepFittingEntitySchema>;
