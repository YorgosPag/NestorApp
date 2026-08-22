/**
 * Underfloor Heating Loop Zod Schemas (ADR-408 Εύρος Β #3) — strict runtime
 * validation. Validates the AREA-based hydronic terminal `MepUnderfloorParams` +
 * `MepUnderfloorEntity` (incl. IfcEntityMixin fields). Reuses the shared
 * `MepConnectorSchema` (ADR-408 Φ1).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import { z } from 'zod';
import { IfcGuidSchema, IfcPropertySetSchema } from './ifc-entity-mixin';
import { MepConnectorSchema } from './mep-connector.schemas';
import { BimPointSchema, PlanProfileSchema } from './geometry.schemas';

// ─── Point3D / Polygon3D ──────────────────────────────────────────────────────

// ─── Enums (mirror mep-underfloor-types.ts unions) ────────────────────────────

export const MepUnderfloorKindSchema = z.enum(['hydronic-loop']);

export const MepUnderfloorPatternSchema = z.enum([
  'boustrophedon',
  'counterflow-spiral',
  'spiral',
]);

export const MepUnderfloorIfcTypeSchema = z.literal('IfcSpaceHeater');

// ─── Params schema ────────────────────────────────────────────────────────────

export const MepUnderfloorParamsSchema = z
  .object({
    kind: MepUnderfloorKindSchema,
    footprint: PlanProfileSchema,
    pipeSpacingMm: z.number().positive(),
    edgeClearanceMm: z.number().nonnegative(),
    patternType: MepUnderfloorPatternSchema,
    entrySide: z.number().int().nonnegative().optional(),
    screedOffsetMm: z.number().finite(),
    connectorDiameterMm: z.number().positive(),
    thermalOutputW: z.number().positive().optional(),
    sceneUnits: z.string().optional(),
    floorId: z.string().min(1).optional(),
    name: z.string().optional(),
    // ADR-408 Φ1 — embedded MEP connectors (host-local / world-coord). Optional.
    connectors: z.array(MepConnectorSchema).optional(),
  })
  .strict();

export type MepUnderfloorParamsParsed = z.infer<typeof MepUnderfloorParamsSchema>;

// ─── Entity schema (focused factory output) ───────────────────────────────────

export const MepUnderfloorEntitySchema = z
  .object({
    id: z.string().min(1),
    type: z.literal('mep-underfloor'),
    kind: MepUnderfloorKindSchema,
    params: MepUnderfloorParamsSchema,
    ifcGuid: IfcGuidSchema,
    ifcType: MepUnderfloorIfcTypeSchema,
    pset: IfcPropertySetSchema.optional(),
  })
  .passthrough();

export type MepUnderfloorEntityParsed = z.infer<typeof MepUnderfloorEntitySchema>;
