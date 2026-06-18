/**
 * Column Zod Schemas (ADR-369 §9 Q5 + Q8) — Phase A3
 *
 * Mirror του wall.schemas.ts. Strict runtime validation για ColumnParams +
 * ColumnEntity με ADR-369 binding + IfcEntityMixin πεδία.
 *
 * Refinements:
 *   - topBinding='unconnected' MUST provide positive `unconnectedHeight`.
 *   - topBinding !== 'unconnected' MUST NOT provide `unconnectedHeight`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-369-bim-elevation-convention-revit-alignment.md §9 Q5, Q8
 */

import { z } from 'zod';
import {
  ColumnBaseBindingSchema,
  ColumnTopBindingSchema,
} from './bim-binding';
import {
  IfcGuidSchema,
  IfcPropertySetSchema,
} from './ifc-entity-mixin';
import {
  EnvelopeFunctionSchema,
  EnvelopeLayerSchema,
} from './thermal-envelope.schemas';

// ─── Point3D ────────────────────────────────────────────────────────────────

const Point3DSchema = z
  .object({
    x: z.number().finite(),
    y: z.number().finite(),
    z: z.number().finite().optional(),
  })
  .strict();

// ─── Enums (mirror column-types.ts unions) ───────────────────────────────────

export const ColumnKindSchema = z.enum([
  'rectangular',
  'circular',
  'L-shape',
  'T-shape',
  // ADR-363 Phase 8 — ευθυγραμμίστηκαν με τον type union (ήταν gap: valid columns απορρίπτονταν).
  'polygon',
  'shear-wall',
  'I-shape',
  // ADR-363 Phase 2 «από περίγραμμα».
  'U-shape',
  'composite',
]);

export const ColumnAnchorSchema = z.enum([
  'center',
  'n',
  's',
  'e',
  'w',
  'nw',
  'ne',
  'sw',
  'se',
]);

export const ColumnIfcTypeSchema = z.literal('IfcColumn');

// ─── Variant sub-param schemas ──────────────────────────────────────────────

const ColumnLshapeParamsSchema = z
  .object({
    armLength: z.number().positive().optional(),
    armWidth: z.number().positive().optional(),
    flipY: z.boolean().optional(),
  })
  .strict();

const ColumnTshapeParamsSchema = z
  .object({
    flangeLength: z.number().positive().optional(),
    webThickness: z.number().positive().optional(),
    flangeThickness: z.number().positive().optional(),
    flipY: z.boolean().optional(),
  })
  .strict();

// ─── ADR-363 Phase 8 variant schemas (ήταν unregistered — Boy-Scout fix) ──────

const ColumnPolygonParamsSchema = z
  .object({
    sides: z.number().int().positive().optional(),
  })
  .strict();

const ColumnIShapeParamsSchema = z
  .object({
    flangeThickness: z.number().positive().optional(),
    webThickness: z.number().positive().optional(),
    flipY: z.boolean().optional(),
  })
  .strict();

// ─── ADR-363 Phase 2 «από περίγραμμα» — U-shape + composite (polygon-backed) ──

/** Local-frame 2D point (mm) για polygon-backed διατομές. */
const Point2DSchema = z
  .object({
    x: z.number().finite(),
    y: z.number().finite(),
  })
  .strict();

const ColumnUshapeParamsSchema = z
  .object({
    legThickness: z.number().positive().optional(),
    baseThickness: z.number().positive().optional(),
    flipY: z.boolean().optional(),
    polygon: z.array(Point2DSchema).min(3).optional(),
  })
  .strict();

const ColumnCompositeParamsSchema = z
  .object({
    polygon: z.array(Point2DSchema).min(3),
  })
  .strict();

// ─── ADR-404 — tilt (raking column) ─────────────────────────────────────────

const ColumnTiltSchema = z
  .object({
    direction: z.number().finite(),
    angle: z.number().finite(),
  })
  .strict();

// ─── ADR-456 — concrete grade + reinforcement ────────────────────────────────

const ConcreteGradeSchema = z.enum([
  'C12/15', 'C16/20', 'C20/25', 'C25/30', 'C30/37', 'C35/45', 'C40/50', 'C45/55', 'C50/60',
]);

const ColumnLongitudinalSchema = z
  .object({
    diameterMm: z.number().positive(),
    count: z.number().int().positive(),
  })
  .strict();

const ColumnStirrupsSchema = z
  .object({
    diameterMm: z.number().positive(),
    spacingMm: z.number().positive(),
    spacingCriticalMm: z.number().positive().optional(),
    // ADR-456 Slice 3 — μορφή συνδετήρα (absent ⇒ closed-hooked).
    type: z.enum(['closed-hooked', 'closed-welded', 'spiral']).optional(),
  })
  .strict();

// ADR-460 — οπλισμός τοιχώματος (boundary elements + κατανεμημένος κορμός).
const WallReinforcementSchema = z
  .object({
    boundary: ColumnLongitudinalSchema,
    boundaryTieSpacingMm: z.number().positive(),
    webVertical: ColumnStirrupsSchema,
    webHorizontal: ColumnStirrupsSchema,
  })
  .strict();

const ColumnReinforcementSchema = z
  .object({
    longitudinal: ColumnLongitudinalSchema,
    stirrups: ColumnStirrupsSchema,
    coverMm: z.number().positive(),
    // ADR-456 — μοτίβο cross-ties (absent ⇒ auto). [ΗΤΑΝ ΚΕΝΟ στο schema — strict
    // απέρριπτε persisted crossTiePattern· ADR-460 fix].
    crossTiePattern: z.enum(['auto', 'diamond', 'grid']).optional(),
    // ADR-460 — σπείρα: βήμα έλικας (mm)· wall: boundary + web οπλισμός.
    spiralPitchMm: z.number().positive().optional(),
    wall: WallReinforcementSchema.optional(),
  })
  .strict();

// ─── Params schema ──────────────────────────────────────────────────────────

const ColumnParamsBaseSchema = z
  .object({
    kind: ColumnKindSchema,
    position: Point3DSchema,
    anchor: ColumnAnchorSchema,
    width: z.number().positive(),
    depth: z.number().positive(),
    height: z.number().positive(),
    rotation: z.number().finite(),
    // ─── ADR-404 — 3Δ κλίση (optional, absent = κατακόρυφη) ───────────────────
    tilt: ColumnTiltSchema.optional(),
    material: z.string().min(1).optional(),
    lshape: ColumnLshapeParamsSchema.optional(),
    tshape: ColumnTshapeParamsSchema.optional(),
    polygon: ColumnPolygonParamsSchema.optional(),
    ishape: ColumnIShapeParamsSchema.optional(),
    ushape: ColumnUshapeParamsSchema.optional(),
    composite: ColumnCompositeParamsSchema.optional(),
    sceneUnits: z.string().optional(),
    storeyId: z.string().min(1).optional(),
    offsetFromStorey: z.number().finite().optional(),
    // ─── ADR-369 §9 Q5 binding ──────────────────────────────────────────────
    baseBinding: ColumnBaseBindingSchema,
    topBinding: ColumnTopBindingSchema,
    baseOffset: z.number().finite(),
    topOffset: z.number().finite(),
    unconnectedHeight: z.number().positive().optional(),
    // ─── ADR-401 Phase F — Attach-to-structural (mirror wall.schemas.ts) ───────
    attachTopToIds: z.array(z.string().min(1)).optional(),
    attachBaseToIds: z.array(z.string().min(1)).optional(),
    // ─── ADR-459 Phase 2 — αναλυτικό FK πεδίλου (Structural Connectivity) ───────
    footingId: z.string().min(1).optional(),
    // ─── ADR-396 P7 — ETICS exterior insulation layer (Z1) ───────────────────
    envelopeLayer: EnvelopeLayerSchema.optional(),
    // ─── ADR-396 v2 Φάση 4 — ETICS classification override (Στρ.3) ─────────────
    envelopeFunction: EnvelopeFunctionSchema.optional(),
    // ─── ADR-456 — Στατικά: κατηγορία σκυροδέματος + οπλισμός ──────────────────
    concreteGrade: ConcreteGradeSchema.optional(),
    reinforcement: ColumnReinforcementSchema.optional(),
  })
  .strict();

export const ColumnParamsSchema = ColumnParamsBaseSchema.superRefine(
  (data, ctx) => {
    if (data.topBinding === 'unconnected' && data.unconnectedHeight === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['unconnectedHeight'],
        message:
          "ColumnParams: topBinding='unconnected' απαιτεί unconnectedHeight (mm > 0).",
      });
    }
    if (data.topBinding !== 'unconnected' && data.unconnectedHeight !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['unconnectedHeight'],
        message:
          "ColumnParams: unconnectedHeight επιτρέπεται μόνο όταν topBinding='unconnected'.",
      });
    }
    // ─── ADR-401 Phase F — top attach refinement ──────────────────────────────
    if (data.topBinding === 'attached' && (data.attachTopToIds === undefined || data.attachTopToIds.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['attachTopToIds'],
        message: "ColumnParams: topBinding='attached' απαιτεί ≥1 attachTopToIds (host FK).",
      });
    }
    if (data.topBinding !== 'attached' && data.attachTopToIds !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['attachTopToIds'],
        message: "ColumnParams: attachTopToIds επιτρέπεται μόνο όταν topBinding='attached'.",
      });
    }
    // ─── ADR-401 Phase F (base) — base attach refinement ──────────────────────
    if (data.baseBinding === 'attached' && (data.attachBaseToIds === undefined || data.attachBaseToIds.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['attachBaseToIds'],
        message: "ColumnParams: baseBinding='attached' απαιτεί ≥1 attachBaseToIds (host FK).",
      });
    }
    if (data.baseBinding !== 'attached' && data.attachBaseToIds !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['attachBaseToIds'],
        message: "ColumnParams: attachBaseToIds επιτρέπεται μόνο όταν baseBinding='attached'.",
      });
    }
  },
);

export type ColumnParamsParsed = z.infer<typeof ColumnParamsSchema>;

// ─── Entity schema (focused factory output) ─────────────────────────────────

export const ColumnEntitySchema = z
  .object({
    id: z.string().min(1),
    type: z.literal('column'),
    kind: ColumnKindSchema,
    params: ColumnParamsSchema,
    ifcGuid: IfcGuidSchema,
    ifcType: ColumnIfcTypeSchema,
    pset: IfcPropertySetSchema.optional(),
  })
  .passthrough();

export type ColumnEntityParsed = z.infer<typeof ColumnEntitySchema>;
