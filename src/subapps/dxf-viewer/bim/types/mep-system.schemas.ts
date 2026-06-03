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
import { ElectricalSystemClassificationSchema } from './mep-connector.schemas';

export const MepSystemTypeSchema = z.enum(['electrical-circuit']);

export const MepSystemMemberSchema = z
  .object({
    entityId: z.string().min(1),
    connectorId: z.string().min(1),
  })
  .strict();

export const MepSystemParamsSchema = z
  .object({
    systemType: MepSystemTypeSchema,
    name: z.string().min(1),
    systemClassification: ElectricalSystemClassificationSchema,
    sourceEntityId: z.string().min(1),
    sourceConnectorId: z.string().min(1),
    members: z.array(MepSystemMemberSchema),
    // ADR-408 Φ5 — System-owned colour-by-system hex (Revit "System Colour").
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    // ADR-408 Φ7 — per-circuit wire-drawing style (Revit "Wiring Type").
    wireStyle: z.enum(['straight', 'orthogonal', 'arc']).optional(),
    ratedVoltage: z.number().positive().optional(),
    poles: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  })
  .strict();

export type MepSystemParamsParsed = z.infer<typeof MepSystemParamsSchema>;

/** Focused entity schema (passthrough for tenant/timestamp fields). */
export const MepSystemEntitySchema = z
  .object({
    id: z.string().min(1),
    params: MepSystemParamsSchema,
  })
  .passthrough();

export type MepSystemEntityParsed = z.infer<typeof MepSystemEntitySchema>;
