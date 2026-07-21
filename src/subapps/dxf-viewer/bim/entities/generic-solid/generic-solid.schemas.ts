/**
 * Generic Solid Zod Schemas (ADR-684 Φ2).
 *
 * Strict runtime validation για `GenericSolidParams`. Το `shape` είναι **nested discriminated union**
 * στο `kind` — κάθε σχήμα φέρει μόνο τα δικά του πεδία, ακριβώς η δουλειά του `z.discriminatedUnion`.
 * Πρότυπο: `../../types/foundation.schemas.ts` (top-level union· εδώ το union είναι τιμή πεδίου).
 *
 * @see ./generic-solid-types — οι αντίστοιχοι TS τύποι (SSoT· οι καταναλωτές εισάγουν αυτούς)
 * @see docs/centralized-systems/reference/adrs/ADR-684-generic-solid-primitive-entity.md
 */

import { z } from 'zod';
import { IfcGuidSchema, IfcPropertySetSchema } from '../../types/ifc-entity-mixin';
import { GuideBindingsSchema } from '../../types/guide-binding.schemas';

// ─── Point3D ──────────────────────────────────────────────────────────────────

const Point3DSchema = z
  .object({
    x: z.number().finite(),
    y: z.number().finite(),
    z: z.number().finite().optional(),
  })
  .strict();

// ─── Per-shape schemas (plain objects — required by discriminatedUnion) ───────

const BoxShapeSchema = z
  .object({
    kind: z.literal('box'),
    widthMm: z.number().positive(),
    depthMm: z.number().positive(),
    heightMm: z.number().positive(),
  })
  .strict();

const SphereShapeSchema = z
  .object({
    kind: z.literal('sphere'),
    radiusMm: z.number().positive(),
  })
  .strict();

const CylinderShapeSchema = z
  .object({
    kind: z.literal('cylinder'),
    radiusMm: z.number().positive(),
    heightMm: z.number().positive(),
  })
  .strict();

const ConeShapeSchema = z
  .object({
    kind: z.literal('cone'),
    radiusBottomMm: z.number().positive(),
    // Επιτρέπεται 0 → πλήρης κώνος (μη-αρνητικό, όχι θετικό).
    radiusTopMm: z.number().finite().nonnegative(),
    heightMm: z.number().positive(),
  })
  .strict();

const TorusShapeSchema = z
  .object({
    kind: z.literal('torus'),
    majorRadiusMm: z.number().positive(),
    tubeRadiusMm: z.number().positive(),
  })
  .strict();

const PyramidShapeSchema = z
  .object({
    kind: z.literal('pyramid'),
    baseWidthMm: z.number().positive(),
    baseDepthMm: z.number().positive(),
    heightMm: z.number().positive(),
  })
  .strict();

const DiscShapeSchema = z
  .object({
    kind: z.literal('disc'),
    radiusMm: z.number().positive(),
    thicknessMm: z.number().positive(),
  })
  .strict();

const PrismShapeSchema = z
  .object({
    kind: z.literal('prism'),
    radiusMm: z.number().positive(),
    heightMm: z.number().positive(),
    sides: z.number().int().min(3),
  })
  .strict();

// ─── Shape union ────────────────────────────────────────────────────────────────

export const GenericSolidShapeSchema = z.discriminatedUnion('kind', [
  BoxShapeSchema,
  SphereShapeSchema,
  CylinderShapeSchema,
  ConeShapeSchema,
  TorusShapeSchema,
  PyramidShapeSchema,
  DiscShapeSchema,
  PrismShapeSchema,
]);

export type GenericSolidShapeParsed = z.infer<typeof GenericSolidShapeSchema>;

// ─── Params ─────────────────────────────────────────────────────────────────────

export const GenericSolidParamsSchema = z
  .object({
    kind: z.literal('generic'),
    shape: GenericSolidShapeSchema,
    position: Point3DSchema,
    rotationDeg: z.number().finite(),
    mountingElevationMm: z.number().finite(),
    material: z.string().min(1).optional(),
    // ADR-684 Φ4-C — ρόλος ταξινόμησης/BOQ (§4.3). Απόν → διακοσμητικό (default).
    structuralRole: z.enum(['structural', 'decorative']).optional(),
    sceneUnits: z.string().optional(),
    storeyId: z.string().min(1).optional(),
  })
  .strict();

export type GenericSolidParamsParsed = z.infer<typeof GenericSolidParamsSchema>;

// ─── Entity ─────────────────────────────────────────────────────────────────────

export const GenericSolidEntitySchema = z
  .object({
    id: z.string().min(1),
    type: z.literal('generic-solid'),
    kind: z.literal('generic'),
    params: GenericSolidParamsSchema,
    ifcGuid: IfcGuidSchema,
    ifcType: z.literal('IfcBuildingElementProxy'),
    pset: IfcPropertySetSchema.optional(),
    // ADR-441 — associative grid hosting. Optional → backward-compatible.
    guideBindings: GuideBindingsSchema,
  })
  .passthrough();

export type GenericSolidEntityParsed = z.infer<typeof GenericSolidEntitySchema>;
