/**
 * Plumbing Manifold Zod Schemas (ADR-408 Φ12) — strict runtime validation.
 *
 * Mirror of `electrical-panel.schemas.ts` for the point-based plumbing
 * distribution source. Validates `MepManifoldParams` + `MepManifoldEntity` (incl.
 * IfcEntityMixin fields). Reuses the shared `MepConnectorSchema` (ADR-408 Φ1).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import { z } from 'zod';
import { IfcGuidSchema, IfcPropertySetSchema } from './ifc-entity-mixin';
import { MepConnectorSchema } from './mep-connector.schemas';

// ─── Point3D ──────────────────────────────────────────────────────────────────

const Point3DSchema = z
  .object({
    x: z.number().finite(),
    y: z.number().finite(),
    z: z.number().finite().optional(),
  })
  .strict();

// ─── Enums (mirror mep-manifold-types.ts unions) ──────────────────────────────

export const MepManifoldKindSchema = z.enum(['floor-manifold']);

export const MepManifoldShapeSchema = z.enum(['rectangular']);

export const MepManifoldIfcTypeSchema = z.literal('IfcPipeFitting');

// ─── Params schema ────────────────────────────────────────────────────────────

export const MepManifoldParamsSchema = z
  .object({
    kind: MepManifoldKindSchema,
    shape: MepManifoldShapeSchema,
    position: Point3DSchema,
    rotation: z.number().finite(),
    width: z.number().positive(),
    length: z.number().positive(),
    bodyHeightMm: z.number().positive(),
    mountingElevationMm: z.number().finite(),
    outletCount: z.number().int().positive(),
    inletDiameterMm: z.number().positive(),
    outletDiameterMm: z.number().positive(),
    sceneUnits: z.string().optional(),
    storeyId: z.string().min(1).optional(),
    material: z.string().min(1).optional(),
    hostId: z.string().min(1).optional(),
    // ADR-408 Φ1 — embedded MEP connectors (host-local). Optional/additive.
    connectors: z.array(MepConnectorSchema).optional(),
  })
  .strict();

export type MepManifoldParamsParsed = z.infer<typeof MepManifoldParamsSchema>;

// ─── Entity schema (focused factory output) ───────────────────────────────────

export const MepManifoldEntitySchema = z
  .object({
    id: z.string().min(1),
    type: z.literal('mep-manifold'),
    kind: MepManifoldKindSchema,
    params: MepManifoldParamsSchema,
    ifcGuid: IfcGuidSchema,
    ifcType: MepManifoldIfcTypeSchema,
    pset: IfcPropertySetSchema.optional(),
  })
  .passthrough();

export type MepManifoldEntityParsed = z.infer<typeof MepManifoldEntitySchema>;
