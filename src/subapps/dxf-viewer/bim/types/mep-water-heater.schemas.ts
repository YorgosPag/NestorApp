/**
 * Domestic Hot Water Heater Zod Schemas (ADR-408 DHW) — strict runtime validation.
 *
 * Mirror of `mep-boiler.schemas.ts` for the point-based domestic-hot-water SOURCE.
 * Validates `MepWaterHeaterParams` + `MepWaterHeaterEntity` (incl. IfcEntityMixin
 * fields). Reuses the shared `MepConnectorSchema` (ADR-408 Φ1). Like the boiler, the
 * heater owns a `systemClassification` (the network it sources inherits it) — defaulting
 * to `domestic-hot-water`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import { z } from 'zod';
import { IfcGuidSchema, IfcPropertySetSchema } from './ifc-entity-mixin';
import { MepConnectorSchema } from './mep-connector.schemas';
import { BimPointSchema } from './geometry.schemas';
import { PLACED_BODY_FIELDS, SCENE_HOST_FIELDS } from './shared-params.schemas';

// ─── Point3D ──────────────────────────────────────────────────────────────────

// ─── Enums (mirror mep-water-heater-types.ts unions) ──────────────────────────

export const MepWaterHeaterKindSchema = z.enum(['electric-water-heater']);

export const MepWaterHeaterShapeSchema = z.enum(['rectangular']);

export const MepWaterHeaterIfcTypeSchema = z.literal('IfcUnitaryEquipment');

/** Hydraulic classification the heater sources (mirror PlumbingSystemClassification). */
const SystemClassificationSchema = z.enum([
  'domestic-cold-water',
  'domestic-hot-water',
  'sanitary-drainage',
  'hydronic-supply',
  'hydronic-return',
]);

// ─── Params schema ────────────────────────────────────────────────────────────

export const MepWaterHeaterParamsSchema = z
  .object({
    kind: MepWaterHeaterKindSchema,
    shape: MepWaterHeaterShapeSchema,
    ...PLACED_BODY_FIELDS,
    connectorDiameterMm: z.number().positive(),
    // The domestic-hot-water classification the heater sources (network inherits it).
    systemClassification: SystemClassificationSchema.optional(),
    // Optional catalogue heating element power (W) — drives future sizing.
    thermalOutputW: z.number().positive().optional(),
    // Optional catalogue storage tank capacity (L) — DHW-specific.
    tankCapacityL: z.number().positive().optional(),
    ...SCENE_HOST_FIELDS,
    // ADR-408 Φ1 — embedded MEP connectors (host-local). Optional/additive.
    connectors: z.array(MepConnectorSchema).optional(),
  })
  .strict();

export type MepWaterHeaterParamsParsed = z.infer<typeof MepWaterHeaterParamsSchema>;

// ─── Entity schema (focused factory output) ───────────────────────────────────

export const MepWaterHeaterEntitySchema = z
  .object({
    id: z.string().min(1),
    type: z.literal('mep-water-heater'),
    kind: MepWaterHeaterKindSchema,
    params: MepWaterHeaterParamsSchema,
    ifcGuid: IfcGuidSchema,
    ifcType: MepWaterHeaterIfcTypeSchema,
    pset: IfcPropertySetSchema.optional(),
  })
  .passthrough();

export type MepWaterHeaterEntityParsed = z.infer<typeof MepWaterHeaterEntitySchema>;
