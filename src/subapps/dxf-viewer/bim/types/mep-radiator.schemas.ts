/**
 * Heating Radiator Zod Schemas (ADR-408 Εύρος Β #1) — strict runtime validation.
 *
 * Mirror of `mep-manifold.schemas.ts` for the point-based hydronic terminal.
 * Validates `MepRadiatorParams` + `MepRadiatorEntity` (incl. IfcEntityMixin
 * fields). Reuses the shared `MepConnectorSchema` (ADR-408 Φ1).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import { z } from 'zod';
import { IfcGuidSchema, IfcPropertySetSchema } from './ifc-entity-mixin';
import { MepConnectorSchema } from './mep-connector.schemas';
import { BimPointSchema } from './geometry.schemas';
import { PLACED_BODY_FIELDS, SCENE_HOST_FIELDS } from './shared-params.schemas';

// ─── Point3D ──────────────────────────────────────────────────────────────────

// ─── Enums (mirror mep-radiator-types.ts unions) ──────────────────────────────

export const MepRadiatorKindSchema = z.enum(['panel-radiator']);

export const MepRadiatorShapeSchema = z.enum(['rectangular']);

export const MepRadiatorIfcTypeSchema = z.literal('IfcSpaceHeater');

// ─── Params schema ────────────────────────────────────────────────────────────

export const MepRadiatorParamsSchema = z
  .object({
    kind: MepRadiatorKindSchema,
    shape: MepRadiatorShapeSchema,
    ...PLACED_BODY_FIELDS,
    connectorDiameterMm: z.number().positive(),
    // Optional catalogue thermal output (W) — drives future sizing.
    thermalOutputW: z.number().positive().optional(),
    ...SCENE_HOST_FIELDS,
    // ADR-408 Φ1 — embedded MEP connectors (host-local). Optional/additive.
    connectors: z.array(MepConnectorSchema).optional(),
  })
  .strict();

export type MepRadiatorParamsParsed = z.infer<typeof MepRadiatorParamsSchema>;

// ─── Entity schema (focused factory output) ───────────────────────────────────

export const MepRadiatorEntitySchema = z
  .object({
    id: z.string().min(1),
    type: z.literal('mep-radiator'),
    kind: MepRadiatorKindSchema,
    params: MepRadiatorParamsSchema,
    ifcGuid: IfcGuidSchema,
    ifcType: MepRadiatorIfcTypeSchema,
    pset: IfcPropertySetSchema.optional(),
  })
  .passthrough();

export type MepRadiatorEntityParsed = z.infer<typeof MepRadiatorEntitySchema>;
