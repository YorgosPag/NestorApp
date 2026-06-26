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
import { beamToMesh, slabToMesh, fixtureToMesh, panelToMesh, manifoldToMesh, radiatorToMesh, boilerToMesh, waterHeaterToMesh, foundationToMesh } from '../converters/BimToThreeConverter';
// ADR-534 §monolithic-cut — top-clip δοκαριών/κολόνων στο soffit καλύπτουσας πλάκας (μηδέν z-fighting).
import { buildCeilingSlabHosts, resolveMemberTopClipZmm } from './monolithic-slab-clip';
import { isBeamTilted } from '../../bim/geometry/beam-slope';
import { syncWalls, syncColumns } from './bim-scene-attach-syncs';
// ADR-449 Slice 7 — scene-level ενιαίος σοβάς (merged structural silhouette).
import { syncStructuralFinishSkin } from './bim-scene-structural-finish-sync';
// ADR-473 — joint rebar post-pass (dowels / laps / anchorages at structural joints).
import { syncJointRebar, buildStructuralEntitySet } from './bim-scene-joint-rebar-sync';
import { stairToMeshes } from '../converters/StairToThreeConverter';
import { railingToMesh } from '../converters/railing-to-three';
import { roofToMesh } from '../converters/roof-to-three';
import { floorFinishToMesh } from '../converters/floor-finish-to-three';
import { underfloorToObject3D } from '../converters/mep-underfloor-to-three';
import { furnitureToObject3D } from '../converters/furniture-to-three';
import { mepFixtureToObject3D } from '../converters/mep-fixture-to-mesh';
import { resolveFixtureBimCategory } from '../../bim/types/mep-fixture-types';
import { syncCircuitWires } from './sync-circuit-wires';
import { syncMepSegments, syncFittings } from './sync-mep-elements';
import { buildWallHostInputs, type HostFootprintInput } from '../../bim/geometry/wall-host-plan-builder';
import { makeStairHostResolver } from '../../bim/geometry/stair-vertical-profile';
import { resolveEffectiveStairParams } from '../../bim/geometry/stairs/stair-effective-params';
import { computeStairGeometry } from '../../bim/geometry/stairs/StairGeometryService';
import type { StairEntity } from '../../bim/types/stair-types';
import { addEnvelopeToScene } from './bim-envelope-scene-builder';
import type { SyncContext } from './bim-scene-context';
import { resolveEntityBuilding } from '../../bim/utils/bim-floor-utils';
import type { BuildingRef, FloorRef } from '../../bim/utils/bim-floor-utils';
import type { BuildingVisMode } from '../utils/building-visibility-state';
import type { FloorVisMode } from '../utils/floor-visibility-state';
import { resolveIsEntityVisible } from '../../bim/visibility/visibility-resolver';
import { getIsolateEffectsSnapshot } from '../../systems/isolate/IsolateEffectsStore';
import type { Discipline } from '../../bim/discipline/bim-discipline';
import { useDrawingScaleStore } from '../../state/drawing-scale-store';
import { useMepSystemStore } from '../../bim/mep-systems/mep-system-store';
import { buildEntitySystemColorIntIndex } from '../../bim/mep-systems/mep-system-color';
import { getLayer } from '../../stores/LayerStore';
import { filterHostedSlabOpenings } from './bim-scene-hosted-opening-filters';
import { syncPointEntities } from './bim-scene-point-syncs';
import type { BimCategory } from '../../config/bim-object-styles';
import type { SceneLayer } from '../../types/entities';

export interface EntityResolution {
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
    nextFloorElevationMm: number | undefined = undefined,
  ): void {
    this.clearGroup();
    const ctx = this.buildContext(
      floorElevationMm, activeLevelId, floors, buildings,
      activeBuildingId, buildingVisModes, floorVisModes, nextFloorElevationMm,
    );
    this.syncFloorEntities(entities, ctx);
    // ADR-473 — joint rebar: single-floor path. buildStructuralEntitySet passes the
    // correct floorElevationMm so graph nodes get proper absolute Z coordinates.
    const { structural, floorElevationByEntityId } = buildStructuralEntitySet([entities], [floorElevationMm]);
    syncJointRebar(this.group, structural, floorElevationByEntityId);
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
        activeBuildingId, buildingVisModes, floorVisModes, floor.nextFloorElevationMm,
      );
      this.syncFloorEntities(floor.entities, ctx);
    }
    // ADR-473 — joint rebar: multi-floor path. Aggregates ALL floors so the graph
    // can find cross-floor connections (e.g. footing Θεμελίωσης ↔ column Ισογείου).
    const { structural, floorElevationByEntityId } = buildStructuralEntitySet(
      stack.map((f) => f.entities),
      stack.map((f) => f.floorElevationMm),
    );
    syncJointRebar(this.group, structural, floorElevationByEntityId);
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
    nextFloorElevationMm: number | undefined,
  ): SyncContext {
    const { objectStyles, disciplineVisibility, colorBySystem } = useDrawingScaleStore.getState();
    const useNewSystem = buildingVisModes.size > 0;
    const floorMode = activeLevelId ? floorVisModes.get(activeLevelId) : undefined;
    // ADR-408 Φ5/Φ7 — colour-by-system index (entity → THREE colour int), built
    // once per floor sync; threaded into the fixture/panel converters. When the
    // per-view `colorBySystem` master toggle is OFF the index is left empty, so
    // every panel/fixture falls back to its default material (no converter change).
    const systemColorIndex = colorBySystem
      ? buildEntitySystemColorIntIndex(useMepSystemStore.getState().getSystems())
      : new Map<string, number>();
    // ADR-358 §5.6.bis — entity/category-scope isolate snapshot, captured once per sync.
    const isolateSnap = getIsolateEffectsSnapshot();
    const isolate = {
      active: isolateSnap.active,
      entityIds: isolateSnap.isolatedEntityIds,
      categories: isolateSnap.isolatedCategories,
    };
    return {
      objectStyles, disciplineVisibility, systemColorIndex, colorBySystem, floors, buildings, buildingVisModes,
      floorMode, activeBuildingId, useNewSystem,
      floorElevationMm, nextFloorElevationMm, activeLevelId, isolate,
    };
  }

  /** Build the meshes for one floor's entities into the shared group. */
  private syncFloorEntities(entities: Bim3DEntities, ctx: SyncContext): void {
    syncWalls(this.group, entities, ctx, (e, c, cx) => this.resolveEntity(e, c, cx));
    syncColumns(this.group, entities, ctx, (e, c, cx) => this.resolveEntity(e, c, cx));
    this.syncBeams(entities, ctx);
    syncStructuralFinishSkin(this.group, entities, ctx, (e, c, cx) => this.resolveEntity(e, c, cx));
    this.syncFoundations(entities, ctx);
    this.syncSlabs(entities, ctx);
    this.syncStairs(entities, ctx);
    this.syncFixtures(entities, ctx);
    this.syncPanels(entities, ctx);
    this.syncManifolds(entities, ctx);
    this.syncRadiators(entities, ctx);
    this.syncBoilers(entities, ctx);
    this.syncWaterHeaters(entities, ctx);
    syncCircuitWires(this.group, entities, ctx, (entity, category) => this.resolveEntity(entity, category, ctx));
    this.syncRailings(entities, ctx);
    this.syncRoofs(entities, ctx);
    this.syncFloorFinishes(entities, ctx);
    this.syncUnderfloors(entities, ctx);
    this.syncFurnitures(entities, ctx);
    const resolve = (e: { layerId?: string; discipline?: Discipline }, c: BimCategory) =>
      this.resolveEntity(e, c, ctx);
    syncMepSegments(this.group, entities, ctx, resolve);
    syncFittings(this.group, entities, ctx, resolve);
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
    entity: { id?: string; layerId?: string; discipline?: Discipline },
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
      { category, id: entity.id, layerId: entity.layerId, discipline: entity.discipline },
      {
        objectStyles: ctx.objectStyles,
        disciplineVisibility: ctx.disciplineVisibility,
        layer, floorMode: ctx.floorMode, buildingMode,
        isolate: ctx.isolate,
      },
    )) return null;

    if (!this.shouldRender(buildingId, ctx.useNewSystem, ctx.buildingVisModes, ctx.activeBuildingId)) {
      return null;
    }
    return { layer, buildingId, buildingMode, baseElevation: resolved?.baseElevation ?? 0 };
  }

  /** ADR-406 — point-based MEP fixtures (light fixtures first). */
  private syncFixtures(entities: Bim3DEntities, ctx: SyncContext): void {
    // Defensive: legacy floor-stack entries / snapshots predating ADR-406 carry
    // no `fixtures` array — never crash the whole floor sync over a missing slice.
    for (const fixture of entities.fixtures ?? []) {
      // ADR-408 Φ14 — a floor-drain fixture maps to the 'drain-pipe' V/G category
      // (so it hides with «Αποχέτευση»); a light fixture stays 'light-fixture'.
      const r = this.resolveEntity(fixture, resolveFixtureBimCategory(fixture.params), ctx);
      if (!r) continue;
      // ADR-411 — a fixture carrying an `assetId` renders as a real CC0 mesh
      // (top-anchored, hanging from the ceiling); otherwise the parametric
      // family-symbol solid (colour-by-system aware). One falls through to the
      // other so existing parametric fixtures are unaffected.
      const mesh = mepFixtureToObject3D(fixture, ctx.floorElevationMm, ctx.activeLevelId, r.baseElevation)
        ?? fixtureToMesh(
          fixture, ctx.floorElevationMm, ctx.activeLevelId, r.baseElevation,
          ctx.systemColorIndex.get(fixture.id),
        );
      if (mesh) { mesh.userData['buildingId'] = r.buildingId; this.group.add(mesh); }
    }
  }

  /** ADR-408 Φ3/Φ5 — electrical panels: circuit sources, excluded from colour-by-system. */
  private syncPanels(entities: Bim3DEntities, ctx: SyncContext): void {
    syncPointEntities(this.group, entities.panels, 'electrical-panel', ctx, this.resolveEntity.bind(this),
      (p, c, r) => panelToMesh(p, c.floorElevationMm, c.activeLevelId, r.baseElevation));
  }

  /** ADR-408 Φ12 — plumbing manifolds: distribution sources, excluded from colour-by-system. */
  private syncManifolds(entities: Bim3DEntities, ctx: SyncContext): void {
    syncPointEntities(this.group, entities.manifolds, 'mep-manifold', ctx, this.resolveEntity.bind(this),
      (m, c, r) => manifoldToMesh(m, c.floorElevationMm, c.activeLevelId, r.baseElevation));
  }

  /** ADR-408 Εύρος Β — heating radiators (hydronic terminals). */
  private syncRadiators(entities: Bim3DEntities, ctx: SyncContext): void {
    syncPointEntities(this.group, entities.radiators, 'mep-radiator', ctx, this.resolveEntity.bind(this),
      (rad, c, r) => radiatorToMesh(rad, c.floorElevationMm, c.activeLevelId, r.baseElevation));
  }

  /** ADR-408 Εύρος Β — heating boilers (hydronic source). */
  private syncBoilers(entities: Bim3DEntities, ctx: SyncContext): void {
    syncPointEntities(this.group, entities.boilers, 'mep-boiler', ctx, this.resolveEntity.bind(this),
      (b, c, r) => boilerToMesh(b, c.floorElevationMm, c.activeLevelId, r.baseElevation));
  }

  /** ADR-408 DHW — domestic hot water heaters (DHW source). */
  private syncWaterHeaters(entities: Bim3DEntities, ctx: SyncContext): void {
    syncPointEntities(this.group, entities.waterHeaters, 'mep-water-heater', ctx, this.resolveEntity.bind(this),
      (wh, c, r) => waterHeaterToMesh(wh, c.floorElevationMm, c.activeLevelId, r.baseElevation));
  }

  /** ADR-407 — standalone path-based railings (posts + balusters + rails). */
  private syncRailings(entities: Bim3DEntities, ctx: SyncContext): void {
    syncPointEntities(this.group, entities.railings, 'railing', ctx, this.resolveEntity.bind(this),
      (rail, c, r) => railingToMesh(rail, c.floorElevationMm, c.activeLevelId, r.baseElevation));
  }

  /** ADR-410 — mesh-based CC0 furniture (glTF cache; bbox placeholder on miss). */
  private syncFurnitures(entities: Bim3DEntities, ctx: SyncContext): void {
    syncPointEntities(this.group, entities.furnitures, 'furniture', ctx, this.resolveEntity.bind(this),
      (f, c, r) => furnitureToObject3D(f, c.floorElevationMm, c.activeLevelId, r.baseElevation));
  }

  private syncBeams(entities: Bim3DEntities, ctx: SyncContext): void {
    // ADR-534 §monolithic-cut — host inputs των πλακών (soffit) ώστε το ορατό δοκάρι να κόβεται όπου το
    // καλύπτει πλάκα οροφής (μηδέν z-fighting). Άδειο όταν δεν υπάρχει πλάκα → no-op.
    const slabHosts = buildCeilingSlabHosts(entities.slabs);
    for (const beam of entities.beams) {
      const r = this.resolveEntity(beam, 'beam', ctx);
      if (!r) continue;
      const beamTopMm = beam.params.topElevation + (beam.params.zOffset ?? 0);
      const beamFootprint = beam.geometry.outline.vertices.map((v) => ({ x: v.x, y: v.y }));
      const clipTopZmm = resolveMemberTopClipZmm(beamFootprint, beamTopMm, beamTopMm - beam.params.depth, slabHosts);
      // ADR-449 Slice X1 — suppress per-element σοβάς δοκαριού· η scene-level ΕΝΙΑΙΑ
      // silhouette (`syncStructuralFinishSkin`) αναλαμβάνει το συνεχές δέρμα → μηδέν overlap/
      // διπλή γραμμή στις συμβολές. (Το BOQ μένει per-element, σε ξεχωριστό path — αμετάβλητο.)
      // ADR-404 Bug A — κεκλιμένη (sloped) δοκός ΕΞΑΙΡΕΙΤΑΙ από το flat union → per-element
      // σοβάς (suppress=false) που ακολουθεί την κλίση· επίπεδη → suppress (silhouette).
      const mesh = beamToMesh(
        beam, ctx.activeLevelId, r.baseElevation, entities.walls, entities.columns, !isBeamTilted(beam.params), ctx.floorElevationMm, clipTopZmm,
      );
      if (mesh) { mesh.userData['buildingId'] = r.buildingId; this.group.add(mesh); }
    }
  }

  /**
   * ADR-436 — structural foundations (pad/strip/tie-beam, IfcFooting). Hang-down
   * solid below grade (`topElevationMm − thickness`). Own V/G category
   * `'foundation'` (structural discipline). `?? []` guards legacy floor-stack
   * entries predating ADR-436.
   */
  private syncFoundations(entities: Bim3DEntities, ctx: SyncContext): void {
    syncPointEntities(this.group, entities.foundations, 'foundation', ctx, this.resolveEntity.bind(this),
      (f, c, r) => foundationToMesh(f, c.floorElevationMm, c.activeLevelId, r.baseElevation));
  }

  private syncSlabs(entities: Bim3DEntities, ctx: SyncContext): void {
    for (const slab of entities.slabs) {
      const r = this.resolveEntity(slab, 'slab', ctx);
      if (!r) continue;
      const openingsForSlab = filterHostedSlabOpenings(
        entities.slabOpenings, slab.id, r.buildingMode, ctx,
      );
      const mesh = slabToMesh(slab, openingsForSlab, ctx.activeLevelId, r.baseElevation, ctx.floorElevationMm);
      if (mesh) { mesh.userData['buildingId'] = r.buildingId; this.group.add(mesh); }
    }
  }

  /**
   * ADR-417 — parametric pitched roofs (faces extruded down by thickness). §10 #4:
   * own V/G category `'roof'` (architectural discipline) — independent visibility
   * from slab (Revit-parity). buildingBaseElevation passed through like slab/railing.
   */
  private syncRoofs(entities: Bim3DEntities, ctx: SyncContext): void {
    syncPointEntities(this.group, entities.roofs, 'roof', ctx, this.resolveEntity.bind(this),
      (roof, c, r) => roofToMesh(roof, c.activeLevelId, r.baseElevation));
  }

  /**
   * ADR-419 — floor-finish coverings (IfcCovering FLOORING). Thin polygon solid
   * per room, sits at FFL. Own V/G category `'floor-finish'` (architectural).
   */
  private syncFloorFinishes(entities: Bim3DEntities, ctx: SyncContext): void {
    syncPointEntities(this.group, entities.floorFinishes, 'floor-finish', ctx, this.resolveEntity.bind(this),
      (ff, c, r) => floorFinishToMesh(ff, c.floorElevationMm, c.activeLevelId, r.baseElevation));
  }

  /**
   * ADR-408 Εύρος Β #3 — underfloor radiant heating loops. A `THREE.Group` of the
   * REAL serpentine pipes (swept tubes along `geometry.loopPath`) + a faint screed
   * band, at FFL + screedOffset. Own V/G category `'mep-underfloor'` (plumbing).
   */
  private syncUnderfloors(entities: Bim3DEntities, ctx: SyncContext): void {
    syncPointEntities(this.group, entities.underfloors, 'mep-underfloor', ctx, this.resolveEntity.bind(this),
      (uf, c, r) => underfloorToObject3D(uf, c.floorElevationMm, c.activeLevelId, r.baseElevation));
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
