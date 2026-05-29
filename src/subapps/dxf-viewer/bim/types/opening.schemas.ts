/**
 * Opening Zod Schemas (ADR-369 §9 Q8) — Phase A5
 *
 * Strict runtime validation για OpeningParams + OpeningEntity, focused στα νέα
 * ADR-369 πεδία (IfcEntityMixin: ifcGuid + ifcType 'IfcDoor'|'IfcWindow').
 *
 *   - `OpeningParamsSchema`  — full param validation.
 *   - `OpeningEntitySchema`  — factory output validation (params + kind +
 *     IfcEntityMixin + type='opening'). Δεν επικυρώνει BaseEntity tenant fields.
 *
 * ifcType mapping (invariant):
 *   - door / sliding-door / french-door → 'IfcDoor'
 *   - window / fixed                    → 'IfcWindow'
 *
 * @see docs/centralized-systems/reference/adrs/ADR-369-bim-elevation-convention-revit-alignment.md §9 Q8
 */

import { z } from 'zod';
import {
  IfcGuidSchema,
  IfcPropertySetSchema,
} from './ifc-entity-mixin';
import { RevealInsulationSchema } from './thermal-envelope.schemas';

// ─── Enums (mirror opening-types.ts unions) ──────────────────────────────────

export const OpeningKindSchema = z.enum([
  'door',
  'window',
  'sliding-door',
  'french-door',
  'fixed',
]);

export const OpeningHandingSchema = z.enum(['left', 'right']);

export const OpeningSwingSchema = z.enum(['inward', 'outward']);

export const OpeningGlazingPanesSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
]);

export const OpeningIfcTypeSchema = z.union([
  z.literal('IfcDoor'),
  z.literal('IfcWindow'),
]);

// ─── Params schema ──────────────────────────────────────────────────────────

export const OpeningParamsSchema = z
  .object({
    kind: OpeningKindSchema,
    wallId: z.string().min(1),
    offsetFromStart: z.number().finite().nonnegative(),
    width: z.number().positive(),
    height: z.number().positive(),
    sillHeight: z.number().finite().nonnegative(),
    frameWidth: z.number().positive().optional(),
    handing: OpeningHandingSchema.optional(),
    openDirection: OpeningSwingSchema.optional(),
    material: z.string().min(1).optional(),
    glazingPanes: OpeningGlazingPanesSchema.optional(),
    // ─── ADR-396 P7 — ETICS reveal insulation strips (Z4) ────────────────────
    revealInsulation: RevealInsulationSchema.optional(),
  })
  .strict();

export type OpeningParamsParsed = z.infer<typeof OpeningParamsSchema>;

// ─── Entity schema (factory output — focused) ───────────────────────────────

/**
 * Validates the ADR-369-relevant shape of an OpeningEntity emitted από factory:
 *   id, type='opening', kind, params, ifcGuid, ifcType ('IfcDoor'|'IfcWindow'), pset?
 * Επιπλέον BaseEntity πεδία (geometry, validation, tenant scope) ΔΕΝ
 * επικυρώνονται εδώ — αρμοδιότητα persistence layer.
 */
export const OpeningEntitySchema = z
  .object({
    id: z.string().min(1),
    type: z.literal('opening'),
    kind: OpeningKindSchema,
    params: OpeningParamsSchema,
    ifcGuid: IfcGuidSchema,
    ifcType: OpeningIfcTypeSchema,
    pset: IfcPropertySetSchema.optional(),
  })
  .passthrough();

export type OpeningEntityParsed = z.infer<typeof OpeningEntitySchema>;
