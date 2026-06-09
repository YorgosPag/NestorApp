/**
 * MEP Connector Zod Schemas (ADR-408 Φ1) — strict runtime validation.
 *
 * Validates the embedded `MepConnector` sub-object carried by MEP component
 * params (`MepConnectorHostParams.connectors`). Reused by `mep-fixture.schemas`
 * (and the electrical-panel schema, Φ3).
 *
 * @see ./mep-connector-types.ts
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import { z } from 'zod';

const Point3DSchema = z
  .object({
    x: z.number().finite(),
    y: z.number().finite(),
    z: z.number().finite().optional(),
  })
  .strict();

export const MepConnectorDomainSchema = z.enum(['electrical', 'duct', 'pipe', 'fuel']);

export const MepFlowDirectionSchema = z.enum(['in', 'out', 'bidirectional']);

export const ElectricalSystemClassificationSchema = z.enum([
  'power',
  'lighting',
  'data',
  'controls',
]);

/** ADR-408 Φ9 — plumbing/piping system classification. */
export const PlumbingSystemClassificationSchema = z.enum([
  'domestic-cold-water',
  'domestic-hot-water',
  'sanitary-drainage',
  'hydronic-supply',
  'hydronic-return',
]);

/** ADR-408 Φ9 — conveyed fluid. */
export const PipeFluidSchema = z.enum(['water', 'hot-water', 'wastewater', 'glycol', 'other']);

/** ADR-408 (duct domain foundation) — duct system classification (opening: flue exhaust). */
export const DuctSystemClassificationSchema = z.enum(['exhaust']);

/** ADR-408 (fuel domain foundation) — fuel system classification (gas/oil supply). */
export const FuelSystemClassificationSchema = z.enum(['fuel-gas', 'fuel-oil']);

export const MepElectricalConnectorParamsSchema = z
  .object({
    systemClassification: ElectricalSystemClassificationSchema,
    voltage: z.number().positive().optional(),
    poles: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
    connectedLoadVa: z.number().nonnegative().optional(),
    numberOfPhases: z.union([z.literal(1), z.literal(3)]).optional(),
  })
  .strict();

/** ADR-408 Φ9 — plumbing/piping connector params (present when domain === 'pipe'). */
export const MepPipeConnectorParamsSchema = z
  .object({
    systemClassification: PlumbingSystemClassificationSchema,
    diameterMm: z.number().positive().optional(),
    fluid: PipeFluidSchema.optional(),
    slopePercent: z.number().optional(),
    flowLps: z.number().nonnegative().optional(),
  })
  .strict();

/** ADR-408 (duct domain foundation) — duct connector params (present when domain === 'duct'). */
export const MepDuctConnectorParamsSchema = z
  .object({
    systemClassification: DuctSystemClassificationSchema,
    diameterMm: z.number().positive().optional(),
  })
  .strict();

/** ADR-408 (fuel domain foundation) — fuel connector params (present when domain === 'fuel'). */
export const MepFuelConnectorParamsSchema = z
  .object({
    systemClassification: FuelSystemClassificationSchema,
    diameterMm: z.number().positive().optional(),
  })
  .strict();

export const MepConnectorSchema = z
  .object({
    connectorId: z.string().min(1),
    domain: MepConnectorDomainSchema,
    flow: MepFlowDirectionSchema,
    localPosition: Point3DSchema,
    localDirection: Point3DSchema.optional(),
    electrical: MepElectricalConnectorParamsSchema.optional(),
    pipe: MepPipeConnectorParamsSchema.optional(),
    duct: MepDuctConnectorParamsSchema.optional(),
    fuel: MepFuelConnectorParamsSchema.optional(),
    systemId: z.string().min(1).optional(),
  })
  .strict();

export type MepConnectorParsed = z.infer<typeof MepConnectorSchema>;
