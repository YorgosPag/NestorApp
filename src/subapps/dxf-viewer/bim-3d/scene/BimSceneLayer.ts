/**
 * BimSceneLayer — manages Three.js meshes for BIM entities inside a THREE.Group.
 *
 * Phase 2 strategy: rebuild-all on every sync() call (correctness over perf).
 * Phase 3+: incremental dirty-tracking via entity.updatedAt comparison.
 *
 * ADR-366 Phase 2. Owned exclusively by ThreeJsSceneManager.
 *
 * ADR-382 Phase C — visibility decisions delegate to `resolveIsEntityVisible()`
 * SSoT (V/G category + Layer + Floor + Building intersection). Per-entity
 * pre-mesh filter mirrors the 2D BIM renderers, achieving 2D⟷3D parity for
 * Layer.visible / Layer.frozen toggles (the bug ADR-382 §1.1 resolves).
 */

import * as THREE from 'three';
import type { Bim3DEntities } from '../stores/Bim3DEntitiesStore';
import type { FloorStackEntry } from './multi-floor-3d-source';
import { wallToMesh, columnToMesh, beamToMesh, slabToMesh } from '../converters/BimToThreeConverter';
import { stairToMeshes } from '../converters/StairToThreeConverter';
import { envelopeChainToMesh, slabFlatLayerToMesh, revealLiningToMesh } from '../converters/EnvelopeToThree';
import { computeEnvelopePerimeter } from '../../bim/geometry/envelope-perimeter';
import { computeEnvelopeOpeningCuts } from '../../bim/geometry/envelope-opening-cuts';
import { getEnvelopeSpec } from '../../bim/stores/envelope-spec-store';
import { resolveEntityBuilding } from '../../bim/utils/bim-floor-utils';
import type { BuildingRef, FloorRef } from '../../bim/utils/bim-floor-utils';
import type { BuildingVisMode } from '../utils/building-visibility-state';
import type { FloorVisMode } from '../utils/floor-visibility-state';
import { resolveIsEntityVisible } from '../../bim/visibility/visibility-resolver';
import { useDrawingScaleStore } from '../../state/drawing-scale-store';
import { getLayer } from '../../stores/LayerStore';
import type { OpeningEntity } from '../../bim/types/opening-types';
import type { SlabOpeningEntity } from '../../bim/types/slab-opening-types';
import type { BimCategory, ObjectStyle } from '../../config/bim-object-styles';
import type { SceneLayer } from '../../types/entities';

interface SyncContext {
  readonly objectStyles: Partial<Record<BimCategory, ObjectStyle>>;
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

interface EntityResolution {
  readonly layer: SceneLayer | null;
  readonly buildingId: string;
  readonly buildingMode: BuildingVisMode | undefined;
  readonly baseElevation: number;
}

export class BimSceneLayer {
  readonly group: THREE.Group;
  private _hasMesh = false;

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    this.group.name = 'bim-entities';
    scene.add(this.group);
  }

  sync(
    entities: Bim3DEntities,
    floorElevationMm = 0,
    activeLevelId?: string,
    floors: readonly FloorRef[] = [],
    buildings: readonly BuildingRef[] = [],
    activeBuildingId: string | null = null,
    buildingVisModes: ReadonlyMap<string, BuildingVisMode> = new Map(),
    floorVisModes: ReadonlyMap<string, FloorVisMode> = new Map(),
  ): void {
    this.clearGroup();
    const ctx = this.buildContext(
      floorElevationMm, activeLevelId, floors, buildings,
      activeBuildingId, buildingVisModes, floorVisModes,
    );
    this.syncFloorEntities(entities, ctx);
    this.recomputeHasMesh();
  }

  /**
   * ADR-399 Phase B — render every floor of the building stacked by elevation
   * («Όλοι οι όροφοι» scope). One `clearGroup` then a loop over the per-floor
   * stack, building a fresh context per floor (its own `floorElevationMm` +
   * `activeLevelId` = the floor's levelId) so the EXISTING per-entity converters
   * place each floor at the right height and tag meshes with their levelId
   * (drives the `applyFloorVisibility` show/ghost/hide post-pass). Floor + V/G +
   * Layer + Building visibility gating stays identical to the single path.
   */
  syncMultiFloor(
    stack: readonly FloorStackEntry[],
    floors: readonly FloorRef[] = [],
    buildings: readonly BuildingRef[] = [],
    activeBuildingId: string | null = null,
    buildingVisModes: ReadonlyMap<string, BuildingVisMode> = new Map(),
    floorVisModes: ReadonlyMap<string, FloorVisMode> = new Map(),
  ): void {
    this.clearGroup();
    for (const floor of stack) {
      const ctx = this.buildContext(
        floor.floorElevationMm, floor.levelId, floors, buildings,
        activeBuildingId, buildingVisModes, floorVisModes,
      );
      this.syncFloorEntities(floor.entities, ctx);
    }
    this.recomputeHasMesh();
  }

  /** Assemble the per-floor sync context (shared by single + multi-floor). */
  private buildContext(
    floorElevationMm: number,
    activeLevelId: string | undefined,
    floors: readonly FloorRef[],
    buildings: readonly BuildingRef[],
    activeBuildingId: string | null,
    buildingVisModes: ReadonlyMap<string, BuildingVisMode>,
    floorVisModes: ReadonlyMap<string, FloorVisMode>,
  ): SyncContext {
    const objectStyles = useDrawingScaleStore.getState().objectStyles;
    const useNewSystem = buildingVisModes.size > 0;
    const floorMode = activeLevelId ? floorVisModes.get(activeLevelId) : undefined;
    return {
      objectStyles, floors, buildings, buildingVisModes,
      floorMode, activeBuildingId, useNewSystem,
      floorElevationMm, activeLevelId,
    };
  }

  /** Build the meshes for one floor's entities into the shared group. */
  private syncFloorEntities(entities: Bim3DEntities, ctx: SyncContext): void {
    this.syncWalls(entities, ctx);
    this.syncColumns(entities, ctx);
    this.syncBeams(entities, ctx);
    this.syncSlabs(entities, ctx);
    this.syncStairs(entities, ctx);
    this.syncEnvelope(entities, ctx);
  }

  /** Cache whether the group holds ≥1 triangle mesh (last build). */
  private recomputeHasMesh(): void {
    let found = false;
    this.group.traverse((obj) => { if (!found && obj instanceof THREE.Mesh) found = true; });
    this._hasMesh = found;
  }

  /**
   * Per-entity visibility + building binding. Returns null when the entity
   * is filtered out (V/G hide, Layer hide/frozen, Floor hide, Building hide,
   * or active-building outside-of-view). Single SSoT for ADR-382 intersection.
   */
  private resolveEntity(
    entity: { layerId?: string },
    category: BimCategory,
    ctx: SyncContext,
  ): EntityResolution | null {
    const layer = entity.layerId ? getLayer(entity.layerId) : null;
    const resolved = resolveEntityBuilding(
      entity as Parameters<typeof resolveEntityBuilding>[0],
      ctx.floors,
      ctx.buildings,
    );
    const buildingId = resolved?.id ?? '';
    const buildingMode = ctx.buildingVisModes.get(buildingId);

    if (!resolveIsEntityVisible(
      { category, layerId: entity.layerId },
      { objectStyles: ctx.objectStyles, layer, floorMode: ctx.floorMode, buildingMode },
    )) return null;

    if (!this.shouldRender(buildingId, ctx.useNewSystem, ctx.buildingVisModes, ctx.activeBuildingId)) {
      return null;
    }
    return { layer, buildingId, buildingMode, baseElevation: resolved?.baseElevation ?? 0 };
  }

  /** Filter hosted openings by per-entity visibility (V/G + Layer + Floor + Building). */
  private filterHostedOpenings(
    openings: readonly OpeningEntity[],
    hostKey: 'wallId',
    hostId: string,
    parentBuildingMode: BuildingVisMode | undefined,
    ctx: SyncContext,
  ): readonly OpeningEntity[] {
    return openings.filter((o) =>
      o.params[hostKey] === hostId && resolveIsEntityVisible(
        { category: 'opening', layerId: o.layerId },
        {
          objectStyles: ctx.objectStyles,
          layer: o.layerId ? getLayer(o.layerId) : null,
          floorMode: ctx.floorMode,
          buildingMode: parentBuildingMode,
        },
      )
    );
  }

  private filterHostedSlabOpenings(
    slabOpenings: readonly SlabOpeningEntity[],
    slabId: string,
    parentBuildingMode: BuildingVisMode | undefined,
    ctx: SyncContext,
  ): readonly SlabOpeningEntity[] {
    return slabOpenings.filter((o) =>
      o.params.slabId === slabId && resolveIsEntityVisible(
        { category: 'slab-opening', layerId: o.layerId },
        {
          objectStyles: ctx.objectStyles,
          layer: o.layerId ? getLayer(o.layerId) : null,
          floorMode: ctx.floorMode,
          buildingMode: parentBuildingMode,
        },
      )
    );
  }

  private syncWalls(entities: Bim3DEntities, ctx: SyncContext): void {
    for (const wall of entities.walls) {
      const r = this.resolveEntity(wall, 'wall', ctx);
      if (!r) continue;
      const openingsForWall = this.filterHostedOpenings(
        entities.openings, 'wallId', wall.id, r.buildingMode, ctx,
      );
      const mesh = wallToMesh(wall, openingsForWall, ctx.floorElevationMm, ctx.activeLevelId, r.baseElevation);
      if (mesh) { mesh.userData['buildingId'] = r.buildingId; this.group.add(mesh); }
    }
  }

  private syncColumns(entities: Bim3DEntities, ctx: SyncContext): void {
    for (const column of entities.columns) {
      const r = this.resolveEntity(column, 'column', ctx);
      if (!r) continue;
      const mesh = columnToMesh(column, ctx.floorElevationMm, ctx.activeLevelId, r.baseElevation);
      if (mesh) { mesh.userData['buildingId'] = r.buildingId; this.group.add(mesh); }
    }
  }

  private syncBeams(entities: Bim3DEntities, ctx: SyncContext): void {
    for (const beam of entities.beams) {
      const r = this.resolveEntity(beam, 'beam', ctx);
      if (!r) continue;
      const mesh = beamToMesh(beam, ctx.activeLevelId, r.baseElevation);
      if (mesh) { mesh.userData['buildingId'] = r.buildingId; this.group.add(mesh); }
    }
  }

  private syncSlabs(entities: Bim3DEntities, ctx: SyncContext): void {
    for (const slab of entities.slabs) {
      const r = this.resolveEntity(slab, 'slab', ctx);
      if (!r) continue;
      const openingsForSlab = this.filterHostedSlabOpenings(
        entities.slabOpenings, slab.id, r.buildingMode, ctx,
      );
      const mesh = slabToMesh(slab, openingsForSlab, ctx.activeLevelId, r.baseElevation);
      if (mesh) { mesh.userData['buildingId'] = r.buildingId; this.group.add(mesh); }
    }
  }

  private syncStairs(entities: Bim3DEntities, ctx: SyncContext): void {
    for (const stair of entities.stairs) {
      const r = this.resolveEntity(stair, 'stair', ctx);
      if (!r) continue;
      const meshes = stairToMeshes(stair, ctx.floorElevationMm, ctx.activeLevelId, r.baseElevation);
      for (const mesh of meshes) {
        mesh.userData['buildingId'] = r.buildingId;
        this.group.add(mesh);
      }
    }
  }

  /**
   * ADR-396 P5 — 3D envelope (ETICS) shell, ζώνη Z1 (κατακόρυφο κέλυφος).
   *
   * Παράγωγο floor-shell (ΟΧΙ per-entity) — mirror του 2D `EnvelopeOverlay`:
   * διαβάζει το per-level `ThermalEnvelopeSpec`, υπολογίζει το ίδιο SSoT
   * `computeEnvelopePerimeter` (P3), και extrude-άρει το band κατά το ύψος ορόφου.
   * 2D⟷3D parity: ίδια V/G κατηγορία 'envelope' + floor visibility gate (ADR-382).
   *
   * ADR-396 P6: διαβάζει το spec via `getEnvelopeSpec` (read-only, ΟΧΙ auto-seed).
   * Το authoring το κάνει το command «Εφαρμογή Θερμοπρόσοψης» (ThermalEnvelopeHost);
   * το spec store change triggerάρει 3D resync (`use-bim3d-vg-resync`). P7 = persistence.
   */
  private syncEnvelope(entities: Bim3DEntities, ctx: SyncContext): void {
    const levelId = ctx.activeLevelId;
    if (!levelId) return;

    // V/G category + floor visibility gate, κοινό για όλες τις ζώνες
    // (envelope = floor-level, no layerId — mirror του 2D `EnvelopeOverlay`).
    if (!resolveIsEntityVisible(
      { category: 'envelope' },
      { objectStyles: ctx.objectStyles, floorMode: ctx.floorMode },
    )) return;

    // ADR-396 P6: ΟΧΙ auto-seed. Z1 spec-driven· Z2/Z3/Z4 per-element driven
    // (διαβάζονται από `envelopeLayer` / `revealInsulation`, render = pure read).
    const spec = getEnvelopeSpec(levelId);
    if (spec && spec.zones.Z1 && entities.walls.length > 0) {
      this.addEnvelopeShell(entities, ctx, spec.thickness_m, spec.materialId, levelId);
    }
    this.addFlatLayers(entities, ctx, levelId);
    this.addRevealLinings(entities, ctx, levelId);
  }

  /** Building binding + base elevation για floor-level envelope (no layer gating). */
  private resolveEnvelopeBuilding(
    entity: { layerId?: string } | undefined,
    ctx: SyncContext,
  ): { buildingId: string; baseElevation: number } | null {
    if (!entity) return null;
    const resolved = resolveEntityBuilding(
      entity as Parameters<typeof resolveEntityBuilding>[0],
      ctx.floors,
      ctx.buildings,
    );
    const buildingId = resolved?.id ?? '';
    if (!this.shouldRender(buildingId, ctx.useNewSystem, ctx.buildingVisModes, ctx.activeBuildingId)) {
      return null;
    }
    return { buildingId, baseElevation: resolved?.baseElevation ?? 0 };
  }

  /** Z1 — κατακόρυφο κέλυφος (offset perimeter των τοίχων). */
  private addEnvelopeShell(
    entities: Bim3DEntities,
    ctx: SyncContext,
    thicknessM: number,
    materialId: string,
    levelId: string,
  ): void {
    // ADR-396 gating: κολώνες γεφυρώνουν κενά (Επιλογή Α). Gating: ≥3 τοίχοι
    // συνδεδεμένοι (mirror EnvelopeOverlay). T-junctions = isCycle false αλλά
    // ΔΕΝ είναι isolated → εμφανίζονται. 2D⟷3D parity.
    const { chains } = computeEnvelopePerimeter(entities.walls, thicknessM, undefined, entities.columns);
    const activeChains = chains.filter((c) => c.wallIds.length >= 3);
    if (activeChains.length === 0) return;
    const wallById = new Map(entities.walls.map((w) => [w.id, w] as const));
    // Ίδιες μονάδες με το chain (computeEnvelopePerimeter fallback) ώστε τα opening
    // cuts (mm → canvas) να ευθυγραμμίζονται με τα face/outer loops.
    const sceneUnits = entities.walls[0]?.params.sceneUnits ?? 'mm';

    for (const chain of activeChains) {
      // Ύψος ορόφου = max height των τοίχων του chain. params.height είναι mm → / 1000.
      let heightM = 0;
      for (const wid of chain.wallIds) {
        const w = wallById.get(wid);
        if (w && w.params.height > heightM) heightM = w.params.height / 1000;
      }
      if (heightM <= 0) continue;

      const firstWall = chain.wallIds.map((id) => wallById.get(id)).find((w) => w !== undefined);
      const r = this.resolveEnvelopeBuilding(firstWall, ctx);
      if (!r) continue;

      // ADR-396 — η μόνωση δεν σκεπάζει κουφώματα: cut ανά visible opening του
      // chain (ίδιο visibility filter με wallToMesh → 2D⟷3D parity).
      const chainOpenings = this.filterEnvelopeOpenings(entities.openings, chain.wallIds, ctx);
      const cuts = computeEnvelopeOpeningCuts(chain, chainOpenings, sceneUnits);

      const mesh = envelopeChainToMesh(
        chain, heightM, ctx.floorElevationMm, materialId, levelId, r.baseElevation, cuts,
      );
      if (mesh) { mesh.userData['buildingId'] = r.buildingId; this.group.add(mesh); }
    }
  }

  /**
   * Ανοίγματα τοίχων του chain που περνούν το opening visibility filter. Το
   * building-level gating έχει ήδη γίνει στο `resolveEnvelopeBuilding` (το chain
   * παραλείπεται όταν το κτίριο είναι κρυφό), οπότε δεν περνάμε buildingMode εδώ.
   */
  private filterEnvelopeOpenings(
    openings: readonly OpeningEntity[],
    wallIds: readonly string[],
    ctx: SyncContext,
  ): readonly OpeningEntity[] {
    const wallSet = new Set(wallIds);
    return openings.filter((o) =>
      wallSet.has(o.params.wallId) && resolveIsEntityVisible(
        { category: 'opening', layerId: o.layerId },
        {
          objectStyles: ctx.objectStyles,
          layer: o.layerId ? getLayer(o.layerId) : null,
          floorMode: ctx.floorMode,
        },
      ),
    );
  }

  /** Z2/Z3 — flat μόνωση εκτεθειμένων πλακών (per-element `envelopeLayer`). */
  private addFlatLayers(entities: Bim3DEntities, ctx: SyncContext, levelId: string): void {
    for (const slab of entities.slabs) {
      const layer = slab.params?.envelopeLayer;
      if (!layer || (layer.zone !== 'Z2' && layer.zone !== 'Z3')) continue;
      const footprint = slab.geometry?.polygon?.vertices;
      if (!footprint) continue;
      const r = this.resolveEnvelopeBuilding(slab, ctx);
      if (!r) continue;

      const slabTopMm = slab.params.levelElevation + (slab.params.heightOffsetFromLevel ?? 0);
      const mesh = slabFlatLayerToMesh(
        footprint, layer.zone, slabTopMm, slab.params.thickness, layer.thickness_m,
        layer.materialId, levelId, r.baseElevation,
      );
      if (mesh) { mesh.userData['buildingId'] = r.buildingId; this.group.add(mesh); }
    }
  }

  /** Z4 — μόνωση περβαζιών εξωτερικών ανοιγμάτων (per-element `revealInsulation`). */
  private addRevealLinings(entities: Bim3DEntities, ctx: SyncContext, levelId: string): void {
    const wallById = new Map(entities.walls.map((w) => [w.id, w] as const));
    for (const op of entities.openings) {
      const reveal = op.params?.revealInsulation;
      const outline = op.geometry?.outline?.vertices;
      if (!reveal || !outline) continue;
      const r = this.resolveEnvelopeBuilding(wallById.get(op.params.wallId), ctx);
      if (!r) continue;

      const grp = revealLiningToMesh(
        outline, op.geometry?.revealOutline?.vertices ?? outline,
        reveal.thickness_m, op.params.sillHeight, op.params.height,
        ctx.floorElevationMm, r.baseElevation, reveal.materialId, levelId,
      );
      if (grp) {
        grp.userData['buildingId'] = r.buildingId;
        for (const c of grp.children) c.userData['buildingId'] = r.buildingId;
        this.group.add(grp);
      }
    }
  }

  /** Returns true if a mesh for buildingId should be added to the scene. */
  private shouldRender(
    buildingId: string,
    useNewSystem: boolean,
    modes: ReadonlyMap<string, BuildingVisMode>,
    activeBuildingId: string | null,
  ): boolean {
    if (useNewSystem) return (modes.get(buildingId) ?? 'show') !== 'hide';
    if (activeBuildingId !== null) return buildingId === activeBuildingId;
    return true;
  }

  private clearGroup(): void {
    // ADR-363 Bug 2 — wallToMesh now returns Group για openings (per-segment
    // meshes). Recursive traverse disposes nested geometries.
    for (const child of [...this.group.children]) {
      child.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
        }
      });
    }
    this.group.clear();
  }

  /** True iff BIM group contains ≥1 triangle Mesh (cached from last sync). */
  get hasMesh(): boolean { return this._hasMesh; }

  dispose(): void {
    this.clearGroup();
    this.group.parent?.remove(this.group);
  }
}
