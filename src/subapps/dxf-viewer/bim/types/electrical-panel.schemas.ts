/**
 * Electrical Panel Zod Schemas (ADR-408 Φ3) — strict runtime validation.
 *
 * Mirror of `mep-fixture.schemas.ts` for the point-based circuit source.
 * Validates `ElectricalPanelParams` + `ElectricalPanelEntity` (incl.
 * IfcEntityMixin fields). Reuses the shared `MepConnectorSchema` (ADR-408 Φ1).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import { z } from 'zod';
import { IfcGuidSchema, IfcPropertySetSchema } from './ifc-entity-mixin';
import { MepConnectorSchema } from './mep-connector.schemas';
import { BimPointSchema } from './geometry.schemas';
import { PLACED_BODY_FIELDS, SCENE_HOST_FIELDS } from './shared-params.schemas';

// ─── Point3D ──────────────────────────────────────────────────────────────────

// ─── Enums (mirror electrical-panel-types.ts unions) ──────────────────────────

export const ElectricalPanelKindSchema = z.enum(['distribution-board', 'comms-rack']);

export const ElectricalPanelShapeSchema = z.enum(['rectangular']);

export const ElectricalPanelIfcTypeSchema = z.literal('IfcElectricDistributionBoard');

// ─── Params schema ────────────────────────────────────────────────────────────

export const ElectricalPanelParamsSchema = z
  .object({
    kind: ElectricalPanelKindSchema,
    shape: ElectricalPanelShapeSchema,
    ...PLACED_BODY_FIELDS,
    ...SCENE_HOST_FIELDS,
    // ADR-408 Φ1 — embedded MEP connectors (host-local). Optional/additive.
    connectors: z.array(MepConnectorSchema).optional(),
  })
  .strict();

export type ElectricalPanelParamsParsed = z.infer<typeof ElectricalPanelParamsSchema>;

// ─── Entity schema (focused factory output) ───────────────────────────────────

export const ElectricalPanelEntitySchema = z
  .object({
    id: z.string().min(1),
    type: z.literal('electrical-panel'),
    kind: ElectricalPanelKindSchema,
    params: ElectricalPanelParamsSchema,
    ifcGuid: IfcGuidSchema,
    ifcType: ElectricalPanelIfcTypeSchema,
    pset: IfcPropertySetSchema.optional(),
  })
  .passthrough();

export type ElectricalPanelEntityParsed = z.infer<typeof ElectricalPanelEntitySchema>;
