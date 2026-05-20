/**
 * Beam Zod Schemas (ADR-369 §2.2 + §9 Q5 + Q8) — Phase A4
 *
 * Strict runtime validation για BeamParams + BeamEntity, focused στα νέα
 * ADR-369 πεδία (topElevation rename + zOffset + IfcEntityMixin).
 *
 *   - `BeamParamsSchema`  — full param validation.
 *   - `BeamEntitySchema`  — factory output validation (params + kind +
 *     IfcEntityMixin + type='beam'). Δεν επικυρώνει BaseEntity tenant fields.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-369-bim-elevation-convention-revit-alignment.md §2.2, §9 Q5, §9 Q8
 */

import { z } from 'zod';
import {
  IfcGuidSchema,
  IfcPropertySetSchema,
} from './ifc-entity-mixin';

// ─── Primitive schemas ──────────────────────────────────────────────────────

const Point3DSchema = z
  .object({
    x: z.number().finite(),
    y: z.number().finite(),
    z: z.number().finite().optional(),
  })
  .strict();

// ─── Enums (mirror beam-types.ts unions) ─────────────────────────────────────

export const BeamKindSchema = z.enum(['straight', 'curved', 'cantilever']);

export const BeamSupportTypeSchema = z.enum(['simple', 'fixed', 'cantilever']);

export const BeamSectionTypeSchema = z.enum(['I', 'H']);

/** Beam-specific IFC4 class. */
export const BeamIfcTypeSchema = z.literal('IfcBeam');

// ─── Params schema ──────────────────────────────────────────────────────────

export const BeamParamsSchema = z
  .object({
    kind: BeamKindSchema,
    startPoint: Point3DSchema,
    endPoint: Point3DSchema,
    curveControl: Point3DSchema.optional(),
    width: z.number().positive(),
    depth: z.number().positive(),
    topElevation: z.number().finite(),
    zOffset: z.number().finite().optional(),
    material: z.string().min(1).optional(),
    supportType: BeamSupportTypeSchema.optional(),
    sectionType: BeamSectionTypeSchema.optional(),
    profileDesignation: z.string().min(1).optional(),
    sceneUnits: z.string().optional(),
  })
  .strict();

export type BeamParamsParsed = z.infer<typeof BeamParamsSchema>;

// ─── Entity schema (focused factory output) ─────────────────────────────────

/**
 * Validates the ADR-369-relevant shape of a BeamEntity emitted από factory:
 *   id, type='beam', kind, params, ifcGuid, ifcType='IfcBeam', pset?
 * Επιπλέον BaseEntity πεδία ΔΕΝ επικυρώνονται εδώ.
 */
export const BeamEntitySchema = z
  .object({
    id: z.string().min(1),
    type: z.literal('beam'),
    kind: BeamKindSchema,
    params: BeamParamsSchema,
    ifcGuid: IfcGuidSchema,
    ifcType: BeamIfcTypeSchema,
    pset: IfcPropertySetSchema.optional(),
  })
  .passthrough();

export type BeamEntityParsed = z.infer<typeof BeamEntitySchema>;
