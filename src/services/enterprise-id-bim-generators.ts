/**
 * ENTERPRISE ID GENERATION — BIM / DXF DRAWING-MODE GENERATORS
 *
 * Extracted from `enterprise-id-class.ts` (2026-07-31) when that file crossed the
 * N.7.1 500-line ceiling. This is a **split, not a trim**: the BIM/DXF drawing
 * entities (ADR-363) plus the opening-component library (ADR-676) form one
 * coherent domain group, so they move out whole.
 *
 * Composition model — abstract base, not a mixin:
 *
 *   BimEntityIdGenerators (declares the engine it needs)
 *     ↑ extends
 *   EnterpriseIdService   (owns the engine: retry loop, cache, stats)
 *
 * The base declares `generateId` / `generateDeterministicId` as `protected
 * abstract` so the stateful engine keeps living in exactly one place — this file
 * adds naming, never generation logic. Consumers see no change: every method
 * below stays on the `enterpriseIdService` singleton surface.
 *
 * @module services/enterprise-id-bim-generators
 * @version 1.0.0
 */

import {
  ENTERPRISE_ID_PREFIXES,
  type EnterpriseIdPrefix,
  type EnterpriseId,
} from './enterprise-id-prefixes';

// Alias for compact generator methods
const P = ENTERPRISE_ID_PREFIXES;

export abstract class BimEntityIdGenerators {
  /** Implemented by {@link EnterpriseIdService} — uniqueness-retry loop + cache. */
  protected abstract generateId(prefix: EnterpriseIdPrefix): EnterpriseId;

  /** Implemented by {@link EnterpriseIdService} — seeded, repeatable, no retry loop. */
  protected abstract generateDeterministicId(prefix: EnterpriseIdPrefix, seed: string): string;

  // DXF BIM Drawing Mode (ADR-363)
  generateWallId(): string { return this.generateId(P.WALL).id; }
  generateOpeningId(): string { return this.generateId(P.OPENING).id; }
  generateSlabId(): string { return this.generateId(P.SLAB).id; }
  generateSlabOpeningId(): string { return this.generateId(P.SLAB_OPENING).id; }
  /** ADR-632 Φ5 — σταθερό slab-opening id ανά seed (auto stairwell opening: `stairId::slabId`). */
  generateDeterministicSlabOpeningId(seed: string): string { return this.generateDeterministicId(P.SLAB_OPENING, seed); }
  generateBimStackGroupId(): string { return this.generateId(P.BIM_STACK_GROUP).id; }
  generateColumnId(): string { return this.generateId(P.COLUMN).id; }
  generateBeamId(): string { return this.generateId(P.BEAM).id; }
  generateFoundationId(): string { return this.generateId(P.FOUNDATION).id; }
  generateGridGuideDocId(): string { return this.generateId(P.GRID_GUIDE).id; }
  generateTopoSurfaceId(): string { return this.generateId(P.TOPO_SURFACE).id; }
  generateMepFixtureId(): string { return this.generateId(P.MEP_FIXTURE).id; }
  generateMepSystemId(): string { return this.generateId(P.MEP_SYSTEM).id; }
  generateElectricalPanelId(): string { return this.generateId(P.ELECTRICAL_PANEL).id; }
  generateMepSegmentId(): string { return this.generateId(P.MEP_SEGMENT).id; }
  generateMepFittingId(): string { return this.generateId(P.MEP_FITTING).id; }
  generateMepManifoldId(): string { return this.generateId(P.MEP_MANIFOLD).id; }
  generateMepRadiatorId(): string { return this.generateId(P.MEP_RADIATOR).id; }
  generateMepBoilerId(): string { return this.generateId(P.MEP_BOILER).id; }
  generateMepWaterHeaterId(): string { return this.generateId(P.MEP_WATER_HEATER).id; }
  generateMepUnderfloorId(): string { return this.generateId(P.MEP_UNDERFLOOR).id; }
  generateRailingId(): string { return this.generateId(P.RAILING).id; }
  /** ADR-407 Φ7 — σταθερό railing id ανά seed (auto stair-hosted railing: `stairId::side`). */
  generateDeterministicRailingId(seed: string): string { return this.generateDeterministicId(P.RAILING, seed); }
  generateRoofId(): string { return this.generateId(P.ROOF).id; }
  generateFloorFinishId(): string { return this.generateId(P.FLOOR_FINISH).id; }
  generateWallCoveringId(): string { return this.generateId(P.WALL_COVERING).id; }
  generateHatchId(): string { return this.generateId(P.HATCH).id; }
  generateThermalSpaceId(): string { return this.generateId(P.THERMAL_SPACE).id; }
  generateSpaceSeparatorId(): string { return this.generateId(P.SPACE_SEPARATOR).id; }
  generateFurnitureId(): string { return this.generateId(P.FURNITURE).id; }
  generateImportedMeshId(): string { return this.generateId(P.IMPORTED_MESH).id; }
  generateGenericSolidId(): string { return this.generateId(P.GENERIC_SOLID).id; }
  generateFloorplanSymbolId(): string { return this.generateId(P.FLOORPLAN_SYMBOL).id; }
  generateBimPresetId(): string { return this.generateId(P.BIM_PRESET).id; }
  generateBimMaterialId(): string { return this.generateId(P.BIM_MATERIAL).id; }
  generateBlockLibraryItemId(): string { return this.generateId(P.BLOCK_LIBRARY_ITEM).id; }
  generateBimSettingsId(): string { return this.generateId(P.BIM_SETTINGS).id; }
  generateBimFamilyTypeId(): string { return this.generateId(P.BIM_FAMILY_TYPE).id; }

  // Opening Component Library — Frame Presets (ADR-676)
  generateOpeningFramePresetId(): string { return this.generateId(P.OPENING_FRAME_PRESET).id; }
}
