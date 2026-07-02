/**
 * ADR-395 G6 — wall net-BOQ geometry feed (SSoT).
 *
 * Extracted from `useWallPersistence` (CHECK 4 / N.7.1 file-size split). Builds
 * the BOQ-feed entity for a wall with net area = gross − Σ(opening face area).
 * Scene/Firestore wall geometry stays gross (display/grips/3D untouched); only
 * the BOQ payload carries the net area. Mirror of `slab-boq-feed`.
 */

import type { SceneModel } from '../../types/entities';
import { isBeamEntity, isSlabEntity, isRoofEntity, isColumnEntity, isWallEntity } from '../../types/entities';
import type { WallEntity, WallGeometry } from '../../bim/types/wall-types';
import type { OpeningEntity } from '../../bim/types/opening-types';
import type { Pt2 } from '../../bim/geometry/shared/segment-polygon-coverage';
import {
  computeWallGeometry,
  buildWallFootprintRing,
  type OpeningFootprintForDeduction,
} from '../../bim/geometry/wall-geometry';
import { computeMemberCutbackRetentionRatio } from '../../bim/geometry/member-column-cutback';
import { computeWallCrossCutters, type WallCrossInput } from '../../bim/walls/wall-cross-cutback';
import {
  resolveWallTopProfile,
  type WallTopProfile,
} from '../../bim/geometry/wall-top-profile';
import {
  resolveWallBaseProfile,
  type WallBaseProfile,
} from '../../bim/geometry/wall-base-profile';
import {
  buildWallHostInputs,
  makeWallTopContext,
  makeWallBaseContext,
} from '../../bim/geometry/wall-host-plan-builder';
import type { BimEntityForBoq } from '../../bim/services/BimToBoqBridge';

/**
 * Collect the host wall's openings from the in-memory scene for net-area
 * subtraction. No Firestore query — openings already hydrated in the active
 * level scene.
 */
function collectWallOpenings(
  scene: SceneModel | null,
  wallId: string,
): OpeningFootprintForDeduction[] {
  if (!scene) return [];
  const result: OpeningFootprintForDeduction[] = [];
  for (const e of scene.entities) {
    if ((e as { type?: string }).type !== 'opening') continue;
    const op = e as OpeningEntity;
    if (op.params?.wallId === wallId && op.params.width > 0 && op.params.height > 0) {
      result.push({ width: op.params.width, height: op.params.height });
    }
  }
  return result;
}

/**
 * ADR-401 B3a/(γ) — top + base profiles για `attached` τοίχο (μεταβλητή κορυφή
 * κάτω από δοκάρι/πλάκα ΚΑΙ μεταβλητός πάτος πάνω σε θεμέλιο/δοκάρι). Χτίζει
 * per-wall host context από τα beams+slabs της σκηνής (ίδιο plan space =
 * `*.params`, mirror του `section-scene-sync`) και αποτιμά τους resolvers SSoT.
 * `floorElevationMm = 0`: το active level scene είναι floor-relative (datum
 * ορόφου = 0), όπως το 2D section. Κάθε προφίλ → null όταν δεν είναι `attached`.
 */
function resolveAttachedWallProfiles(
  entity: WallEntity,
  scene: SceneModel | null,
): { top: WallTopProfile | null; base: WallBaseProfile | null } {
  if (!scene) return { top: null, base: null };
  const topAttached = entity.params.topBinding === 'attached';
  const baseAttached = entity.params.baseBinding === 'attached';
  if (!topAttached && !baseAttached) return { top: null, base: null };
  const hostInputs = buildWallHostInputs(
    scene.entities.filter(isBeamEntity),
    scene.entities.filter(isSlabEntity),
    scene.entities.filter(isRoofEntity),
  );
  const start = { x: entity.params.start.x, y: entity.params.start.y };
  const end = { x: entity.params.end.x, y: entity.params.end.y };
  const top = topAttached
    ? resolveWallTopProfile(entity.params, makeWallTopContext(start, end, hostInputs, { floorElevationMm: 0 }))
    : null;
  const base = baseAttached
    ? resolveWallBaseProfile(entity.params, makeWallBaseContext(start, end, hostInputs, { floorElevationMm: 0 }))
    : null;
  return { top, base };
}

/**
 * Winner-wall cutters for THIS wall at cross junctions (ADR-458 wall↔wall extension). Builds the
 * cross inputs for `entity` + every other straight wall in the scene, runs the priority resolver,
 * and returns the plan footprints of the walls that CROSS `entity` and WIN (→ they cut its net
 * volume). `[]` when `entity` is a winner / uncrossed. `entityRing` = this wall's gross footprint.
 */
function wallCrossCuttersFor(
  entity: WallEntity,
  entityRing: readonly Pt2[],
  scene: SceneModel,
): Pt2[][] {
  const inputs: WallCrossInput[] = [{ id: entity.id, params: entity.params, footprint: entityRing }];
  for (const e of scene.entities) {
    if (e.id === entity.id || !isWallEntity(e) || e.kind !== 'straight' || !e.geometry) continue;
    const r = buildWallFootprintRing(e.geometry.outerEdge.points, e.geometry.innerEdge.points);
    if (r.length >= 3) inputs.push({ id: e.id, params: e.params, footprint: r });
  }
  return computeWallCrossCutters(inputs).get(entity.id) ?? [];
}

/**
 * ADR-458 — NET στατικός όγκος τοίχου (Revit «Join Geometry»): όταν κολόνα Ή τοίχος-νικητής (cross)
 * τέμνει τον τοίχο, ο κοινός όγκος μετριέται ΜΙΑ φορά — αλλιώς διπλομέτρηση μπετόν/τοιχοποιίας.
 * Mirror του `beamNetCoreGeometry`, αλλά με **retention ratio** (net/gross plan footprint) αντί
 * απόλυτο net area: το `area` του τοίχου είναι FACE area (μήκος×ύψος), όχι plan → ο λόγος
 * (unit-independent) συνθέτει καθαρά πάνω σε ό,τι net έχει ήδη προκύψει από openings/attached.
 *
 * Cutters = κολόνες (η κολόνα πάντα νικάει) **+** τοίχοι υψηλότερης προτεραιότητας που τον
 * διασταυρώνουν σε Χ (`wall-cross-cutback`). Ένα combined boolean difference → η επικάλυψη
 * μετριέται μία φορά ανεξάρτητα από το πλήθος cutters. DERIVED (ίδιο SSoT με 2Δ/3Δ), καμία τομή →
 * passthrough (byte-for-byte gross). v1 (mirror beam): κατακόρυφη επικάλυψη = ύψος τοίχου.
 */
function wallNetCoreGeometry(entity: WallEntity, geometry: WallGeometry, scene: SceneModel | null): WallGeometry {
  if (!scene) return geometry;
  const ring = buildWallFootprintRing(geometry.outerEdge.points, geometry.innerEdge.points);
  if (ring.length < 3) return geometry;

  const columnFootprints = scene.entities
    .filter(isColumnEntity)
    .map((c) => c.geometry?.footprint?.vertices)
    .filter((f): f is NonNullable<typeof f> => !!f && f.length >= 3)
    .map((f) => f.map((v) => ({ x: v.x, y: v.y })));
  const cutters: Pt2[][] = [...columnFootprints, ...wallCrossCuttersFor(entity, ring, scene)];
  if (cutters.length === 0) return geometry;

  const ratio = computeMemberCutbackRetentionRatio(ring, cutters);
  if (ratio === null) return geometry;
  return { ...geometry, area: geometry.area * ratio, volume: geometry.volume * ratio };
}

/**
 * Build the BOQ-feed entity for a wall with net geometry (gross − openings − columns).
 * Geometry recomputed when openings exist **or** the wall is `attached`
 * (ADR-401 B3a/(γ) — profile-aware gross area/volume με top − base)· otherwise
 * reuse the entity's own (gross/flat) geometry. Τέλος εφαρμόζεται το ADR-458 cutback (net volume):
 * κολόνες («η κολόνα νικάει») + τοίχοι-νικητές σε διασταύρωση Χ (priority) — identity fast-path
 * όταν τίποτα δεν τέμνει τον τοίχο.
 */
export function wallBoqEntity(entity: WallEntity, scene: SceneModel | null): BimEntityForBoq {
  const openings = collectWallOpenings(scene, entity.id);
  const { top, base } = resolveAttachedWallProfiles(entity, scene);
  const grossGeometry = openings.length > 0 || top !== null || base !== null
    ? computeWallGeometry(entity.params, entity.kind, openings, top ?? undefined, base ?? undefined)
    : entity.geometry;
  const geometry = wallNetCoreGeometry(entity, grossGeometry, scene);
  return {
    id: entity.id,
    kind: entity.kind,
    params: entity.params as unknown as Readonly<{ category?: string; [key: string]: unknown }>,
    geometry,
  };
}
