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

// ─── Point3D ──────────────────────────────────────────────────────────────────

const Point3DSchema = z
  .object({
    x: z.number().finite(),
    y: z.number().finite(),
    z: z.number().finite().optional(),
  })
  .strict();

// ─── Enums (mirror electrical-panel-types.ts unions) ──────────────────────────

export const ElectricalPanelKindSchema = z.enum(['distribution-board', 'comms-rack']);

export const ElectricalPanelShapeSchema = z.enum(['rectangular']);

export const ElectricalPanelIfcTypeSchema = z.literal('IfcElectricDistributionBoard');

// ─── Params schema ────────────────────────────────────────────────────────────

export const ElectricalPanelParamsSchema = z
  .object({
    kind: ElectricalPanelKindSchema,
    shape: ElectricalPanelShapeSchema,
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
