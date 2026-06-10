/**
 * IFC Entity Mixin (ADR-369 §9 Q8) — Phase A1
 *
 * Shared schema applied σε κάθε BIM entity (Wall / Slab / Beam / Column / Opening)
 * για future IFC4 export readiness. Τρία πεδία:
 *   - ifcGuid : 22-char IFC4-compressed UUID, stable per entity lifetime
 *   - ifcType : IFC4 class name (IfcWall / IfcSlab / IfcBeam / IfcColumn / IfcDoor / IfcWindow)
 *   - pset    : Property Sets payload (sparse, lazily populated)
 *
 * Generated ONCE on entity creation μέσω `generateIfcGuid()` από
 * `@/services/enterprise-id-convenience`. NEVER regenerate.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-369-bim-elevation-convention-revit-alignment.md §9 Q8
 */

import { z } from 'zod';

// ─── Type unions ─────────────────────────────────────────────────────────────

export type IfcEntityType =
  | 'IfcWall'
  | 'IfcWallStandardCase'
  | 'IfcSlab'
  | 'IfcBeam'
  | 'IfcColumn'
  | 'IfcDoor'
  | 'IfcWindow'
  // ADR-406 — MEP point-based fixtures (IfcFlowTerminal family).
  | 'IfcLightFixture'
  // ADR-407 — path-based railing (handrail/guardrail/balustrade).
  | 'IfcRailing'
  // ADR-408 Φ3 — electrical panel (panelboard / consumer unit).
  | 'IfcElectricDistributionBoard'
  // ADR-410 — mesh-based furniture (IfcFurnishingElement family, IFC4 ADD2).
  | 'IfcFurniture'
  // ADR-408 Φ8 — linear MEP segments (IfcDistributionFlowElement family).
  | 'IfcDuctSegment'
  | 'IfcPipeSegment'
  // ADR-408 Φ11 — auto pipe/duct fittings (IfcFlowFitting family).
  | 'IfcPipeFitting'
  | 'IfcDuctFitting'
  // ADR-408 Φ14 — drainage collector / φρεάτιο (sump/catch basin; IfcFlowStorageDevice family).
  | 'IfcFlowStorageDevice'
  // ADR-415 — sanitary plan symbols (WC/washbasin/…; IfcSanitaryTerminal family).
  | 'IfcSanitaryTerminal'
  // ADR-408 Δρόμος B — connectable household appliance (washing machine; Electrical Appliance family).
  | 'IfcElectricAppliance'
  // ADR-417 — parametric pitched roof container (IfcRoofTypeEnum on derived shape).
  | 'IfcRoof'
  // ADR-408 Εύρος Β — hydronic heating terminal (radiator; IfcFlowTerminal family).
  | 'IfcSpaceHeater'
  // ADR-408 Eyros B #2 — hydronic heat source (boiler; Mechanical Equipment family).
  | 'IfcBoiler'
  // ADR-408 DHW — domestic hot water heater / θερμοσίφωνας (packaged plumbing equipment).
  | 'IfcUnitaryEquipment'
  // ADR-419 — thin floor covering per room (IfcCovering FLOORING).
  | 'IfcCovering'
  // ADR-422 — analytical thermal space / θερμικός χώρος (HVAC analytical space).
  | 'IfcSpace'
  // ADR-430/431 — electrical/data receptacle (socket / data outlet; IfcOutlet, IfcFlowTerminal family).
  | 'IfcOutlet'
  // ADR-432 — HVAC supply diffuser (στόμιο; IfcAirTerminal, IfcFlowTerminal family).
  | 'IfcAirTerminal'
  // ADR-433 — fire sprinkler head (καταιονητήρας; IfcFireSuppressionTerminal, IfcFlowTerminal family).
  | 'IfcFireSuppressionTerminal'
  // ADR-433 — fire riser / control-valve assembly source (στήλη πυρόσβεσης; IfcFlowController family).
  | 'IfcFlowController'
  // ADR-434 — gas meter (μετρητής αερίου; IfcFlowMeter, fuel-network source) + gas cooker/hob
  // (εστία αερίου; IfcBurner, gas appliance terminal).
  | 'IfcFlowMeter'
  | 'IfcBurner'
  // ADR-436 — θεμελίωση: shallow footing (πέδιλο/πεδιλοδοκός/συνδετήρια δοκός).
  | 'IfcFooting';

export const IFC_ENTITY_TYPE_VALUES: readonly IfcEntityType[] = [
  'IfcWall',
  'IfcWallStandardCase',
  'IfcSlab',
  'IfcBeam',
  'IfcColumn',
  'IfcDoor',
  'IfcWindow',
  // ADR-406 — MEP point-based fixtures.
  'IfcLightFixture',
  // ADR-407 — path-based railing.
  'IfcRailing',
  // ADR-408 Φ3 — electrical panel.
  'IfcElectricDistributionBoard',
  // ADR-410 — mesh-based furniture.
  'IfcFurniture',
  // ADR-408 Φ8 — linear MEP segments.
  'IfcDuctSegment',
  'IfcPipeSegment',
  // ADR-408 Φ11 — auto pipe/duct fittings.
  'IfcPipeFitting',
  'IfcDuctFitting',
  // ADR-408 Φ14 — drainage collector / φρεάτιο (sump/catch basin).
  'IfcFlowStorageDevice',
  // ADR-415 — sanitary plan symbols.
  'IfcSanitaryTerminal',
  // ADR-408 Δρόμος B — connectable household appliance (washing machine).
  'IfcElectricAppliance',
  // ADR-417 — parametric pitched roof container.
  'IfcRoof',
  // ADR-408 Εύρος Β — hydronic heating terminal (radiator).
  'IfcSpaceHeater',
  // ADR-408 Εύρος Β #2 — hydronic heat source (boiler).
  'IfcBoiler',
  // ADR-408 DHW — domestic hot water heater / θερμοσίφωνας.
  'IfcUnitaryEquipment',
  // ADR-419 — thin floor covering per room.
  'IfcCovering',
  // ADR-422 — analytical thermal space (IfcSpace).
  'IfcSpace',
  // ADR-430/431 — electrical/data receptacle (socket / data outlet).
  'IfcOutlet',
  // ADR-432 — HVAC supply diffuser (στόμιο).
  'IfcAirTerminal',
  // ADR-433 — fire sprinkler head (καταιονητήρας).
  'IfcFireSuppressionTerminal',
  // ADR-433 — fire riser / control-valve assembly source (στήλη πυρόσβεσης).
  'IfcFlowController',
  // ADR-434 — gas meter (μετρητής αερίου) + gas cooker/hob (εστία αερίου).
  'IfcFlowMeter',
  'IfcBurner',
  // ADR-436 — θεμελίωση: shallow footing.
  'IfcFooting',
] as const;

export type IfcPropertySetValue = string | number | boolean | null;

export type IfcPropertySet = Readonly<Record<string, IfcPropertySetValue>>;

// ─── Interface ───────────────────────────────────────────────────────────────

export interface IfcEntityMixin {
  /** 22-char IFC4 base64-compressed UUID — generated once, immutable. */
  readonly ifcGuid: string;
  readonly ifcType: IfcEntityType;
  /** Sparse Property Set payload — populated on demand by IFC writer / consumers. */
  readonly pset?: IfcPropertySet;
}

// ─── Zod schemas (strict) ────────────────────────────────────────────────────

/** IFC4 GlobalId char set: digits, letters, underscore, dollar — exactly 22 chars. */
export const IFC_GUID_REGEX = /^[0-9A-Za-z_$]{22}$/;

export const IfcGuidSchema = z
  .string()
  .regex(IFC_GUID_REGEX, 'Invalid IFC4 GlobalId — must be 22 chars from [0-9A-Za-z_$]');

export const IfcEntityTypeSchema = z.enum([
  'IfcWall',
  'IfcWallStandardCase',
  'IfcSlab',
  'IfcBeam',
  'IfcColumn',
  'IfcDoor',
  'IfcWindow',
  // ADR-406 — MEP point-based fixtures.
  'IfcLightFixture',
  // ADR-407 — path-based railing.
  'IfcRailing',
  // ADR-408 Φ3 — electrical panel.
  'IfcElectricDistributionBoard',
  // ADR-410 — mesh-based furniture.
  'IfcFurniture',
  // ADR-408 Φ8 — linear MEP segments.
  'IfcDuctSegment',
  'IfcPipeSegment',
  // ADR-408 Φ11 — auto pipe/duct fittings.
  'IfcPipeFitting',
  'IfcDuctFitting',
  // ADR-408 Φ14 — drainage collector / φρεάτιο (sump/catch basin).
  'IfcFlowStorageDevice',
  // ADR-415 — sanitary plan symbols.
  'IfcSanitaryTerminal',
  // ADR-408 Δρόμος B — connectable household appliance (washing machine).
  'IfcElectricAppliance',
  // ADR-417 — parametric pitched roof container.
  'IfcRoof',
  // ADR-408 Εύρος Β — hydronic heating terminal (radiator).
  'IfcSpaceHeater',
  // ADR-408 Εύρος Β #2 — hydronic heat source (boiler).
  'IfcBoiler',
  // ADR-408 DHW — domestic hot water heater / θερμοσίφωνας.
  'IfcUnitaryEquipment',
  // ADR-419 — thin floor covering per room.
  'IfcCovering',
  // ADR-422 — analytical thermal space (IfcSpace).
  'IfcSpace',
  // ADR-430/431 — electrical/data receptacle (socket / data outlet).
  'IfcOutlet',
  // ADR-432 — HVAC supply diffuser (στόμιο) + air handling unit (ΚΚΜ).
  'IfcAirTerminal',
  // ADR-433 — fire sprinkler head (καταιονητήρας) + fire riser (στήλη πυρόσβεσης).
  'IfcFireSuppressionTerminal',
  'IfcFlowController',
  // ADR-434 — gas meter (μετρητής αερίου) + gas cooker/hob (εστία αερίου).
  'IfcFlowMeter',
  'IfcBurner',
  // ADR-436 — θεμελίωση: shallow footing.
  'IfcFooting',
]);

export const IfcPropertySetValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
]);

export const IfcPropertySetSchema = z.record(z.string().min(1), IfcPropertySetValueSchema);

export const IfcEntityMixinSchema = z
  .object({
    ifcGuid: IfcGuidSchema,
    ifcType: IfcEntityTypeSchema,
    pset: IfcPropertySetSchema.optional(),
  })
  .strict();

export type IfcEntityMixinParsed = z.infer<typeof IfcEntityMixinSchema>;
