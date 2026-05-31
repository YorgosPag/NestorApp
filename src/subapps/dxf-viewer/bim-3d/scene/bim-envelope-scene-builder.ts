import * as THREE from 'three';
import type { Bim3DEntities } from '../stores/Bim3DEntitiesStore';
import { envelopeChainToMesh, slabFlatLayerToMesh, revealLiningToMesh } from '../converters/EnvelopeToThree';
import { resolveWallTopProfile } from '../../bim/geometry/wall-top-profile';
import { makeWallTopContext, buildWallHostInputs } from '../../bim/geometry/wall-host-plan-builder';
import { resolveEnvelopeEdgeTops, type WallTopRef } from '../../bim/geometry/envelope-wall-top';
import { computeEnvelopeShell, collectEnvelopeOverrides } from '../../bim/geometry/envelope-shell';
import { resolveSlabsAboveForLevel } from '../../bim/geometry/footprint-region-classifier';
import type { ThermalEnvelopeSpec } from '../../bim/types/thermal-envelope-types';
import { computeEnvelopeOpeningCuts } from '../../bim/geometry/envelope-opening-cuts';
import { getEnvelopeSpec } from '../../bim/stores/envelope-spec-store';
import { getEnvelopeFloorSlabs } from '../../bim/stores/envelope-floor-slabs-store';
import { resolveEntityBuilding } from '../../bim/utils/bim-floor-utils';
import { resolveIsEntityVisible } from '../../bim/visibility/visibility-resolver';
import { getLayer } from '../../stores/LayerStore';
import type { OpeningEntity } from '../../bim/types/opening-types';
import type { SyncContext, ShouldRenderFn } from './bim-scene-context';

/**
 * ADR-396 ETICS thermal-envelope 3D scene builder (extracted from
 * `BimSceneLayer` to keep that file within the Google file-size budget — the
 * envelope shell + flat layers + reveal linings are a self-contained
 * responsibility). Renders the 4 zones into the shared BIM group:
 *  - Z1 vertical shell (footprint-driven, ADR-396 v2 Φ5B + ADR-401 B3b top profile)
 *  - Z2/Z3 flat slab layers (per-element `envelopeLayer`)
 *  - Z4 opening reveal linings (per-element `revealInsulation`)
 *
 * `shouldRender` is the building-visibility gate owned by `BimSceneLayer`,
 * passed in so the ADR-382 gate stays a single SSoT.
 */
export function addEnvelopeToScene(
  group: THREE.Group,
  entities: Bim3DEntities,
  ctx: SyncContext,
  shouldRender: ShouldRenderFn,
): void {
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
    addEnvelopeShell(group, entities, ctx, spec, levelId, shouldRender);
  }
  addFlatLayers(group, entities, ctx, levelId, shouldRender);
  addRevealLinings(group, entities, ctx, levelId, shouldRender);
}

/** Building binding + base elevation για floor-level envelope (no layer gating). */
function resolveEnvelopeBuilding(
  entity: { layerId?: string } | undefined,
  ctx: SyncContext,
  shouldRender: ShouldRenderFn,
): { buildingId: string; baseElevation: number } | null {
  if (!entity) return null;
  const resolved = resolveEntityBuilding(
    entity as Parameters<typeof resolveEntityBuilding>[0],
    ctx.floors,
    ctx.buildings,
  );
  const buildingId = resolved?.id ?? '';
  if (!shouldRender(buildingId, ctx.useNewSystem, ctx.buildingVisModes, ctx.activeBuildingId)) {
    return null;
  }
  return { buildingId, baseElevation: resolved?.baseElevation ?? 0 };
}

/** Z1 — κατακόρυφο κέλυφος (footprint-driven shell των τοίχων+κολωνών+δοκαριών). */
function addEnvelopeShell(
  group: THREE.Group,
  entities: Bim3DEntities,
  ctx: SyncContext,
  spec: ThermalEnvelopeSpec,
  levelId: string,
  shouldRender: ShouldRenderFn,
): void {
  // ADR-396 v2 (Φ5B): πηγή = `computeEnvelopeShell` (footprint union + hole-gate +
  // per-element override). Ο engine επιστρέφει ΜΟΝΟ ό,τι μονώνεται (το hole-gate
  // ζει στον classifier), οπότε δεν φιλτράρουμε `enclosesRegion`. mirror
  // EnvelopeOverlay — 2D⟷3D parity. Ίδιες μονάδες με το chain ώστε τα opening cuts
  // (mm → canvas) να ευθυγραμμίζονται με τα face/outer loops.
  const sceneUnits = entities.walls[0]?.params.sceneUnits ?? 'mm';
  const overrides = collectEnvelopeOverrides([
    ...entities.walls, ...entities.columns, ...entities.beams,
  ]);
  // ADR-396 v2 Φ5C — cross-floor slabs (αίθριο vs δωμάτιο), event-time read μέσω
  // του non-React store (ίδιο SSoT με 2D `EnvelopeOverlay` → 2D⟷3D parity). Κενό
  // snapshot → όλες οι τρύπες = δωμάτια (safe default).
  const slabsSnap = getEnvelopeFloorSlabs();
  const slabsAbove = resolveSlabsAboveForLevel(slabsSnap.slabs, slabsSnap.floors, slabsSnap.activeFloorId);
  const { chains } = computeEnvelopeShell(
    entities.walls, entities.columns, entities.beams, spec, overrides, slabsAbove, { sceneUnits },
  );
  if (chains.length === 0) return;
  const materialId = spec.materialId;
  const wallById = new Map(entities.walls.map((w) => [w.id, w] as const));
  // ADR-401 B3b — προφίλ κορυφής ανά attached τοίχο (μηδέν κόστος όταν κανένας).
  const wallTopRefs = buildEnvelopeWallTopRefs(entities, ctx.floorElevationMm);

  for (const chain of chains) {
    // Ύψος ορόφου = max height των τοίχων του chain. params.height είναι mm → / 1000.
    let heightM = 0;
    for (const wid of chain.wallIds) {
      const w = wallById.get(wid);
      if (w && w.params.height > heightM) heightM = w.params.height / 1000;
    }
    if (heightM <= 0) continue;

    const firstWall = chain.wallIds.map((id) => wallById.get(id)).find((w) => w !== undefined);
    const r = resolveEnvelopeBuilding(firstWall, ctx, shouldRender);
    if (!r) continue;

    // ADR-396 — η μόνωση δεν σκεπάζει κουφώματα: cut ανά visible opening του
    // chain (ίδιο visibility filter με wallToMesh → 2D⟷3D parity).
    const chainOpenings = filterEnvelopeOpenings(entities.openings, chain.wallIds, ctx);
    const cuts = computeEnvelopeOpeningCuts(chain, chainOpenings, sceneUnits);

    // ADR-401 B3b — μεταβλητή κορυφή ανά ακμή όταν το chain ακουμπά attached
    // τοίχο· αλλιώς [] → flat heightM (ΑΜΕΤΑΒΛΗΤΟ).
    const edgeTops = wallTopRefs.size > 0
      ? resolveEnvelopeEdgeTops(chain, wallTopRefs, ctx.floorElevationMm)
      : [];

    const mesh = envelopeChainToMesh(
      chain, heightM, ctx.floorElevationMm, materialId, levelId, r.baseElevation, cuts, edgeTops,
    );
    if (mesh) { mesh.userData['buildingId'] = r.buildingId; group.add(mesh); }
  }
}

/**
 * ADR-401 B3b — `WallTopRef` (άξονας + προφίλ) ανά `attached` τοίχο του ορόφου,
 * για τη μεταβλητή κορυφή του Z1 κελύφους. Κενό map όταν κανένας attached
 * (κοινό case → μηδέν κόστος). Host inputs (beams+slabs) μέσω του SSoT
 * `buildWallHostInputs` (ίδιο plan space με τα chains = `*.params`).
 */
function buildEnvelopeWallTopRefs(
  entities: Bim3DEntities,
  floorElevationMm: number,
): Map<string, WallTopRef> {
  const refs = new Map<string, WallTopRef>();
  const attached = entities.walls.filter((w) => w.params?.topBinding === 'attached');
  if (attached.length === 0) return refs;
  const hostInputs = buildWallHostInputs(entities.beams, entities.slabs);
  for (const w of attached) {
    const start = { x: w.params.start.x, y: w.params.start.y };
    const end = { x: w.params.end.x, y: w.params.end.y };
    const profile = resolveWallTopProfile(
      w.params,
      makeWallTopContext(start, end, hostInputs, { floorElevationMm }),
    );
    refs.set(w.id, { start, end, profile });
  }
  return refs;
}

/**
 * Ανοίγματα τοίχων του chain που περνούν το opening visibility filter. Το
 * building-level gating έχει ήδη γίνει στο `resolveEnvelopeBuilding` (το chain
 * παραλείπεται όταν το κτίριο είναι κρυφό), οπότε δεν περνάμε buildingMode εδώ.
 */
function filterEnvelopeOpenings(
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
function addFlatLayers(
  group: THREE.Group,
  entities: Bim3DEntities,
  ctx: SyncContext,
  levelId: string,
  shouldRender: ShouldRenderFn,
): void {
  for (const slab of entities.slabs) {
    const layer = slab.params?.envelopeLayer;
    if (!layer || (layer.zone !== 'Z2' && layer.zone !== 'Z3')) continue;
    const footprint = slab.geometry?.polygon?.vertices;
    if (!footprint) continue;
    const r = resolveEnvelopeBuilding(slab, ctx, shouldRender);
    if (!r) continue;

    const slabTopMm = slab.params.levelElevation + (slab.params.heightOffsetFromLevel ?? 0);
    const mesh = slabFlatLayerToMesh(
      footprint, layer.zone, slabTopMm, slab.params.thickness, layer.thickness_m,
      layer.materialId, levelId, r.baseElevation,
    );
    if (mesh) { mesh.userData['buildingId'] = r.buildingId; group.add(mesh); }
  }
}

/** Z4 — μόνωση περβαζιών εξωτερικών ανοιγμάτων (per-element `revealInsulation`). */
function addRevealLinings(
  group: THREE.Group,
  entities: Bim3DEntities,
  ctx: SyncContext,
  levelId: string,
  shouldRender: ShouldRenderFn,
): void {
  const wallById = new Map(entities.walls.map((w) => [w.id, w] as const));
  for (const op of entities.openings) {
    const reveal = op.params?.revealInsulation;
    const outline = op.geometry?.outline?.vertices;
    if (!reveal || !outline) continue;
    const r = resolveEnvelopeBuilding(wallById.get(op.params.wallId), ctx, shouldRender);
    if (!r) continue;

    const grp = revealLiningToMesh(
      outline, op.geometry?.revealOutline?.vertices ?? outline,
      reveal.thickness_m, op.params.sillHeight, op.params.height,
      ctx.floorElevationMm, r.baseElevation, reveal.materialId, levelId,
    );
    if (grp) {
      grp.userData['buildingId'] = r.buildingId;
      for (const c of grp.children) c.userData['buildingId'] = r.buildingId;
      group.add(grp);
    }
  }
}
