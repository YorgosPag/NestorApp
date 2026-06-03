import type { BimCategory, ObjectStyle } from '../../config/bim-object-styles';
import type { BuildingRef, FloorRef } from '../../bim/utils/bim-floor-utils';
import type { BuildingVisMode } from '../utils/building-visibility-state';
import type { FloorVisMode } from '../utils/floor-visibility-state';
import type { Discipline } from '../../bim/discipline/bim-discipline';

/**
 * Per-floor sync context shared by `BimSceneLayer` and its envelope scene
 * builder. Assembled once per floor (single + multi-floor paths) and threaded
 * read-only into every entity/zone renderer.
 */
export interface SyncContext {
  readonly objectStyles: Partial<Record<BimCategory, ObjectStyle>>;
  /** ADR-405 §4 — per-discipline visibility (Revit "View Discipline"). */
  readonly disciplineVisibility: Partial<Record<Discipline, boolean>>;
  /** ADR-408 Φ5 — colour-by-system: `entityId → THREE colour int` (panels/fixtures). */
  readonly systemColorIndex: ReadonlyMap<string, number>;
  /**
   * ADR-408 Φ7 — colour-by-system master toggle (per-view). When `false`, the
   * `systemColorIndex` is empty (fixtures/panels fall back to default material)
   * and `syncCircuitWires` paints conduits in the default wire material.
   */
  readonly colorBySystem: boolean;
  readonly floors: readonly FloorRef[];
  readonly buildings: readonly BuildingRef[];
  readonly buildingVisModes: ReadonlyMap<string, BuildingVisMode>;
  /** Shared floor mode — 3D viewer renders one active level at a time. */
  readonly floorMode: FloorVisMode | undefined;
  readonly activeBuildingId: string | null;
  readonly useNewSystem: boolean;
  readonly floorElevationMm: number;
  readonly activeLevelId: string | undefined;
}

/**
 * Decides whether a mesh for `buildingId` should be added to the scene
 * (ADR-382 building-visibility gate). Passed by `BimSceneLayer` into the
 * envelope builder so the gate stays a single SSoT.
 */
export type ShouldRenderFn = (
  buildingId: string,
  useNewSystem: boolean,
  modes: ReadonlyMap<string, BuildingVisMode>,
  activeBuildingId: string | null,
) => boolean;
