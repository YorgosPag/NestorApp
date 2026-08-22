/**
 * ADR-435 — Entity → ClashEntity normaliser (SSoT, Slice 0).
 *
 * The cached `entity.geometry.bbox` is NOT directly usable for 3D collision:
 *   - XY is in **canvas/scene units**, Z is in **metres** (mixed) — και πλέον το λέει
 *     ο ΤΥΠΟΣ, όχι αυτό το σχόλιο: `SolidBounds.minZm`/`maxZm` (ADR-793).
 *   - `column` / `mep-fixture` / `mep-radiator` / `mep-boiler` / `mep-water-heater`
 *     κουβαλούν **{@link PlanBounds}** — ίχνος **χωρίς καμία αξίωση ύψους**· το
 *     πραγματικό κατακόρυφο εύρος ζει στα params (`height`, ή
 *     `mountingElevationMm ± bodyHeightMm/2`).
 *
 * 🔴 **ADR-793 — γιατί αυτό είναι πλέον ΤΥΠΟΣ και όχι πρόζα.** Μέχρι 2026-08-22 η
 * διάκριση «στερεό έναντι ίχνους» ζούσε **αποκλειστικά** σε αυτό το σχόλιο και στην
 * χειρόγραφη αλυσίδα `if` παρακάτω — το σχήμα που στο ίδιο repo έχει αποτύχει
 * **μετρημένα** στα CHECK 3.34 (63) · 3.37 (18 vs 26) · 3.49 (60). Και οι δύο τρόποι
 * να σπάσει ήταν **σιωπηλοί**: ένα είδος-ίχνος στον πρώτο κλάδο έδινε AABB **μηδενικού
 * ύψους** (η ανίχνευση συγκρούσεων χάνει κάθε κατακόρυφη επικάλυψη, χωρίς σφάλμα),
 * και το `railing` — που έγραφε z σε **χιλιοστά** — θα έδινε AABB **1000× ψηλότερο**.
 * Πλέον **δεν μεταγλωττίζονται**: ο πρώτος κλάδος απαιτεί `SolidBounds`, το ίχνος δεν
 * είναι εκχωρήσιμο εκεί, και η μονάδα ζει στο όνομα του πεδίου.
 *
 * This module is the ONE place that reconciles all of that into a single
 * consistent metric space: `(planX_m, planY_m, elevation_m)`. MEP segments also
 * yield an exact capsule (axis + radius) for the narrow-phase. THREE-free → the
 * whole engine stays pure/headless/testable.
 *
 * @see ./clash-types.ts
 * @see ../../utils/scene-units.ts (sceneUnitsToMeters)
 */

import type { Entity } from '../../types/entities';
import {
  isMepSegmentEntity, isMepFittingEntity, isBeamEntity, isColumnEntity,
  isWallEntity, isSlabEntity, isMepFixtureEntity, isMepRadiatorEntity,
  isMepBoilerEntity, isMepWaterHeaterEntity,
} from '../../types/entities';
import type { SceneUnits } from '../../utils/scene-units';
import { sceneUnitsToMeters } from '../../utils/scene-units';
import type { PlanBounds, SolidBounds } from '../../bim/types/bim-base';
import type { MepSegmentEntity } from '../../bim/types/mep-segment-types';
import { resolveSegmentSection, resolveSegmentEndpointElevationsMm } from '../../bim/types/mep-segment-types';
import type { Aabb3, ClashEntity, Vec3 } from './clash-types';
import { aabbFromPoints } from './aabb';

const MM_TO_M = 0.001;

/** Inflate an AABB by `r` metres on every side (Minkowski radius). */
function inflate(box: Aabb3, r: number): Aabb3 {
  return {
    min: { x: box.min.x - r, y: box.min.y - r, z: box.min.z - r },
    max: { x: box.max.x + r, y: box.max.y + r, z: box.max.z + r },
  };
}

/**
 * Ίχνος (canvas units) + κατακόρυφο εύρος **σε μέτρα από τον καλούντα** → `Aabb3`.
 *
 * ⚠️ Δέχεται {@link PlanBounds} **επίτηδες**: κάθε `SolidBounds` είναι και ίχνος, αλλά
 * η υπογραφή δηλώνει ότι αυτή η συνάρτηση **δεν διαβάζει** το z του κουτιού — το
 * παίρνει από τον καλούντα, που είναι ο μόνος που ξέρει από πού προέρχεται.
 */
function bboxToAabb(bbox: PlanBounds, sceneToM: number, zMinM: number, zMaxM: number): Aabb3 {
  return {
    min: { x: bbox.min.x * sceneToM, y: bbox.min.y * sceneToM, z: zMinM },
    max: { x: bbox.max.x * sceneToM, y: bbox.max.y * sceneToM, z: zMaxM },
  };
}

/** A linear MEP segment → capsule-derived AABB + exact capsule. */
function segmentEntity(e: MepSegmentEntity, sceneToM: number, systemIds: readonly string[]): ClashEntity {
  const p = e.params;
  const elev = resolveSegmentEndpointElevationsMm(p);
  const a: Vec3 = { x: p.startPoint.x * sceneToM, y: p.startPoint.y * sceneToM, z: elev.startMm * MM_TO_M };
  const b: Vec3 = { x: p.endPoint.x * sceneToM, y: p.endPoint.y * sceneToM, z: elev.endMm * MM_TO_M };
  const section = resolveSegmentSection(p);
  const radiusM = (Math.max(section.widthMm, section.heightMm) / 2) * MM_TO_M;
  return {
    id: e.id,
    kind: 'mep-segment',
    aabb: inflate(aabbFromPoints(a, b), radiusM),
    capsule: { a, b, radiusM },
    discipline: p.classification,
    systemIds,
  };
}

/**
 * Resolve the elevation span (metres) of a point-mounted equipment box whose
 * cached bbox carries z=0. Convention (shared by fixture/radiator/boiler/heater):
 * the box spans `mountingElevationMm ± bodyHeightMm/2`.
 */
function mountedSpanM(mountingElevationMm: number, bodyHeightMm: number): readonly [number, number] {
  return [(mountingElevationMm - bodyHeightMm / 2) * MM_TO_M, (mountingElevationMm + bodyHeightMm / 2) * MM_TO_M];
}

/**
 * Normalise any scene `Entity` into a {@link ClashEntity}, or `null` when the kind
 * carries no clash-relevant 3D solid. `systemIds` (MepSystem memberships) come from
 * the orchestrator's membership map (legit-connection filtering).
 */
export function entityWorldAABB(
  entity: Entity,
  sceneUnits: SceneUnits,
  systemIds: readonly string[],
): ClashEntity | null {
  const sceneToM = sceneUnitsToMeters(sceneUnits);

  if (isMepSegmentEntity(entity)) return segmentEntity(entity, sceneToM, systemIds);

  if (isBeamEntity(entity) || isWallEntity(entity) || isSlabEntity(entity) || isMepFittingEntity(entity)) {
    // ADR-793 — `SolidBounds`: το ύψος είναι ΕΓΓΥΗΜΕΝΟ και σε μέτρα. Κανένα `?? 0`.
    const bbox: SolidBounds = entity.geometry.bbox;
    return { id: entity.id, kind: entity.type, aabb: bboxToAabb(bbox, sceneToM, bbox.minZm, bbox.maxZm), systemIds };
  }

  if (isColumnEntity(entity)) {
    const bbox = entity.geometry.bbox; // PlanBounds — ίχνος· η κολόνα ανεβαίνει δάπεδο→height
    const aabb = bboxToAabb(bbox, sceneToM, 0, entity.params.height * MM_TO_M);
    return { id: entity.id, kind: 'column', aabb, systemIds };
  }

  if (isMepFixtureEntity(entity) || isMepRadiatorEntity(entity) || isMepBoilerEntity(entity) || isMepWaterHeaterEntity(entity)) {
    const bbox = entity.geometry.bbox; // PlanBounds — ίχνος· το κατακόρυφο εύρος από params
    const [zMin, zMax] = mountedSpanM(entity.params.mountingElevationMm, entity.params.bodyHeightMm);
    return { id: entity.id, kind: entity.type, aabb: bboxToAabb(bbox, sceneToM, zMin, zMax), systemIds };
  }

  return null;
}
