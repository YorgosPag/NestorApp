/**
 * MEP Fixture Zod Schemas (ADR-406) — strict runtime validation.
 *
 * Mirror of `column.schemas.ts` for the point-based fixture. Validates
 * `MepFixtureParams` + `MepFixtureEntity` (incl. IfcEntityMixin fields).
 *
 * Refinements:
 *   - `shape === 'circular'` MUST NOT carry a meaningful `length` mismatch — we
 *     don't hard-reject (length is simply ignored), but `width` (diameter) and
 *     `length` must both be positive so the geometry stays well-defined.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-406-point-based-mep-fixture.md
 */

import { z } from 'zod';
import { IfcGuidSchema, IfcPropertySetSchema } from './ifc-entity-mixin';
import { MepConnectorSchema } from './mep-connector.schemas';

// ─── Point3D ────────────────────────────────────────────────────────────────

const Point3DSchema = z
  .object({
    x: z.number().finite(),
    y: z.number().finite(),
    z: z.number().finite().optional(),
  })
  .strict();

// ─── Enums (mirror mep-fixture-types.ts unions) ──────────────────────────────

export const MepFixtureKindSchema = z.enum(['light-fixture']);

export const MepFixtureShapeSchema = z.enum(['rectangular', 'circular']);

export const MepFixtureIfcTypeSchema = z.literal('IfcLightFixture');

// ─── Params schema ──────────────────────────────────────────────────────────

export const MepFixtureParamsSchema = z
  .object({
    kind: MepFixtureKindSchema,
    shape: MepFixtureShapeSchema,
    position: Point3DSchema,
    rotation: z.number().finite(),
    width: z.number().positive(),
    length: z.number().positive(),
    bodyHeightMm: z.number().positive(),
    mountingElevationMm: z.number().finite(),
    sceneUnits: z.string().optional(),
    storeyId: z.string().min(1).optional(),
    material: z.string().min(1).optional(),
    hostId: z.string().min(1).optional(),
    // ADR-411 — optional CC0 mesh representation (back-compat: absent = parametric).
    assetId: z.string().min(1).optional(),
    scaleOverride: z.number().positive().optional(),
    // ADR-408 Φ1 — embedded MEP connectors (host-local). Optional/additive.
    connectors: z.array(MepConnectorSchema).optional(),
  })
  .strict();

export type MepFixtureParamsParsed = z.infer<typeof MepFixtureParamsSchema>;

// ─── Entity schema (focused factory output) ─────────────────────────────────

export const MepFixtureEntitySchema = z
  .object({
    id: z.string().min(1),
    type: z.literal('mep-fixture'),
    kind: MepFixtureKindSchema,
    params: MepFixtureParamsSchema,
    ifcGuid: IfcGuidSchema,
    ifcType: MepFixtureIfcTypeSchema,
    pset: IfcPropertySetSchema.optional(),
  })
  .passthrough();

export type MepFixtureEntityParsed = z.infer<typeof MepFixtureEntitySchema>;
