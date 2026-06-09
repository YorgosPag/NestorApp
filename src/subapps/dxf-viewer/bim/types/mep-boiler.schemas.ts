/**
 * Heating Boiler Zod Schemas (ADR-408 Εύρος Β #2) — strict runtime validation.
 *
 * Mirror of `mep-radiator.schemas.ts` for the point-based hydronic SOURCE.
 * Validates `MepBoilerParams` + `MepBoilerEntity` (incl. IfcEntityMixin fields).
 * Reuses the shared `MepConnectorSchema` (ADR-408 Φ1). Unlike the radiator, the
 * boiler owns a `systemClassification` (the network it sources inherits it).
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

// ─── Enums (mirror mep-boiler-types.ts unions) ────────────────────────────────

export const MepBoilerKindSchema = z.enum(['wall-boiler']);

export const MepBoilerShapeSchema = z.enum(['rectangular']);

export const MepBoilerIfcTypeSchema = z.literal('IfcBoiler');

/** Hydraulic classification the boiler sources (mirror PlumbingSystemClassification). */
const SystemClassificationSchema = z.enum([
  'domestic-cold-water',
  'domestic-hot-water',
  'sanitary-drainage',
  'hydronic-supply',
  'hydronic-return',
]);

// ─── Params schema ────────────────────────────────────────────────────────────

export const MepBoilerParamsSchema = z
  .object({
    kind: MepBoilerKindSchema,
    shape: MepBoilerShapeSchema,
    position: Point3DSchema,
    rotation: z.number().finite(),
    width: z.number().positive(),
    length: z.number().positive(),
    bodyHeightMm: z.number().positive(),
    mountingElevationMm: z.number().finite(),
    connectorDiameterMm: z.number().positive(),
    // The hydronic classification the boiler sources (network inherits it).
    systemClassification: SystemClassificationSchema.optional(),
    // COMBI flag — when set, the boiler also sources a domestic-hot-water network.
    producesDhw: z.boolean().optional(),
    // DHW RECIRCULATION flag — combi-gated; seeds a recirc return inlet on the DHW network.
    dhwRecirculation: z.boolean().optional(),
    // COMBI DHW connector diameter (hot outlet + cold inlet); falls back to connectorDiameterMm.
    dhwConnectorDiameterMm: z.number().positive().optional(),
    // Combustion flue (καπναγωγός) diameter — gas/oil only; falls back to DEFAULT_BOILER_FLUE_DIAMETER_MM.
    flueDiameterMm: z.number().positive().optional(),
    // Combustion fuel supply (τροφοδοσία καυσίμου) diameter — gas/oil only; falls back to DEFAULT_BOILER_FUEL_DIAMETER_MM.
    fuelConnectorDiameterMm: z.number().positive().optional(),
    // Combustion flue VENT TERMINAL type (Revit «Vent Terminal») — gas/oil only; falls back to DEFAULT_FLUE_TERMINATION.
    flueTermination: z.enum(['roof-cowl', 'wall-horizontal', 'balanced-concentric']).optional(),
    // Optional catalogue thermal output (W) — drives future sizing.
    thermalOutputW: z.number().positive().optional(),
    // Seasonal appliance efficiency (%) — drives the EU ErP energy class. Optional/additive.
    seasonalEfficiencyPercent: z.number().positive().optional(),
    sceneUnits: z.string().optional(),
    storeyId: z.string().min(1).optional(),
    material: z.string().min(1).optional(),
    hostId: z.string().min(1).optional(),
    // ADR-408 Type Catalog — persisted catalog model id (kebab). Optional/additive.
    modelId: z.string().min(1).optional(),
    // Heating fuel / energy source discriminator (populated by catalog picker).
    fuelType: z.enum(['gas', 'oil', 'electric', 'heat-pump']).optional(),
    // ADR-408 Φ1 — embedded MEP connectors (host-local). Optional/additive.
    connectors: z.array(MepConnectorSchema).optional(),
  })
  .strict();

export type MepBoilerParamsParsed = z.infer<typeof MepBoilerParamsSchema>;

// ─── Entity schema (focused factory output) ───────────────────────────────────

export const MepBoilerEntitySchema = z
  .object({
    id: z.string().min(1),
    type: z.literal('mep-boiler'),
    kind: MepBoilerKindSchema,
    params: MepBoilerParamsSchema,
    ifcGuid: IfcGuidSchema,
    ifcType: MepBoilerIfcTypeSchema,
    pset: IfcPropertySetSchema.optional(),
  })
  .passthrough();

export type MepBoilerEntityParsed = z.infer<typeof MepBoilerEntitySchema>;
