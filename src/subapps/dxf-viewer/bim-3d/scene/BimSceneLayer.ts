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
import { wallToMesh, columnToMesh, beamToMesh, slabToMesh } from '../converters/BimToThreeConverter';
import { stairToMeshes } from '../converters/StairToThreeConverter';
import { envelopeChainToMesh } from '../converters/EnvelopeToThree';
import { computeEnvelopePerimeter } from '../../bim/geometry/envelope-perimeter';
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
    const objectStyles = useDrawingScaleStore.getState().objectStyles;
    const useNewSystem = buildingVisModes.size > 0;
    const floorMode = activeLevelId ? floorVisModes.get(activeLevelId) : undefined;
    const ctx: SyncContext = {
      objectStyles, floors, buildings, buildingVisModes,
      floorMode, activeBuildingId, useNewSystem,
      floorElevationMm, activeLevelId,
    };

    this.syncWalls(entities, ctx);
    this.syncColumns(entities, ctx);
    this.syncBeams(entities, ctx);
    this.syncSlabs(entities, ctx);
    this.syncStairs(entities, ctx);
    this.syncEnvelope(entities, ctx);

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
    if (!levelId || entities.walls.length === 0) return;

    // ADR-396 P6: ΟΧΙ auto-seed — διαβάζει ΜΟΝΟ ό,τι έγραψε ρητά ο χρήστης
    // (command «Εφαρμογή Θερμοπρόσοψης»). null → κανένα κέλυφος μέχρι το apply.
    const spec = getEnvelopeSpec(levelId);
    if (!spec || !spec.zones.Z1) return;

    // V/G category + floor visibility gate (envelope = floor-level, no layerId).
    if (!resolveIsEntityVisible(
      { category: 'envelope' },
      { objectStyles: ctx.objectStyles, floorMode: ctx.floorMode },
    )) return;

    const { chains } = computeEnvelopePerimeter(entities.walls, spec.thickness_m);
    if (chains.length === 0) return;

    const wallById = new Map(entities.walls.map((w) => [w.id, w] as const));
    for (const chain of chains) {
      // Ύψος ορόφου = max height των τοίχων του chain (ήδη σε ΜΕΤΡΑ).
      let heightM = 0;
      for (const wid of chain.wallIds) {
        const w = wallById.get(wid);
        if (w && w.params.height > heightM) heightM = w.params.height;
      }
      if (heightM <= 0) continue;

      // Building binding + base elevation από τον πρώτο τοίχο του chain (ADR-369).
      const firstWall = chain.wallIds.map((id) => wallById.get(id)).find((w) => w !== undefined);
      const resolved = firstWall
        ? resolveEntityBuilding(
            firstWall as Parameters<typeof resolveEntityBuilding>[0],
            ctx.floors,
            ctx.buildings,
          )
        : null;
      const buildingId = resolved?.id ?? '';
      if (!this.shouldRender(buildingId, ctx.useNewSystem, ctx.buildingVisModes, ctx.activeBuildingId)) {
        continue;
      }

      const mesh = envelopeChainToMesh(
        chain,
        heightM,
        ctx.floorElevationMm,
        spec.materialId,
        levelId,
        resolved?.baseElevation ?? 0,
      );
      if (mesh) {
        mesh.userData['buildingId'] = buildingId;
        this.group.add(mesh);
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
