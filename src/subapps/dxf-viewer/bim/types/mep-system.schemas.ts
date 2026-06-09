/**
 * MEP System Zod Schemas (ADR-408 Φ2) — strict runtime validation.
 *
 * Validates `MepSystemParams` + the persisted `MepSystemEntity` shape (params +
 * tenant fields; timestamps passthrough). Mirror of `mep-fixture.schemas.ts`.
 *
 * @see ./mep-system-types.ts
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import { z } from 'zod';
import {
  ElectricalSystemClassificationSchema,
  PlumbingSystemClassificationSchema,
  DuctSystemClassificationSchema,
  FuelSystemClassificationSchema,
  PipeFluidSchema,
} from './mep-connector.schemas';

export const MepSystemTypeSchema = z.enum([
  'electrical-circuit',
  'pipe-network',
  'duct-network',
  'fuel-network',
]);

export const MepSystemMemberSchema = z
  .object({
    entityId: z.string().min(1),
    connectorId: z.string().min(1),
  })
  .strict();

/** Hex colour — System-owned colour-by-system (Revit "System Colour"). */
const SystemColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/).optional();

/** ADR-408 Φ2 — electrical-circuit arm. */
export const MepElectricalSystemParamsSchema = z
  .object({
    systemType: z.literal('electrical-circuit'),
    name: z.string().min(1),
    systemClassification: ElectricalSystemClassificationSchema,
    sourceEntityId: z.string().min(1),
    sourceConnectorId: z.string().min(1),
    members: z.array(MepSystemMemberSchema),
    color: SystemColorSchema,
    // ADR-408 Φ7 — per-circuit wire-drawing style (Revit "Wiring Type").
    wireStyle: z.enum(['straight', 'orthogonal', 'arc']).optional(),
    // ADR-408 Φ7 FU#3 — per-segment user waypoints (Revit "Wire Vertex"),
    // keyed order-independently by the segment's host pair.
    wireWaypoints: z
      .record(z.string(), z.array(z.object({ x: z.number(), y: z.number() }).strict()))
      .optional(),
    // ADR-408 Φ7 — per-circuit conductor breakdown (Revit "#wires" / home-run
    // tick marks): hot (long ticks) / neutral (short) / ground (short + dot).
    conductors: z
      .object({
        hot: z.number().int().min(0).max(12),
        neutral: z.number().int().min(0).max(12),
        ground: z.number().int().min(0).max(12),
      })
      .strict()
      .optional(),
    ratedVoltage: z.number().positive().optional(),
    poles: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  })
  .strict();

/** ADR-408 Φ9 — pipe-network arm (plumbing). */
export const MepPipeSystemParamsSchema = z
  .object({
    systemType: z.literal('pipe-network'),
    name: z.string().min(1),
    systemClassification: PlumbingSystemClassificationSchema,
    sourceEntityId: z.string().min(1),
    sourceConnectorId: z.string().min(1),
    members: z.array(MepSystemMemberSchema),
    color: SystemColorSchema,
    diameterMm: z.number().positive().optional(),
    fluid: PipeFluidSchema.optional(),
  })
  .strict();

/** ADR-432 — duct-network arm (HVAC air: προσαγωγή / επιστροφή). */
export const MepDuctSystemParamsSchema = z
  .object({
    systemType: z.literal('duct-network'),
    name: z.string().min(1),
    systemClassification: DuctSystemClassificationSchema,
    sourceEntityId: z.string().min(1),
    sourceConnectorId: z.string().min(1),
    members: z.array(MepSystemMemberSchema),
    color: SystemColorSchema,
    diameterMm: z.number().positive().optional(),
  })
  .strict();

/** ADR-434 — fuel-network arm (gas/oil supply: τροφοδοσία αερίου). */
export const MepFuelSystemParamsSchema = z
  .object({
    systemType: z.literal('fuel-network'),
    name: z.string().min(1),
    systemClassification: FuelSystemClassificationSchema,
    sourceEntityId: z.string().min(1),
    sourceConnectorId: z.string().min(1),
    members: z.array(MepSystemMemberSchema),
    color: SystemColorSchema,
    diameterMm: z.number().positive().optional(),
  })
  .strict();

/** Discriminated union on `systemType` (ADR-408 Φ2 + Φ9 + ADR-432 duct + ADR-434 fuel). */
export const MepSystemParamsSchema = z.discriminatedUnion('systemType', [
  MepElectricalSystemParamsSchema,
  MepPipeSystemParamsSchema,
  MepDuctSystemParamsSchema,
  MepFuelSystemParamsSchema,
]);

export type MepSystemParamsParsed = z.infer<typeof MepSystemParamsSchema>;

/** Focused entity schema (passthrough for tenant/timestamp fields). */
export const MepSystemEntitySchema = z
  .object({
    id: z.string().min(1),
    params: MepSystemParamsSchema,
  })
  .passthrough();

export type MepSystemEntityParsed = z.infer<typeof MepSystemEntitySchema>;
