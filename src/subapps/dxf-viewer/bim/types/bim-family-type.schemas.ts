/**
 * BIM Family Types — Zod Schemas (ADR-412).
 *
 * Runtime validation mirroring `bim-family-type.ts` field-for-field. Strict
 * objects (`.strict()`) so unexpected keys are rejected, same convention as
 * `wall.schemas.ts` / `stair.schemas.ts`.
 *
 * SCOPE NOTE (mirrors `stair.schemas.ts`): the repo deliberately has **no full
 * `StairParamsSchema`** — per-variant structural validity lives in the geometry
 * computers + `stair-validator.ts`, not in Zod. To keep 1:1 field parity with
 * `StairTypeParams` WITHOUT re-deriving the variant union, the composite stair
 * fields (`variant`, `handrails`, `multiStoryConfig`, `stringerParams`,
 * `materials`, `perTreadOverrides`) are validated as opaque `z.unknown()`
 * pass-through — exactly the pattern `wall.schemas.ts` uses for `dna`
 * (`z.unknown().optional()`). Scalar/enum type params are validated strictly.
 *
 * The `BimFamilyTypeSchema` is a `z.discriminatedUnion('category', …)` so the
 * `typeParams` payload is narrowed by `category`, matching `BimFamilyType<C>`.
 * No `.default()` is used anywhere — required fields stay required.
 *
 * @see bim/types/bim-family-type.ts — the type-level contract this mirrors
 * @see docs/centralized-systems/reference/adrs/ADR-412-bim-family-types.md
 */

import { z } from 'zod';

import { StairBaseBindingSchema, StairTopBindingSchema } from './bim-binding';

// ─── Scope & origin ──────────────────────────────────────────────────────────

export const BimFamilyTypeScopeSchema = z.enum(['user', 'company', 'project']);

export const BimFamilyTypeOriginSchema = z.enum(['built-in', 'user']);

// ─── Wall category (mirror wall-types.ts WallCategory) ───────────────────────

const WallCategorySchema = z.enum([
  'exterior',
  'interior',
  'partition',
  'parapet',
  'fence',
]);

// ─── WallTypeParams ──────────────────────────────────────────────────────────

/**
 * Mirrors `WallTypeParams`. `dna` is opaque pass-through (validated by the
 * wall-dna layer), same as `wall.schemas.ts`.
 */
export const WallTypeParamsSchema = z
  .object({
    category: WallCategorySchema,
    thickness: z.number().positive(),
    dna: z.unknown().optional(),
    material: z.string().min(1).optional(),
  })
  .strict();

export type WallTypeParamsParsed = z.infer<typeof WallTypeParamsSchema>;

// ─── Slab kind (mirror slab-types.ts SlabKind) ───────────────────────────────

const SlabKindSchema = z.enum([
  'floor',
  'ceiling',
  'roof',
  'ground',
  'foundation',
]);

// ─── SlabTypeParams ──────────────────────────────────────────────────────────

/**
 * Mirrors `SlabTypeParams`. `dna` is opaque pass-through (validated by the
 * slab-dna layer), same convention as `WallTypeParamsSchema`.
 */
export const SlabTypeParamsSchema = z
  .object({
    kind: SlabKindSchema,
    thickness: z.number().positive(),
    dna: z.unknown().optional(),
    material: z.string().min(1).optional(),
  })
  .strict();

export type SlabTypeParamsParsed = z.infer<typeof SlabTypeParamsSchema>;

// ─── RoofTypeParams (ADR-417) ────────────────────────────────────────────────

/**
 * Mirrors `RoofTypeParams` (ADR-417). A roof has no sub-kind — the two built-ins
 * («Μπετονένιο δώμα» / «Κεραμοσκεπή») differ by their `dna` build-up. `dna` is
 * opaque pass-through (validated by the slab-dna layer), same as slab/wall.
 */
export const RoofTypeParamsSchema = z
  .object({
    thickness: z.number().positive(),
    dna: z.unknown().optional(),
    material: z.string().min(1).optional(),
    // ─── Eave detailing (ADR-417 Φ2b) — type-level fascia/soffit appearance ────
    fasciaMaterial: z.string().min(1).optional(),
    soffitMaterial: z.string().min(1).optional(),
    fasciaHeightMm: z.number().positive().optional(),
    soffitMode: z.enum(['horizontal', 'sloped']).optional(),
  })
  .strict();

export type RoofTypeParamsParsed = z.infer<typeof RoofTypeParamsSchema>;

// ─── Stair enum schemas (mirror stair-types.ts unions) ───────────────────────

const StairNosingSideSchema = z.enum(['front', 'none', 'front-and-sides']);

const StairStructureTypeSchema = z.enum([
  'monolithic',
  'stringer-1side',
  'stringer-2side',
  'central-stringer',
  'cantilever',
  'suspended',
  'glass-tread',
  'steel-grating',
]);

const StairRiserTypeSchema = z.enum(['closed', 'open']);

const StairUpDirectionSchema = z.enum(['forward', 'backward']);

const StairTreadLabelDisplaySchema = z.enum(['all', 'nth', 'none']);

const StairCodeProfileSchema = z.enum([
  'nok',
  'ibc',
  'eurocode',
  'nbc',
  'nfpa',
  'as1657',
  'din',
  'ada',
  'none',
]);

const StairNokSubTypeSchema = z.enum([
  'main',
  'low-rise',
  'internal',
  'auxiliary',
  'secondary',
]);

// ─── StairTypeParams ─────────────────────────────────────────────────────────

/**
 * Mirrors `StairTypeParams` field-for-field. Composite objects are opaque
 * pass-through (`z.unknown()`) — per-variant structural validity is enforced by
 * the geometry computers, not Zod (see file header + `stair.schemas.ts`).
 */
export const StairTypeParamsSchema = z
  .object({
    rise: z.number().finite(),
    tread: z.number().finite(),
    nosing: z.number().finite(),
    nosingSide: StairNosingSideSchema,
    width: z.number().finite(),
    stepCount: z.number().finite(),

    totalRise: z.number().finite(),
    totalRun: z.number().finite(),
    pitch: z.number().finite(),

    multiStoryConfig: z.unknown().optional(),

    structureType: StairStructureTypeSchema,
    stringerParams: z.unknown().optional(),

    waistThickness: z.number().finite().optional(),

    riserType: StairRiserTypeSchema,
    materials: z.unknown().optional(),
    perTreadOverrides: z.unknown().optional(),
    antiskidNosing: z.boolean(),
    adaContrastStrip: z.boolean(),

    cutPlaneHeight: z.number().finite().optional(),

    variant: z.unknown(),

    walklineOffset: z.number().finite(),
    handrails: z.unknown(),
    upDirection: StairUpDirectionSchema,

    treadNumberStart: z.number().finite(),
    treadLabelDisplay: StairTreadLabelDisplaySchema,
    treadLabelEveryN: z.number().finite().optional(),
    treadLabelRestartPerFlight: z.boolean(),
    treadLabelHeight: z.number().finite().optional(),

    occupancyLoad: z.number().finite().optional(),

    codeProfile: StairCodeProfileSchema,
    nokSubType: StairNokSubTypeSchema.optional(),

    // ─── ADR-369 — Storey linkage ─────────────────────────────────────────────
    storeyId: z.string().min(1).optional(),
    offsetFromStorey: z.number().finite().optional(),

    // ─── ADR-401 Phase G — Attach-to-structural ───────────────────────────────
    topBinding: StairTopBindingSchema.optional(),
    baseBinding: StairBaseBindingSchema.optional(),
    attachTopToIds: z.array(z.string().min(1)).optional(),
    attachBaseToIds: z.array(z.string().min(1)).optional(),
  })
  .strict();

export type StairTypeParamsParsed = z.infer<typeof StairTypeParamsSchema>;

// ─── Family-type document ────────────────────────────────────────────────────

/** Shared tenant/meta fields for every family-type category. */
const BimFamilyTypeBaseShape = {
  id: z.string().min(1),
  name: z.string().min(1),
  scope: BimFamilyTypeScopeSchema,
  origin: BimFamilyTypeOriginSchema,
  companyId: z.string().min(1),
  ownerId: z.string().min(1),
  projectId: z.string().min(1).optional(),
  createdAt: z.unknown().optional(),
  createdBy: z.string().min(1).optional(),
  updatedAt: z.unknown().optional(),
  updatedBy: z.string().min(1).optional(),
} as const;

/**
 * Discriminated by `category` so `typeParams` is narrowed to the matching
 * payload — mirrors `BimFamilyType<C>` and `BimTypeParamsByCategory`.
 *
 * `createdAt`/`updatedAt` are `z.unknown().optional()`: the persisted value is a
 * Firestore `Timestamp | null` instance (not a plain object), so it is left
 * opaque here exactly like the persistence layer leaves BaseEntity tenant fields.
 */
export const BimFamilyTypeSchema = z.discriminatedUnion('category', [
  z
    .object({
      ...BimFamilyTypeBaseShape,
      category: z.literal('wall'),
      typeParams: WallTypeParamsSchema,
    })
    .strict(),
  z
    .object({
      ...BimFamilyTypeBaseShape,
      category: z.literal('slab'),
      typeParams: SlabTypeParamsSchema,
    })
    .strict(),
  z
    .object({
      ...BimFamilyTypeBaseShape,
      category: z.literal('stair'),
      typeParams: StairTypeParamsSchema,
    })
    .strict(),
  z
    .object({
      ...BimFamilyTypeBaseShape,
      category: z.literal('roof'),
      typeParams: RoofTypeParamsSchema,
    })
    .strict(),
]);

export type BimFamilyTypeParsed = z.infer<typeof BimFamilyTypeSchema>;
