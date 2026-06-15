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
import {
  EnvelopeFunctionSchema,
  EnvelopeLayerSchema,
} from './thermal-envelope.schemas';

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

/** ADR-363 Φ2 — σχήμα διατομής (ορθογώνιο RC vs μεταλλικό Ι). */
export const BeamSectionKindSchema = z.enum(['rectangular', 'I-shape']);

/** ADR-363 Φ2 — I-shape override (mirror ColumnIShapeParams). */
export const BeamIShapeParamsSchema = z
  .object({
    flangeThickness: z.number().positive().optional(),
    webThickness: z.number().positive().optional(),
    flipY: z.boolean().optional(),
  })
  .strict();

/** Beam-specific IFC4 class. */
export const BeamIfcTypeSchema = z.literal('IfcBeam');

// ─── ADR-459 Phase 4a — οπλισμός δοκού (mirror ColumnReinforcementSchema) ──────

const BeamRebarLayerSchema = z
  .object({
    diameterMm: z.number().positive(),
    count: z.number().int().positive(),
  })
  .strict();

const BeamReinforcementSchema = z
  .object({
    bottom: BeamRebarLayerSchema,
    top: BeamRebarLayerSchema,
    stirrups: z
      .object({
        diameterMm: z.number().positive(),
        spacingMm: z.number().positive(),
        spacingCriticalMm: z.number().positive().optional(),
        legs: z.number().int().positive().optional(),
        type: z.enum(['closed-hooked', 'closed-welded', 'spiral']).optional(),
      })
      .strict(),
    coverMm: z.number().positive(),
  })
  .strict();

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
    // ─── ADR-401 Phase E/(β) — κεκλιμένη δοκός (top face στο endPoint) ────────
    topElevationEnd: z.number().finite().optional(),
    zOffset: z.number().finite().optional(),
    material: z.string().min(1).optional(),
    supportType: BeamSupportTypeSchema.optional(),
    sectionType: BeamSectionTypeSchema.optional(),
    // ─── ADR-363 Φ2 — μεταλλική διατομή Ι/H ──────────────────────────────────
    sectionKind: BeamSectionKindSchema.optional(),
    ishape: BeamIShapeParamsSchema.optional(),
    catalogProfile: z.string().min(1).optional(),
    profileDesignation: z.string().min(1).optional(),
    sceneUnits: z.string().optional(),
    storeyId: z.string().min(1).optional(),
    offsetFromStorey: z.number().finite().optional(),
    // ─── ADR-396 P7 — ETICS exterior insulation layer (Z1) ───────────────────
    envelopeLayer: EnvelopeLayerSchema.optional(),
    // ─── ADR-396 v2 Φάση 4 — ETICS classification override (Στρ.3) ─────────────
    envelopeFunction: EnvelopeFunctionSchema.optional(),
    // ─── ADR-459 Phase 4a — οπλισμός δοκού ────────────────────────────────────
    reinforcement: BeamReinforcementSchema.optional(),
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
