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
  /**
   * ADR-358 §5.6.bis — entity/category-scope isolate snapshot, threaded once per
   * sync. `active` + non-empty `entityIds` ⇒ show ONLY those entities; `active` +
   * non-empty `categories` ⇒ show ONLY those categories (Revit Isolate Element/Category).
   */
  readonly isolate: {
    readonly active: boolean;
    readonly entityIds: ReadonlySet<string>;
    readonly categories: ReadonlySet<string>;
  };
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
  /**
   * ADR-448 Phase 1b — datum-relative FFL of the storey ceiling (next floor up),
   * for `topBinding='storey-ceiling'` walls/columns. `undefined` → no storey
   * context → entities fall back to their stored `params.height` (legacy).
   */
  readonly nextFloorElevationMm: number | undefined;
  readonly activeLevelId: string | undefined;
  /**
   * ADR-489 §6.1/§7 — DERIVED effective βάση κολώνας (`columnId → absolute mm` =
   * άνω παρειά στηρίζοντος πεδίλου), ώστε η κολώνα να «πατά» στο πέδιλό της αντί
   * να αιωρείται 1m πάνω του.
   *
   * **View-scoped by design (§7):** η συνέχεια είναι ορατή ΜΟΝΟ όταν βλέπεις και
   * τη Θεμελίωση — δηλαδή στο «Όλοι οι όροφοι» scope. Σε προβολή ενός ορόφου τα
   * πέδιλα δεν σχεδιάζονται καθόλου, οπότε η προέκταση θα κρεμόταν στο κενό και
   * θα εμπόδιζε την επιλογή/επεξεργασία της κολώνας στο 3Δ → `null`.
   *
   * `null` ⇒ κάθε κολώνα κρατά τη nominal βάση της (byte-for-byte pre-ADR-489).
   */
  readonly columnBaseContinuity: ReadonlyMap<string, number> | null;
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
