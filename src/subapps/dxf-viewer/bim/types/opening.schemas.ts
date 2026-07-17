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
import { OPENING_OPERATION_VALUES } from './opening-operation-types';

// ─── Enums (mirror opening-types.ts unions) ──────────────────────────────────

export const OpeningKindSchema = z.enum([
  // Doors (IfcDoor)
  'door',
  'double-door',
  'sliding-door',
  'double-sliding-door',
  'pocket-door',
  'bifold-door',
  'overhead-door',
  'revolving-door',
  'french-door',
  // Windows (IfcWindow)
  'window',
  'fixed',
  'double-hung-window',
  'sliding-window',
  'awning-window',
  'hopper-window',
  'tilt-turn-window',
  'bay-window',
]);

/** ADR-421 §A1 — mirror του OpeningOperationType (IFC4 door ∪ window operation). */
export const OpeningOperationTypeSchema = z.enum(
  OPENING_OPERATION_VALUES as unknown as [string, ...string[]],
);

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

/**
 * Per-part surface materials (κάσα/φύλλο/υαλοστάσιο/χειρολαβή) — Revit family
 * surfaces. Each field is a material-library id (`mat-*` catalog or `bmat_*`
 * user). Mirrors `OpeningMaterials` (opening-types.ts). Shared by the instance
 * (`OpeningParamsSchema`) and the family Type (`OpeningTypeParamsSchema`).
 */
export const OpeningMaterialsSchema = z
  .object({
    frame: z.string().min(1).optional(),
    leaf: z.string().min(1).optional(),
    glass: z.string().min(1).optional(),
    hardware: z.string().min(1).optional(),
  })
  .strict();

export const OpeningParamsSchema = z
  .object({
    kind: OpeningKindSchema,
    wallId: z.string().min(1),
    offsetFromStart: z.number().finite().nonnegative(),
    width: z.number().positive(),
    height: z.number().positive(),
    sillHeight: z.number().finite().nonnegative(),
    frameWidth: z.number().positive().optional(),
    // ─── ADR-611 — frame profile (διατομή κάσας, constant cross-section) ──────
    frameProfileId: z.string().min(1).optional(),
    frameProfileOverrides: z
      .object({
        faceWidth: z.number().positive().optional(),
        depth: z.number().positive().optional(),
        manufacturer: z.string().min(1).optional(),
        series: z.string().min(1).optional(),
      })
      .strict()
      .optional(),
    handing: OpeningHandingSchema.optional(),
    openDirection: OpeningSwingSchema.optional(),
    material: z.string().min(1).optional(),
    materials: OpeningMaterialsSchema.optional(),
    glazingPanes: OpeningGlazingPanesSchema.optional(),
    // ─── ADR-421 §A2 — explicit IFC operation (optional/non-breaking) ────────
    operationType: OpeningOperationTypeSchema.optional(),
    // ─── ADR-396 P7 — ETICS reveal insulation strips (Z4) ────────────────────
    revealInsulation: RevealInsulationSchema.optional(),
  })
  .strict();

export type OpeningParamsParsed = z.infer<typeof OpeningParamsSchema>;

// ─── Type-level params schema (ADR-421 SLICE C — Revit Door/Window Types) ─────

/**
 * Mirrors `OpeningTypeParams` (bim-family-type.ts). The opening analogue of
 * `WallTypeParamsSchema`. Lives here (not in `bim-family-type.schemas.ts`) so it
 * can reuse `OpeningKindSchema`/`OpeningGlazingPanesSchema` AND back the
 * `typeOverrides` branch of `OpeningEntitySchema` below WITHOUT a runtime import
 * cycle — `bim-family-type.schemas.ts` imports this one-directionally.
 */
export const OpeningTypeParamsSchema = z
  .object({
    kind: OpeningKindSchema,
    width: z.number().positive(),
    height: z.number().positive(),
    frameWidth: z.number().positive().optional(),
    // ─── ADR-611 — type-default frame profile ID ─────────────────────────────
    frameProfileId: z.string().min(1).optional(),
    material: z.string().min(1).optional(),
    materials: OpeningMaterialsSchema.optional(),
    glazingPanes: OpeningGlazingPanesSchema.optional(),
    fireRating: z.string().min(1).optional(),
  })
  .strict();

export type OpeningTypeParamsParsed = z.infer<typeof OpeningTypeParamsSchema>;

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
    // ─── ADR-421 SLICE C — Family/Type link (ADR-412, optional/non-breaking) ──
    typeId: z.string().min(1).optional(),
    typeOverrides: OpeningTypeParamsSchema.partial().optional(),
  })
  .passthrough();

export type OpeningEntityParsed = z.infer<typeof OpeningEntitySchema>;
