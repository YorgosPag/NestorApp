'use client';

/**
 * ADR-422 L1 — Συλλογή active-floor inputs για τον heat-load engine (SSoT).
 *
 * ΕΝΑ σημείο που μαζεύει ό,τι χρειάζεται ο `deriveSpaceHeatLoads`/engine από το
 * scene + το κτίριο του ενεργού ορόφου:
 *   - θερμικοί χώροι / τοίχοι / κουφώματα (filter BIM entities)
 *   - εξωτερικοί τοίχοι (`computeEnvelopePerimeter` — spec-free· μηδέν εξάρτηση
 *     από εφαρμοσμένο ETICS spec)
 *   - `Te` από `Building.climateZone` (ΤΟΤΕΕ 20701-3· fallback ζώνη Β)
 *   - θέση ορόφου στη στοίβα (δάπεδο ground vs ενδιάμεσο, στέγη vs οροφή)
 *   - `sceneUnits` + ανοχή αντιστοίχισης σε scene units
 *
 * Καταναλώνεται ΚΑΙ από το `HeatLoadOverlay` (όλοι οι χώροι) ΚΑΙ από το contextual
 * tab bridge (επιλεγμένος χώρος) → καμία διπλή λογική. Ο caller δίνει το BIM
 * `SceneModel` (reactivity) + το `active` gate· χωρίς scene/active → `null`.
 *
 * @see ../../bim/thermal/heat-load/derive-space-heat-loads (consumer math)
 * @see ./useSpaceHeatLoads (overlay wrapper) · της ίδιας οικογένειας με useBuildingFloorScenes
 * @see docs/centralized-systems/reference/adrs/ADR-422-bim-heating-mechanical-study.md §3 (L1)
 */

import { useMemo } from 'react';
import { useLevelsOptional } from '../../systems/levels/useLevels';
import { useFirestoreBuildings } from '@/hooks/useFirestoreBuildings';
import { useFloorsByBuilding } from '@/components/properties/shared/useFloorsByBuilding';
import { isBuildingStorey, type FloorKind } from '@/utils/floor-naming';
import {
  isWallEntity,
  isOpeningEntity,
  isThermalSpaceEntity,
  isSlabEntity,
  type Entity,
} from '../../types/entities';
import { useBuildingFloorScenes, type BuildingFloorScene } from './useBuildingFloorScenes';
import { useSiteNeighbourMasses } from './useSiteNeighbourMasses';
import type { SlabEntity, SlabKind } from '../../bim/types/slab-types';
import type { OverhangOutline } from '../../bim/thermal/heat-load/solar-overhang-geometry';
import type { SlabMatchCandidate } from '../../bim/thermal/heat-load/slab-space-match';
import {
  computeEnvelopePerimeter,
  type WallForEnvelope,
} from '../../bim/geometry/envelope-perimeter';
import {
  resolveSceneUnits,
  sceneUnitsToMeters,
  type SceneUnits,
} from '../../utils/scene-units';
import {
  getDesignOutdoorTempC,
  type ClimateZone,
} from '../../bim/thermal/kenak-thermal-config';
import type { StoreyPosition } from '../../bim/thermal/heat-load/space-boundary-resolver';
import type { SpaceHeatLoadDeriveInputs } from '../../bim/thermal/heat-load/derive-space-heat-loads';
import type { ThermalSpaceEntity } from '../../bim/types/thermal-space-types';
import type { SceneModel } from '../../types/scene';

/**
 * Ανοχή αντιστοίχισης ορίου χώρου → όψης τοίχου (m). Καλύπτει το offset μεταξύ
 * footprint (εσωτ. όψη) και όψεων τοίχου + snapping noise — μετατρέπεται σε scene
 * units ανά μονάδα σχεδίου.
 */
const HEAT_LOAD_MATCH_TOL_M = 0.35;

/** Default κλιματική ζώνη όταν το κτίριο δεν έχει ορίσει — Β (ηπειρωτική). */
const FALLBACK_CLIMATE_ZONE: ClimateZone = 'B';

/** Active-floor bundle: τα inputs του engine + οι χώροι (για το overlay). */
export interface HeatLoadInputsBundle extends SpaceHeatLoadDeriveInputs {
  readonly spaces: readonly ThermalSpaceEntity[];
  readonly sceneUnits: SceneUnits;
  /** Κλιματική ζώνη ορόφου (ΤΟΤΕΕ· για ΚΕΝΑΚ έλεγχο κελύφους L6). */
  readonly climateZone: ClimateZone;
}

/** Κλιματική ζώνη του κτιρίου (fallback Β όταν δεν έχει οριστεί). SSoT για Te + U_max. */
function resolveClimateZone(
  buildings: ReadonlyArray<{ id: string; climateZone?: 'A' | 'B' | 'C' | 'D' }>,
  buildingId: string | null,
): ClimateZone {
  const z = buildings.find((b) => b.id === buildingId)?.climateZone;
  return z === 'A' || z === 'B' || z === 'C' || z === 'D' ? z : FALLBACK_CLIMATE_ZONE;
}

/**
 * Απόλυτο ύψος βάσης του ενεργού ορόφου στο site datum (ADR-369): `building.baseElevation
 * + floor.elevation` (μέτρα). Αναφορά ύψους ανοίγματος για τη σκίαση ορίζοντα (Slice E).
 * Absent fields ⇒ 0 (single-building / χωρίς elevation data).
 */
function resolveApertureBaseElevationM(
  buildings: ReadonlyArray<{ id: string; baseElevation?: number }>,
  buildingId: string | null,
  floors: ReadonlyArray<{ id: string; elevation?: number }>,
  activeFloorId: string | null,
): number {
  const base = buildings.find((b) => b.id === buildingId)?.baseElevation ?? 0;
  const floorElev = floors.find((f) => f.id === activeFloorId)?.elevation ?? 0;
  return base + floorElev;
}

/**
 * Θέση ορόφου: floors ταξινομημένα αύξοντα (basement→up) → lowest/highest/middle.
 * ADR-461 — ΜΟΝΟ οι counted storeys ορίζουν το θερμικό lowest/highest (εξωτερικό
 * δάπεδο / στέγη). Foundation/roof/stair-penthouse εξαιρούνται, αλλιώς το θερμικό
 * μοντέλο θα χρησιμοποιούσε λάθος εξωτερικές επιφάνειες (π.χ. foundation→'lowest').
 */
function resolveStoreyPosition(
  floors: ReadonlyArray<{ id: string; kind?: FloorKind }>,
  activeFloorId: string | null,
): StoreyPosition {
  const counted = floors.filter((f) => f.kind === undefined || isBuildingStorey(f.kind));
  if (!activeFloorId || counted.length <= 1) return 'only';
  if (counted[0].id === activeFloorId) return 'lowest';
  if (counted[counted.length - 1].id === activeFloorId) return 'highest';
  return 'middle';
}

/** Εξωτερικοί τοίχοι = όσοι ανήκουν σε αλυσίδα κελύφους (spec-free perimeter). */
function resolveExteriorWallIds(
  walls: readonly WallForEnvelope[],
  sceneUnits: SceneUnits,
): Set<string> {
  const { chains } = computeEnvelopePerimeter(walls, 0, sceneUnits);
  const set = new Set<string>();
  for (const chain of chains) for (const id of chain.wallIds) set.add(id);
  return set;
}

/**
 * SlabKind του **active** ορόφου που σχηματίζουν οριζόντιο πρόβολο πάνω από τα
 * παράθυρά του (στέγη / κορνίζα). Οι slabs των άνω ορόφων μετρούν όλες (κάθε
 * προεξέχουσα πλάκα/μπαλκόνι σκιάζει· οι ευθυγραμμισμένες → `d_ov≈0`).
 */
const ACTIVE_FLOOR_OVERHANG_KINDS: ReadonlySet<SlabKind> = new Set<SlabKind>(['roof', 'ceiling']);

/** Outline μιας πλάκας ως κλειστό πολύγωνο XY (world coords μονάδα σκηνής). */
function slabOutline(slab: SlabEntity): OverhangOutline {
  return { polygonXY: slab.params.outline.vertices.map((v) => ({ x: v.x, y: v.y })) };
}

/** Σύνολο floorId των ορόφων **πάνω** από τον active (ordered floors basement→up). */
function floorsAboveActive(
  floors: ReadonlyArray<{ id: string }>,
  activeFloorId: string | null,
): ReadonlySet<string> {
  if (!activeFloorId) return new Set();
  const idx = floors.findIndex((f) => f.id === activeFloorId);
  if (idx < 0) return new Set();
  return new Set(floors.slice(idx + 1).map((f) => f.id));
}

/**
 * Outlines οριζόντιων προβόλων (ADR-422 L7.3 Slice B): οι στέγες/κορνίζες του
 * active ορόφου + ΟΛΕΣ οι πλάκες των άνω ορόφων (κάθε προεξοχή σκιάζει· οι
 * ευθυγραμμισμένες δίνουν `d_ov≈0` ⇒ zero-regression). Ίδιο world-XY frame.
 */
function collectOverhangOutlines(
  activeEntities: readonly Entity[],
  upperFloorScenes: readonly BuildingFloorScene[],
  aboveFloorIds: ReadonlySet<string>,
): readonly OverhangOutline[] {
  const outlines: OverhangOutline[] = [];
  for (const e of activeEntities) {
    if (isSlabEntity(e) && ACTIVE_FLOOR_OVERHANG_KINDS.has(e.params.kind)) outlines.push(slabOutline(e));
  }
  for (const fs of upperFloorScenes) {
    if (!aboveFloorIds.has(fs.floorId)) continue;
    for (const e of fs.model.entities) if (isSlabEntity(e)) outlines.push(slabOutline(e));
  }
  return outlines;
}

/** SlabKinds που λειτουργούν ως **δάπεδο** χώρου (εσωτ. επιφάνεια προς τα πάνω). */
const FLOOR_ROLE_SLAB_KINDS: ReadonlySet<SlabKind> = new Set<SlabKind>(['floor', 'ground', 'foundation']);

/** SlabKinds του **ενεργού** ορόφου που λειτουργούν ως **οροφή/στέγη** του χώρου. */
const ROOF_ROLE_ACTIVE_SLAB_KINDS: ReadonlySet<SlabKind> = new Set<SlabKind>(['roof', 'ceiling']);

/** Μια πλάκα ως υποψήφια αντιστοίχισης (id + outline + dna + kind). L7.9-C. */
function slabCandidate(slab: SlabEntity): SlabMatchCandidate {
  return {
    id: slab.id,
    outline: slab.params.outline.vertices,
    dna: slab.params.dna,
    kind: slab.params.kind,
  };
}

/** floorId του ορόφου **ακριβώς πάνω** από τον active (η πλάκα του = οροφή του χώρου). */
function immediateFloorAboveId(
  floors: ReadonlyArray<{ id: string }>,
  activeFloorId: string | null,
): string | null {
  if (!activeFloorId) return null;
  const idx = floors.findIndex((f) => f.id === activeFloorId);
  if (idx < 0 || idx + 1 >= floors.length) return null;
  return floors[idx + 1].id;
}

/**
 * Υποψήφιες πλάκες **δαπέδου** (ADR-422 L7.9-C): οι floor/ground/foundation του
 * active ορόφου. Best-match με containment στον resolver. Κενό ⇒ zero-regression.
 */
function collectFloorSlabs(activeEntities: readonly Entity[]): SlabMatchCandidate[] {
  const out: SlabMatchCandidate[] = [];
  for (const e of activeEntities) {
    if (isSlabEntity(e) && FLOOR_ROLE_SLAB_KINDS.has(e.params.kind)) out.push(slabCandidate(e));
  }
  return out;
}

/**
 * Υποψήφιες πλάκες **οροφής/στέγης** (ADR-422 L7.9-C): roof/ceiling του active
 * ορόφου + οι floor/ground πλάκες του ορόφου **ακριβώς από πάνω** (το δάπεδό του =
 * οροφή του χώρου, cross-floor). Best-match με containment. Κενό ⇒ zero-regression.
 */
function collectCeilingSlabs(
  activeEntities: readonly Entity[],
  upperFloorScenes: readonly BuildingFloorScene[],
  aboveFloorId: string | null,
): SlabMatchCandidate[] {
  const out: SlabMatchCandidate[] = [];
  for (const e of activeEntities) {
    if (isSlabEntity(e) && ROOF_ROLE_ACTIVE_SLAB_KINDS.has(e.params.kind)) out.push(slabCandidate(e));
  }
  if (aboveFloorId) {
    for (const fs of upperFloorScenes) {
      if (fs.floorId !== aboveFloorId) continue;
      for (const e of fs.model.entities) {
        if (isSlabEntity(e) && FLOOR_ROLE_SLAB_KINDS.has(e.params.kind)) out.push(slabCandidate(e));
      }
    }
  }
  return out;
}

export function useHeatLoadInputs(
  scene: SceneModel | null | undefined,
  active: boolean,
): HeatLoadInputsBundle | null {
  const levelsCtx = useLevelsOptional();
  const levels = levelsCtx?.levels;
  const currentLevelId = levelsCtx?.currentLevelId ?? null;

  const activeLevel = useMemo(
    () => (active && levels ? levels.find((l) => l.id === currentLevelId) ?? null : null),
    [active, levels, currentLevelId],
  );
  const buildingId = activeLevel?.buildingId ?? null;
  const activeFloorId = activeLevel?.floorId ?? null;

  const { buildings } = useFirestoreBuildings();
  const { floors } = useFloorsByBuilding(buildingId, active);
  // L7.3 Slice B — cross-floor overhang sourcing (πλάκες άνω ορόφων, riser pattern).
  const buildingFloorScenes = useBuildingFloorScenes(active);
  // L7.3 Slice E — cross-building horizon masses (γειτονικά κτίρια, ADR-369 placement).
  const horizonObstacleOutlines = useSiteNeighbourMasses(active);

  return useMemo<HeatLoadInputsBundle | null>(() => {
    if (!active || !scene) return null;
    const entities = scene.entities;
    const spaces = entities.filter(isThermalSpaceEntity);
    if (spaces.length === 0) return null;

    const walls = entities.filter(isWallEntity);
    const openings = entities.filter(isOpeningEntity);
    const sceneUnits = resolveSceneUnits(scene);
    const climateZone = resolveClimateZone(buildings, buildingId);
    const overhangOutlines = collectOverhangOutlines(
      entities,
      buildingFloorScenes,
      floorsAboveActive(floors, activeFloorId),
    );
    // L7.9-C: πλάκες δαπέδου (active) + οροφής/στέγης (active roof/ceiling + δάπεδο
    // ορόφου ακριβώς από πάνω) → geometry-derived θερμική μάζα `κ_m` οριζοντίων.
    const floorSlabs = collectFloorSlabs(entities);
    const ceilingSlabs = collectCeilingSlabs(
      entities,
      buildingFloorScenes,
      immediateFloorAboveId(floors, activeFloorId),
    );

    return {
      spaces,
      walls,
      openings,
      sceneUnits,
      climateZone,
      exteriorWallIds: resolveExteriorWallIds(walls, sceneUnits),
      outdoorTempC: getDesignOutdoorTempC(climateZone),
      storeyPosition: resolveStoreyPosition(floors, activeFloorId),
      tol: HEAT_LOAD_MATCH_TOL_M / sceneUnitsToMeters(sceneUnits),
      overhangOutlines,
      horizonObstacleOutlines,
      apertureBaseElevationM: resolveApertureBaseElevationM(buildings, buildingId, floors, activeFloorId),
      floorSlabs,
      ceilingSlabs,
    };
  }, [
    active,
    scene,
    buildings,
    buildingId,
    floors,
    activeFloorId,
    buildingFloorScenes,
    horizonObstacleOutlines,
  ]);
}
