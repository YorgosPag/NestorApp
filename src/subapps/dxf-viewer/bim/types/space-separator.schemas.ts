/**
 * Space Separator Zod Schemas (ADR-437).
 *
 * Mirror του `foundation.schemas.ts` (απλούστερο — ένα μόνο kind). Strict runtime
 * validation για `SpaceSeparatorParams` (2-point segment) + `SpaceSeparatorEntity`
 * με IfcEntityMixin πεδία.
 *
 * @see ./space-separator-types
 * @see docs/centralized-systems/reference/adrs/ADR-437-space-separation-lines.md
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

// ─── Enums (mirror space-separator-types.ts unions) ──────────────────────────

export const SpaceSeparatorKindSchema = z.enum(['room-bounding']);

export const SpaceSeparatorIfcTypeSchema = z.literal('IfcVirtualElement');

// ─── Params schema ─────────────────────────────────────────────────────────────

export const SpaceSeparatorParamsSchema = z
  .object({
    start: Point3DSchema,
    end: Point3DSchema,
    name: z.string().optional(),
    sceneUnits: z.string().optional(),
    floorId: z.string().min(1).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    const lengthSq =
      (data.end.x - data.start.x) ** 2 + (data.end.y - data.start.y) ** 2;
    if (lengthSq <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['end'],
        message: 'SpaceSeparatorParams: start και end δεν επιτρέπεται να ταυτίζονται (degenerate).',
      });
    }
  });

export type SpaceSeparatorParamsParsed = z.infer<typeof SpaceSeparatorParamsSchema>;

// ─── Entity schema (focused factory output) ──────────────────────────────────

export const SpaceSeparatorEntitySchema = z
  .object({
    id: z.string().min(1),
    type: z.literal('space-separator'),
    kind: SpaceSeparatorKindSchema,
    params: SpaceSeparatorParamsSchema,
    ifcGuid: IfcGuidSchema,
    ifcType: SpaceSeparatorIfcTypeSchema,
    pset: IfcPropertySetSchema.optional(),
  })
  .passthrough();

export type SpaceSeparatorEntityParsed = z.infer<typeof SpaceSeparatorEntitySchema>;
