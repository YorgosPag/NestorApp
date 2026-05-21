/**
 * IFC Standard Pset Templates (ADR-369 §9 Q8.2)
 *
 * Eight IFC4 standard Property Set templates with default values.
 * Used by `PsetEditor` when the user loads a template for a BIM entity.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-369-bim-elevation-convention-revit-alignment.md §Q8.2
 */

import type { IfcPropertySet } from '../../../bim/types/ifc-entity-mixin';

// ─── Standard Pset templates ──────────────────────────────────────────────────

export const PSET_TEMPLATES: Readonly<Record<string, IfcPropertySet>> = {
  Pset_WallCommon: {
    Reference: '',
    IsExternal: false,
    LoadBearing: false,
    ThermalTransmittance: 0,
    FireRating: '',
  },
  Pset_SlabCommon: {
    PitchAngle: 0,
    IsExternal: false,
    LoadBearing: true,
  },
  Pset_ColumnCommon: {
    Reference: '',
    LoadBearing: true,
    FireRating: '',
  },
  Pset_BeamCommon: {
    Reference: '',
    LoadBearing: true,
    FireRating: '',
  },
  Pset_DoorCommon: {
    Reference: '',
    FireRating: '',
    AcousticRating: '',
  },
  Pset_WindowCommon: {
    Reference: '',
    ThermalTransmittance: 0,
    GlazingAreaFraction: 0,
  },
  Pset_BuildingStoreyCommon: {
    EntranceLevel: false,
    AboveGround: true,
    GrossPlannedArea: 0,
    NetPlannedArea: 0,
  },
  Pset_BuildingCommon: {
    BuildingID: '',
    IsLandmarked: false,
    OccupancyType: '',
    GrossPlannedArea: 0,
  },
} as const;

// ─── Default Pset per BIM entity type ────────────────────────────────────────

export type BimPsetEntityType = 'wall' | 'slab' | 'column' | 'beam' | 'opening';

export const DEFAULT_PSET_FOR_ENTITY: Readonly<Record<BimPsetEntityType, string>> = {
  wall: 'Pset_WallCommon',
  slab: 'Pset_SlabCommon',
  column: 'Pset_ColumnCommon',
  beam: 'Pset_BeamCommon',
  opening: 'Pset_DoorCommon',
} as const;
