/**
 * ADR-422 L1 — Resolver οριακών επιφανειών θερμικού χώρου (scene → boundaries).
 *
 * Παράγει το `HeatLoadBoundary[]` για έναν θερμικό χώρο από τα scene entities:
 *   - **Τοίχοι**: αντιστοίχιση footprint→τοίχους (`wall-footprint-match`)·
 *     εξωτερικοί (από το envelope shell) → `external-air`, εσωτερικοί →
 *     `adjacent-heated` (b=0). Επιφάνεια = μήκος×ύψος − κουφώματα. U από DNA.
 *   - **Κουφώματα**: όσα είναι σε εξωτ. τοίχο του χώρου & το κέντρο τους ακουμπά
 *     το όριο → `external-air`, U από `resolveOpeningUValue` (effective).
 *   - **Δάπεδο**: `ground` (χαμηλότερος όροφος) ή `adjacent-heated` (ενδιάμεσος).
 *   - **Οροφή**: `external-air` roof (ψηλότερος όροφος) ή `adjacent-heated` ceiling.
 *
 * Slab U (όταν δεν υπάρχουν στρώσεις) → default constructions (`heat-load-config`),
 * Revit-style. Οι θερμοκρασίες/Te εφαρμόζονται από το `heat-load-engine` (caller).
 *
 * Pure-ish: καμία store/persistence — όλα τα entities δίνονται από τον caller
 * (`compute-all-space-heat-loads`). Lengths σε scene units → m με `sceneUnitsToMeters`.
 *
 * @see ./wall-footprint-match · ./heat-load-engine · ../glazing-u-catalog
 * @see docs/centralized-systems/reference/adrs/ADR-422-bim-heating-mechanical-study.md §3 (L1)
 */

import type { WallEntity } from '../../types/wall-types';
import type { OpeningEntity } from '../../types/opening-types';
import type { ThermalSpaceEntity } from '../../types/thermal-space-types';
import { computeThermalSpaceGeometry } from '../../types/thermal-space-types';
import { computeWallTypeUValue } from '../wall-assembly-thermal';
import { resolveOpeningUValue } from '../glazing-u-catalog';
import { isWindowKind } from '../../types/opening-types';
import { sceneUnitsToMeters, type SceneUnits } from '../../../utils/scene-units';
import type { Point3D } from '../../types/bim-base';
import { nearestEdgeOutwardAzimuthDeg } from '../../geometry/shared/polygon-azimuth-utils';
import {
  DEFAULT_FLOOR_U_WPER_M2K,
  DEFAULT_ROOF_U_WPER_M2K,
  DEFAULT_WALL_U_WPER_M2K,
} from './heat-load-config';
import type { BoundaryCondition, HeatLoadBoundary } from './heat-load-types';
import {
  matchWallsToFootprint,
  pointToPolygonEdgeDistance,
  type Vec2,
  type WallFaceSegments,
} from './wall-footprint-match';

/** Θέση ορόφου του χώρου στη στοίβα — καθορίζει συνθήκη δαπέδου/οροφής. */
export type StoreyPosition = 'only' | 'lowest' | 'highest' | 'middle';

export interface SpaceBoundaryContext {
  /** Τοίχοι του ίδιου ορόφου (με geometry.innerEdge/outerEdge). */
  readonly walls: readonly WallEntity[];
  /** Κουφώματα του ίδιου ορόφου. */
  readonly openings: readonly OpeningEntity[];
  /** Σύνολο id εξωτερικών τοίχων (από envelope shell). */
  readonly exteriorWallIds: ReadonlySet<string>;
  /** Θέση ορόφου (για δάπεδο/οροφή). */
  readonly storeyPosition: StoreyPosition;
  /** Ανοχή αντιστοίχισης footprint→τοίχου (scene units). */
  readonly tol: number;
  /** Override resolver U τοίχου (type-aware). Default: από instance DNA. */
  readonly resolveWallU?: (wall: WallEntity) => number;
  /** Override effective opening params (type resolution). Default: instance params. */
  readonly resolveOpeningEffective?: (opening: OpeningEntity) => OpeningEntity['params'];
}

/** U τοίχου: από DNA αν υπάρχει, αλλιώς fallback default. */
function defaultWallU(wall: WallEntity): number {
  const dna = wall.params.dna;
  if (dna) {
    const u = computeWallTypeUValue(dna);
    if (Number.isFinite(u) && u > 0) return u;
  }
  return DEFAULT_WALL_U_WPER_M2K;
}

/** Τμήματα όψης ενός τοίχου (inner + outer edge) ως ζεύγη Vec2. */
function wallFaceSegments(wall: WallEntity): WallFaceSegments {
  const segments: (readonly [Vec2, Vec2])[] = [];
  for (const edge of [wall.geometry?.innerEdge, wall.geometry?.outerEdge]) {
    const pts = edge?.points;
    if (!pts || pts.length < 2) continue;
    for (let i = 0; i < pts.length - 1; i++) {
      segments.push([{ x: pts[i].x, y: pts[i].y }, { x: pts[i + 1].x, y: pts[i + 1].y }]);
    }
  }
  return { wallId: wall.id, segments };
}

/** Κουφώματα ενός τοίχου που ακουμπούν το όριο του χώρου (m² έκαστο + effective U). */
function openingsOnSpaceWall(
  wallId: string,
  footprint: readonly Vec2[],
  ctx: SpaceBoundaryContext,
): readonly OpeningEntity[] {
  return ctx.openings.filter((op) => {
    if (op.params.wallId !== wallId) return false;
    const pos = op.geometry?.position;
    if (!pos) return false;
    return pointToPolygonEdgeDistance({ x: pos.x, y: pos.y }, footprint) <= ctx.tol;
  });
}

/** Boundaries ενός τοίχου: το παράθυρο/πόρτα + ο καθαρός τοίχος. `polygon` = το
 * footprint του χώρου (Point3D, CCW) — πηγή του προσανατολισμού των κουφωμάτων. */
function resolveWallBoundaries(
  wall: WallEntity,
  matchedLenScene: number,
  polygon: readonly Point3D[],
  heightM: number,
  sceneToM: number,
  ctx: SpaceBoundaryContext,
): HeatLoadBoundary[] {
  const isExterior = ctx.exteriorWallIds.has(wall.id);
  const condition: BoundaryCondition = isExterior ? 'external-air' : 'adjacent-heated';
  const grossAreaM2 = matchedLenScene * sceneToM * heightM;
  const out: HeatLoadBoundary[] = [];

  let openingsAreaM2 = 0;
  if (isExterior) {
    const resolveEff = ctx.resolveOpeningEffective;
    for (const op of openingsOnSpaceWall(wall.id, polygon, ctx)) {
      const area = op.geometry?.area ?? 0;
      if (area <= 0) continue;
      openingsAreaM2 += area;
      const params = resolveEff ? resolveEff(op) : op.params;
      const pos = op.geometry?.position;
      const azimuthDeg = pos
        ? nearestEdgeOutwardAzimuthDeg(polygon, pos) ?? undefined
        : undefined;
      out.push({
        kind: isWindowKind(params.kind) ? 'window' : 'door',
        condition: 'external-air',
        uValue: resolveOpeningUValue(params),
        area,
        refId: op.id,
        azimuthDeg,
      });
    }
  }

  const netWallAreaM2 = Math.max(0, grossAreaM2 - openingsAreaM2);
  const resolveU = ctx.resolveWallU ?? defaultWallU;
  out.push({ kind: 'wall', condition, uValue: resolveU(wall), area: netWallAreaM2, refId: wall.id });
  return out;
}

/** Συνθήκη + U + kind δαπέδου ανάλογα με τη θέση ορόφου. */
function resolveFloorBoundary(areaM2: number, position: StoreyPosition): HeatLoadBoundary {
  const onGround = position === 'lowest' || position === 'only';
  return {
    kind: 'floor',
    condition: onGround ? 'ground' : 'adjacent-heated',
    uValue: DEFAULT_FLOOR_U_WPER_M2K,
    area: areaM2,
  };
}

/** Συνθήκη + U + kind οροφής ανάλογα με τη θέση ορόφου. */
function resolveRoofBoundary(areaM2: number, position: StoreyPosition): HeatLoadBoundary {
  const isRoof = position === 'highest' || position === 'only';
  return {
    kind: isRoof ? 'roof' : 'ceiling',
    condition: isRoof ? 'external-air' : 'adjacent-heated',
    uValue: DEFAULT_ROOF_U_WPER_M2K,
    area: areaM2,
  };
}

/**
 * Πλήρες `HeatLoadBoundary[]` ενός θερμικού χώρου (τοίχοι + κουφώματα + δάπεδο +
 * οροφή). Idempotent. Επιστρέφει `[]` για degenerate footprint (<3 κορυφές).
 */
export function resolveSpaceBoundaries(
  space: ThermalSpaceEntity,
  ctx: SpaceBoundaryContext,
): HeatLoadBoundary[] {
  const verts = space.params.footprint?.vertices ?? [];
  if (verts.length < 3) return [];

  const footprint: Vec2[] = verts.map((v) => ({ x: v.x, y: v.y }));
  const sceneUnits: SceneUnits = space.params.sceneUnits ?? 'mm';
  const sceneToM = sceneUnitsToMeters(sceneUnits);
  const heightM = Math.max(0, space.params.ceilingHeightMm) * 0.001;
  const geometry = space.geometry ?? computeThermalSpaceGeometry(space.params);

  const faces = ctx.walls.map(wallFaceSegments);
  const matched = matchWallsToFootprint(footprint, faces, ctx.tol);

  const boundaries: HeatLoadBoundary[] = [];
  for (const wall of ctx.walls) {
    const lenScene = matched.get(wall.id);
    if (lenScene === undefined || lenScene <= 0) continue;
    boundaries.push(
      ...resolveWallBoundaries(wall, lenScene, verts, heightM, sceneToM, ctx),
    );
  }

  boundaries.push(resolveFloorBoundary(geometry.area, ctx.storeyPosition));
  boundaries.push(resolveRoofBoundary(geometry.area, ctx.storeyPosition));
  return boundaries;
}
