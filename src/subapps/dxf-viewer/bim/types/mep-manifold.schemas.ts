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
import { MepConnectorSchema, PlumbingSystemClassificationSchema } from './mep-connector.schemas';
import { Point3DSchema } from './geometry.schemas';
import { PLACED_BODY_FIELDS, SCENE_HOST_FIELDS } from './shared-params.schemas';

// ─── Point3D ──────────────────────────────────────────────────────────────────

// ─── Enums (mirror mep-manifold-types.ts unions) ──────────────────────────────

export const MepManifoldKindSchema = z.enum(['floor-manifold', 'drainage-collector']);

export const MepManifoldShapeSchema = z.enum(['rectangular']);

// ADR-408 Φ14 — kind-dependent IFC class (SSoT `resolveManifoldIfcType`): a water
// manifold is `IfcPipeFitting`, a drainage collector (φρεάτιο) is the sump/catch
// basin `IfcFlowStorageDevice`. Both accepted at the persistence boundary.
export const MepManifoldIfcTypeSchema = z.enum(['IfcPipeFitting', 'IfcFlowStorageDevice']);

// ─── Params schema ────────────────────────────────────────────────────────────

export const MepManifoldParamsSchema = z
  .object({
    kind: MepManifoldKindSchema,
    shape: MepManifoldShapeSchema,
    ...PLACED_BODY_FIELDS,
    outletCount: z.number().int().positive(),
    inletDiameterMm: z.number().positive(),
    outletDiameterMm: z.number().positive(),
    // ADR-408 Φ-heating — manifold-owned hydraulic classification (ύδρευση/θέρμανση).
    // Optional/additive: absent docs default to domestic-cold-water at read time.
    systemClassification: PlumbingSystemClassificationSchema.optional(),
    ...SCENE_HOST_FIELDS,
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
