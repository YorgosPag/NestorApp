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
import { beamToMesh, slabToMesh, fixtureToMesh } from '../converters/BimToThreeConverter';
// ADR-534 §monolithic-cut — top-clip δοκαριών/κολόνων στο soffit καλύπτουσας πλάκας (μηδέν z-fighting).
import { buildCeilingSlabHosts, resolveMemberTopClipZmm } from './monolithic-slab-clip';
import { isBeamTilted } from '../../bim/geometry/beam-slope';
import { projectVerticesTo2D } from '../../bim/geometry/shared/polygon-utils';
import { syncWalls, syncColumns } from './bim-scene-attach-syncs';
// ADR-449 Slice 7 — scene-level ενιαίος σοβάς (merged structural silhouette).
import { syncStructuralFinishSkin } from './bim-scene-structural-finish-sync';
// ADR-473 — joint rebar post-pass (dowels / laps / anchorages at structural joints).
import { syncJointRebar, buildStructuralEntitySet } from './bim-scene-joint-rebar-sync';
import { stairToMeshes } from '../converters/StairToThreeConverter';
import { stairHasSolidWaist } from '../converters/stair-waist-slabs';
import { mepFixtureToObject3D } from '../converters/mep-fixture-to-mesh';
import { resolveFixtureBimCategory } from '../../bim/types/mep-fixture-types';
import { syncCircuitWires } from './sync-circuit-wires';
import { syncMepSegments, syncFittings } from './sync-mep-elements';
import { buildWallHostInputs, type HostFootprintInput } from '../../bim/geometry/wall-host-plan-builder';
import { makeStairHostResolver } from '../../bim/geometry/stair-vertical-profile';
import { resolveEffectiveStairParams } from '../../bim/geometry/stairs/stair-effective-params';
import { resolveStairBaseSlabSeat } from '../../bim/services/stair-slab-embedment';
import { computeStairGeometry } from '../../bim/geometry/stairs/StairGeometryService';
import type { StairEntity } from '../../bim/types/stair-types';
import { addEnvelopeToScene } from './bim-envelope-scene-builder';
import type { SyncContext } from './bim-scene-context';
import { EMPTY_FLOOR_VIS_SCOPE, type FloorVisibilityScope } from './floor-visibility-scope';
import { resolveEntityBuilding } from '../../bim/utils/bim-floor-utils';
import type { BuildingVisMode } from '../utils/building-visibility-state';
import { resolveIsEntityVisible } from '../../bim/visibility/visibility-resolver';
import { getIsolateEffectsSnapshot } from '../../systems/isolate/IsolateEffectsStore';
import type { Discipline } from '../../bim/discipline/bim-discipline';
import { useDrawingScaleStore } from '../../state/drawing-scale-store';
import { useMepSystemStore } from '../../bim/mep-systems/mep-system-store';
import { buildEntitySystemColorIntIndex } from '../../bim/mep-systems/mep-system-color';
import { getLayer } from '../../stores/LayerStore';
import { filterHostedSlabOpenings } from './bim-scene-hosted-opening-filters';
import { slabOpeningPickMesh } from '../converters/slab-opening-pick-mesh';
import { POINT_ENTITY_CONTRACTS } from './bim-scene-point-contracts';
import type { BimCategory } from '../../config/bim-object-styles';
import type { SceneLayer } from '../../types/entities';

export interface EntityResolution {
  readonly layer: SceneLayer | null;
  readonly buildingId: string;
  readonly buildingMode: BuildingVisMode | undefined;
  readonly baseElevation: number;
}

/** Construction-time behaviour switches (ADR-668). Absent ⇒ live-viewport semantics. */
export interface BimSceneLayerOptions {
  /**
   * ADR-668 — build meshes for entities the view filters OUT (isolate / V-G hide /
   * layer off-frozen / discipline off), instead of skipping them, and record their
   * ids in `hiddenEntityIds`.
   *
   * ONLY the 3Δ exporter sets this. Rationale (Giorgio, 2026-07-17): an export must
   * carry the whole model — if the rebar is switched off on screen it still ships, so
   * the user can turn it back on in the target DCC. Neither OBJ nor glTF can encode
   * "hidden" (OBJ has no such concept; three's GLTFExporter never writes
   * `KHR_node_visibility`), so the exporter marks them by NAME + material instead —
   * which is exactly what `hiddenEntityIds` feeds.
   *
   * The live viewport MUST leave this false: building hidden geometry every sync would
   * both cost frames and let filtered entities be picked by the raycaster.
   */
  readonly includeHidden?: boolean;
}

export class BimSceneLayer {
  readonly group: THREE.Group;
  private _hasMesh = false;
  private readonly includeHidden: boolean;
  private readonly _hiddenEntityIds = new Set<string>();

  constructor(scene: THREE.Scene, options: BimSceneLayerOptions = {}) {
    this.group = new THREE.Group();
    this.group.name = 'bim-entities';
    this.includeHidden = options.includeHidden === true;
    scene.add(this.group);
  }

  /**
   * ADR-668 — ids of entities that the view would have hidden but were built anyway
   * (`includeHidden`). Empty in normal viewport mode. Reflects the LAST sync.
   */
  get hiddenEntityIds(): ReadonlySet<string> {
    return this._hiddenEntityIds;
  }

  sync(
    entities: Bim3DEntities,
    floorElevationMm = 0,
    activeLevelId?: string,
    scope: FloorVisibilityScope = EMPTY_FLOOR_VIS_SCOPE,
    nextFloorElevationMm: number | undefined = undefined,
  ): void {
    this.clearGroup();
    const ctx = this.buildContext(floorElevationMm, activeLevelId, scope, nextFloorElevationMm);
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
    scope: FloorVisibilityScope = EMPTY_FLOOR_VIS_SCOPE,
  ): void {
    this.clearGroup();
    for (const floor of stack) {
      const ctx = this.buildContext(floor.floorElevationMm, floor.levelId, scope, floor.nextFloorElevationMm);
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
    scope: FloorVisibilityScope,
    nextFloorElevationMm: number | undefined,
  ): SyncContext {
    // Defensive per-field normalization (big-player option-bag convention — Three.js
    // `set(options)`, Revit API bags): a partial/absent/mis-typed scope must NEVER crash the
    // whole render loop. Restores the resilience the pre-scope-bag signature had via per-param
    // defaults — a stray `undefined` in `buildingVisModes.size` once took down the entire
    // <BimViewport3D> behind its ErrorBoundary (HMR desync during the 5-param→scope-bag refactor).
    // Defaults come from the SSoT empty scope, so `scope = []`/`{}` degrades to empty-visibility,
    // not a throw. ADR-382 Phase C / ADR-584.
    const {
      floors = EMPTY_FLOOR_VIS_SCOPE.floors,
      buildings = EMPTY_FLOOR_VIS_SCOPE.buildings,
      activeBuildingId = EMPTY_FLOOR_VIS_SCOPE.activeBuildingId,
      buildingVisModes = EMPTY_FLOOR_VIS_SCOPE.buildingVisModes,
      floorVisModes = EMPTY_FLOOR_VIS_SCOPE.floorVisModes,
    } = scope ?? EMPTY_FLOOR_VIS_SCOPE;
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
    this.syncSlabs(entities, ctx);
    this.syncStairs(entities, ctx);
    this.syncFixtures(entities, ctx);
    // ADR-550 Φ2 — auto-wired ομοιόμορφες point-entity οικογένειες (foundation/panel/
    // manifold/radiator/boiler/water-heater/railing/roof/floor-finish/underfloor/
    // furniture) μέσω ΕΝΟΣ registry, αντί για 11 χειροκίνητες sync*() μεθόδους. Κάθε
    // entry καλεί τον ίδιο `syncPointEntities` SSoT — μηδέν αλλαγή drawing logic.
    const resolvePoint = this.resolveEntity.bind(this);
    for (const contract of POINT_ENTITY_CONTRACTS) {
      contract.run(this.group, entities, ctx, resolvePoint);
    }
    syncCircuitWires(this.group, entities, ctx, (entity, category) => this.resolveEntity(entity, category, ctx));
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
   *
   * ADR-668 — under `includeHidden` a filtered entity is NOT dropped: it is built and
   * its id recorded in `hiddenEntityIds`. This is the one place that knows the verdict,
   * so recording it here keeps the ~30 converters that stamp mesh `userData` untouched.
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

    const visible = resolveIsEntityVisible(
      { category, id: entity.id, layerId: entity.layerId, discipline: entity.discipline },
      {
        objectStyles: ctx.objectStyles,
        disciplineVisibility: ctx.disciplineVisibility,
        layer, floorMode: ctx.floorMode, buildingMode,
        isolate: ctx.isolate,
      },
    ) && this.shouldRender(buildingId, ctx.useNewSystem, ctx.buildingVisModes, ctx.activeBuildingId);

    if (!visible) {
      if (!this.includeHidden) return null;
      // id-less geometry (envelope/wires) cannot be marked downstream — it is built
      // like everything else, just unmarked.
      if (entity.id) this._hiddenEntityIds.add(entity.id);
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

  private syncBeams(entities: Bim3DEntities, ctx: SyncContext): void {
    // ADR-534 §monolithic-cut — host inputs των πλακών (soffit) ώστε το ορατό δοκάρι να κόβεται όπου το
    // καλύπτει πλάκα οροφής (μηδέν z-fighting). Άδειο όταν δεν υπάρχει πλάκα → no-op.
    const slabHosts = buildCeilingSlabHosts(entities.slabs);
    for (const beam of entities.beams) {
      const r = this.resolveEntity(beam, 'beam', ctx);
      if (!r) continue;
      const beamTopMm = beam.params.topElevation + (beam.params.zOffset ?? 0);
      const beamFootprint = projectVerticesTo2D(beam.geometry.outline.vertices);
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

  private syncSlabs(entities: Bim3DEntities, ctx: SyncContext): void {
    for (const slab of entities.slabs) {
      const r = this.resolveEntity(slab, 'slab', ctx);
      if (!r) continue;
      const openingsForSlab = filterHostedSlabOpenings(
        entities.slabOpenings, slab.id, r.buildingMode, ctx,
      );
      const mesh = slabToMesh(slab, openingsForSlab, ctx.activeLevelId, r.baseElevation, ctx.floorElevationMm);
      if (mesh) { mesh.userData['buildingId'] = r.buildingId; this.group.add(mesh); }
      // ADR-535 Φ3b — an opening is a void in the slab (no geometry of its own), so it
      // was unselectable in 3D. Add an invisible pickable mesh filling each hole so a
      // click selects the opening (→ per-vertex reshape grips). Only visible openings.
      for (const op of openingsForSlab) {
        const pick = slabOpeningPickMesh(op, slab, ctx.activeLevelId, r.baseElevation, ctx.floorElevationMm);
        if (pick) { pick.userData['buildingId'] = r.buildingId; this.group.add(pick); }
      }
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

    // ADR-407 Φ7 — σκάλες που φιλοξενούν ήδη hosted κάγκελο: ο γυμνός handrail-σωλήνας τους
    // παραλείπεται (το κάγκελο render-άρει την κουπαστή) ώστε να μη διπλασιάζεται. Legacy σκάλες
    // χωρίς κάγκελο δεν είναι εδώ → κρατούν τον σωλήνα (μηδέν regression).
    const stairIdsWithHostedRailing = new Set<string>();
    for (const rail of entities.railings ?? []) {
      const src = rail.params?.pathSource;
      if (src?.kind === 'hosted' && src.hostType === 'stair') stairIdsWithHostedRailing.add(src.hostId);
    }

    for (const stair of entities.stairs) {
      const r = this.resolveEntity(stair, 'stair', ctx);
      if (!r) continue;
      // ADR-685 Φ2 — terminating seat: the monolithic waist must bear on its base slab, not
      // hang below the floor. Resolve the seating slab with the SAME detector as the Φ1 BOQ
      // dedup (`resolveStairBaseSlabSeat`) → zero drift; its underside trims the base flight.
      // `pass-through` (opening, Φ2) / floating / no-slab → undefined → no trim. Runs on the
      // same slab set as the host resolver, independent of whether base-attach fired. Only
      // monolithic/cantilever stairs have a waist that can hang (SSoT gate) → skip the rest.
      const seat = stairHasSolidWaist(stair)
        ? resolveStairBaseSlabSeat(stair, entities.slabs, { resolveHostInput })
        : undefined;
      const meshes = stairToMeshes(
        this.toEffectiveStair(stair, resolveHostInput),
        ctx.floorElevationMm,
        ctx.activeLevelId,
        r.baseElevation,
        seat?.slabUndersideZmm,
        stairIdsWithHostedRailing.has(stair.id),
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
    // ADR-668 — hidden-id bookkeeping describes the CURRENT build; a rebuild starts fresh
    // (a re-shown entity must not linger as hidden).
    this._hiddenEntityIds.clear();
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
