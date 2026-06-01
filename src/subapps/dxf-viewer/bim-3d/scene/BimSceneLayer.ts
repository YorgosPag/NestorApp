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
import { resolveWallTopProfile, resolveWallNominalTopZmm } from '../../bim/geometry/wall-top-profile';
import { resolveWallBaseProfile } from '../../bim/geometry/wall-base-profile';
import { makeWallTopContext, makeWallBaseContext, buildWallHostInputs, type HostFootprintInput } from '../../bim/geometry/wall-host-plan-builder';
import { wallTopFaceCrossingBreakpoints, type WallTopClipContext } from '../converters/wall-top-clip';
import { makeStairHostResolver } from '../../bim/geometry/stair-vertical-profile';
import { resolveEffectiveStairParams } from '../../bim/geometry/stairs/stair-effective-params';
import { computeStairGeometry } from '../../bim/geometry/stairs/StairGeometryService';
import type { StairEntity } from '../../bim/types/stair-types';
import {
  resolveColumnTopProfile,
  resolveColumnBaseProfile,
  makeColumnHostResolver,
} from '../../bim/geometry/column-vertical-profile';
import { addEnvelopeToScene } from './bim-envelope-scene-builder';
import type { SyncContext } from './bim-scene-context';
import { resolveEntityBuilding } from '../../bim/utils/bim-floor-utils';
import type { BuildingRef, FloorRef } from '../../bim/utils/bim-floor-utils';
import type { BuildingVisMode } from '../utils/building-visibility-state';
import type { FloorVisMode } from '../utils/floor-visibility-state';
import { resolveIsEntityVisible } from '../../bim/visibility/visibility-resolver';
import type { Discipline } from '../../bim/discipline/bim-discipline';
import { useDrawingScaleStore } from '../../state/drawing-scale-store';
import { getLayer } from '../../stores/LayerStore';
import type { OpeningEntity } from '../../bim/types/opening-types';
import type { SlabOpeningEntity } from '../../bim/types/slab-opening-types';
import type { BimCategory } from '../../config/bim-object-styles';
import type { SceneLayer } from '../../types/entities';

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
    const { objectStyles, disciplineVisibility } = useDrawingScaleStore.getState();
    const useNewSystem = buildingVisModes.size > 0;
    const floorMode = activeLevelId ? floorVisModes.get(activeLevelId) : undefined;
    return {
      objectStyles, disciplineVisibility, floors, buildings, buildingVisModes,
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
    addEnvelopeToScene(this.group, entities, ctx, this.shouldRender.bind(this));
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
    entity: { layerId?: string; discipline?: Discipline },
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
      { category, layerId: entity.layerId, discipline: entity.discipline },
      {
        objectStyles: ctx.objectStyles,
        disciplineVisibility: ctx.disciplineVisibility,
        layer, floorMode: ctx.floorMode, buildingMode,
      },
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
        { category: 'opening', layerId: o.layerId, discipline: o.discipline },
        {
          objectStyles: ctx.objectStyles,
          disciplineVisibility: ctx.disciplineVisibility,
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
        { category: 'slab-opening', layerId: o.layerId, discipline: o.discipline },
        {
          objectStyles: ctx.objectStyles,
          disciplineVisibility: ctx.disciplineVisibility,
          layer: o.layerId ? getLayer(o.layerId) : null,
          floorMode: ctx.floorMode,
          buildingMode: parentBuildingMode,
        },
      )
    );
  }

  private syncWalls(entities: Bim3DEntities, ctx: SyncContext): void {
    // ADR-401 Phase B2/(γ) — host inputs (δοκάρια + πλάκες) για τη μεταβλητή κορυφή
    // (top-attach) ΚΑΙ τον μεταβλητό πάτο (base-attach) των `attached` τοίχων.
    // Footprints + wall axis στο ΙΔΙΟ plan space (`*.params`, mirror του
    // `section-scene-sync`)· χτίζονται μόνο όταν υπάρχει τουλάχιστον ένας attached
    // τοίχος (κορυφή Ή βάση· κοινό case = κανένας → μηδέν κόστος).
    const hasAttached = entities.walls.some(
      (w) => w.params?.topBinding === 'attached' || w.params?.baseBinding === 'attached',
    );
    const hostInputs = hasAttached
      ? buildWallHostInputs(entities.beams, entities.slabs)
      : [];

    for (const wall of entities.walls) {
      const r = this.resolveEntity(wall, 'wall', ctx);
      if (!r) continue;
      const openingsForWall = this.filterHostedOpenings(
        entities.openings, 'wallId', wall.id, r.buildingMode, ctx,
      );
      const start = { x: wall.params.start.x, y: wall.params.start.y };
      const end = { x: wall.params.end.x, y: wall.params.end.y };
      const topBase = { floorElevationMm: ctx.floorElevationMm };
      const profile = wall.params?.topBinding === 'attached'
        ? resolveWallTopProfile(wall.params, makeWallTopContext(start, end, hostInputs, topBase))
        : undefined;
      // ADR-401 γωνιακή διασταύρωση — footprint clip: για **straight** attached τοίχο,
      // ο 3D builder κόβει το αποτύπωμα κάθε κομματιού με τα host footprints σε επίπεδες
      // περιοχές (κάτω-παρειά host / nominal) με κατακόρυφο σκαλοπάτι στην αληθινή ακμή
      // του host → μηδέν τριγωνικά κενά. Curved/polyline → undefined (το extrude path
      // δεν υποστηρίζει διαγώνια κορυφή — documented limitation, axis profile όπως πριν).
      // ADR-401 face crossings: σπάμε τον τοίχο εκεί που τον τέμνουν οι ΠΑΡΕΙΕΣ
      // (όχι ο άξονας) ώστε τα ακριανά κομμάτια να μένουν καθαρά ορθογώνια και τα
      // transition κομμάτια καθαρά τρίγωνα μετά το clip (δες wall-top-clip §face).
      const attachHosts = (wall.params?.topBinding === 'attached' && wall.kind === 'straight')
        ? hostInputs.filter((h) => wall.params.attachTopToIds?.includes(h.hostId))
        : null;
      const topClip: WallTopClipContext | undefined = attachHosts
        ? {
            hosts: attachHosts,
            nominalTopMm: resolveWallNominalTopZmm(wall.params, topBase),
            breakpoints: wallTopFaceCrossingBreakpoints(wall.geometry, attachHosts),
          }
        : undefined;
      // ADR-401 (γ) — base-attach: ο πάτος ακολουθεί την άνω-παρειά host(s).
      const baseProfile = wall.params?.baseBinding === 'attached'
        ? resolveWallBaseProfile(
            wall.params,
            makeWallBaseContext(start, end, hostInputs, { floorElevationMm: ctx.floorElevationMm }),
          )
        : undefined;
      const mesh = wallToMesh(
        wall, openingsForWall, ctx.floorElevationMm, ctx.activeLevelId, r.baseElevation, profile, baseProfile, topClip,
      );
      if (mesh) { mesh.userData['buildingId'] = r.buildingId; this.group.add(mesh); }
    }
  }

  private syncColumns(entities: Bim3DEntities, ctx: SyncContext): void {
    // ADR-401 Phase F.2 — host inputs (δοκάρια + πλάκες) για τη μεταβλητή/κεκλιμένη
    // κορυφή (top-attach) ΚΑΙ βάση (base-attach) των `attached` κολωνών· χτίζονται
    // μόνο όταν υπάρχει τουλάχιστον μία attached κολώνα (κοινό case = καμία → μηδέν
    // κόστος). Mirror του `syncWalls`. Footprints στο ίδιο plan space.
    const hasAttached = entities.columns.some(
      (c) => c.params?.topBinding === 'attached' || c.params?.baseBinding === 'attached',
    );
    const resolveHostInput = hasAttached
      ? makeColumnHostResolver(buildWallHostInputs(entities.beams, entities.slabs))
      : undefined;

    for (const column of entities.columns) {
      const r = this.resolveEntity(column, 'column', ctx);
      if (!r) continue;
      // Profiles μόνο για attached κολώνες με geometry· αλλιώς undefined → fast path
      // (byte-for-byte παλιά συμπεριφορά, μηδέν geometry access για μη-attached).
      const topAttached = column.params?.topBinding === 'attached';
      const baseAttached = column.params?.baseBinding === 'attached';
      let topProfile, baseProfile;
      const footVerts = column.geometry?.footprint?.vertices;
      if ((topAttached || baseAttached) && footVerts && footVerts.length >= 3) {
        const footprint = footVerts.map((v) => ({ x: v.x, y: v.y }));
        const colCtx = { floorElevationMm: ctx.floorElevationMm, resolveHostInput };
        topProfile = topAttached ? resolveColumnTopProfile(column.params, footprint, colCtx) : undefined;
        baseProfile = baseAttached ? resolveColumnBaseProfile(column.params, footprint, colCtx) : undefined;
      }
      const mesh = columnToMesh(
        column, ctx.floorElevationMm, ctx.activeLevelId, r.baseElevation, topProfile, baseProfile,
      );
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
    // ADR-401 Phase G.2 — host inputs (δοκάρια + πλάκες) για τις `attached` σκάλες
    // (re-step στο host)· χτίζονται μόνο όταν υπάρχει ≥1 attached σκάλα (κοινό case
    // = καμία → μηδέν κόστος). Mirror του `syncColumns`. Footprints στο ίδιο plan space.
    const hasAttached = entities.stairs.some(
      (s) => s.params?.topBinding === 'attached' || s.params?.baseBinding === 'attached',
    );
    const resolveHostInput = hasAttached
      ? makeStairHostResolver(buildWallHostInputs(entities.beams, entities.slabs))
      : undefined;

    for (const stair of entities.stairs) {
      const r = this.resolveEntity(stair, 'stair', ctx);
      if (!r) continue;
      const meshes = stairToMeshes(
        this.toEffectiveStair(stair, resolveHostInput),
        ctx.floorElevationMm,
        ctx.activeLevelId,
        r.baseElevation,
      );
      for (const mesh of meshes) {
        mesh.userData['buildingId'] = r.buildingId;
        this.group.add(mesh);
      }
    }
  }

  /**
   * ADR-401 Phase G.2 — effective σκάλα όταν `attached`: το resolved κατακόρυφο
   * προφίλ αλλάζει `basePoint.z`/`rise`/`stepCount`/`totalRise` (whole-step snap) →
   * **ξαναγεννιέται όλη η γεωμετρία** (treads/risers/stringers/handrails/walkline)
   * μέσω `computeStairGeometry`. Μη-attached / εκφυλισμένο host → byte-for-byte η
   * αρχική σκάλα (fast path identity). SSoT: `resolveEffectiveStairParams` — ΙΔΙΑ
   * effective params με το BOQ (`stair-boq-sync`).
   */
  private toEffectiveStair(
    stair: StairEntity,
    resolveHostInput: ((id: string) => HostFootprintInput | null) | undefined,
  ): StairEntity {
    const attached =
      stair.params?.topBinding === 'attached' || stair.params?.baseBinding === 'attached';
    if (!resolveHostInput || !attached || !stair.params) return stair;
    const { params } = resolveEffectiveStairParams(stair.params, { resolveHostInput });
    if (params === stair.params) return stair; // no-attach / degenerate → identity
    return { ...stair, params, geometry: computeStairGeometry(params) };
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
