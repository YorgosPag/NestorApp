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
import { computeWallArealHeatCapacity } from './assembly-heat-capacity';
import { getGlazingSolarFactor, resolveOpeningUValue } from '../glazing-u-catalog';
import { isWindowKind } from '../../types/opening-types';
import { sceneUnitsToMeters, type SceneUnits } from '../../../utils/scene-units';
import type { Point3D } from '../../types/bim-base';
import { nearestEdgeOutwardAzimuthDeg } from '../../geometry/shared/polygon-azimuth-utils';
import type { OverhangOutline } from './solar-overhang-geometry';
import type { HorizonObstacle } from './solar-horizon-geometry';
import {
  resolveOpeningOverhangFactor,
  resolveOpeningFinFactor,
  resolveOpeningHorizonFactor,
} from './opening-shading-resolvers';
import { computeFrameFactor } from './frame-factor-geometry';
import { EXTERNAL_SURFACE_RESISTANCE_R_SE, getSolarAbsorptance } from './annual-gains-config';
import {
  resolveRoofSolarAbsorptanceLevel,
  resolveWallSolarAbsorptanceLevel,
} from '../thermal-space-use-catalog';
import {
  DEFAULT_FLOOR_U_WPER_M2K,
  DEFAULT_GROUND_WALL_THICKNESS_M,
  DEFAULT_ROOF_U_WPER_M2K,
  DEFAULT_WALL_U_WPER_M2K,
  GROUND_FLOOR_INTERNAL_RESISTANCE_R_SI,
  SOIL_THERMAL_CONDUCTIVITY_WPER_MK,
} from './heat-load-config';
import { computeGroundFloorUValue } from './ground-coupling';
import type { BoundaryCondition, HeatLoadBoundary } from './heat-load-types';
import {
  matchWallsToFootprint,
  pointToPolygonEdgeDistance,
  type Vec2,
  type WallFaceSegments,
} from './wall-footprint-match';

/** Θέση ορόφου του χώρου στη στοίβα — καθορίζει συνθήκη δαπέδου/οροφής. */
export type StoreyPosition = 'only' | 'lowest' | 'highest' | 'middle';

/**
 * Αποτέλεσμα του resolver: τα resolved όρια + γεωμετρικά μεγέθη που χρειάζεται ο
 * orchestrator (`derive-space-heat-loads`) αλλά ΔΕΝ είναι boundary.
 *   - `exposedFacadeCount` — αριθμός **εκτεθειμένων όψεων** (distinct matched εξωτ.
 *     τοίχων) → συντελεστής ανεμοπροστασίας `e` της διείσδυσης (ADR-422 L1.7). Συλλέγεται
 *     στο ίδιο pass με την εκτεθειμένη περίμετρο του L1.6 (μηδέν επιπλέον wall-match).
 */
export interface SpaceBoundaryResolution {
  readonly boundaries: HeatLoadBoundary[];
  /** Αριθμός εκτεθειμένων όψεων (0 = εσωτερικός χώρος). */
  readonly exposedFacadeCount: number;
}

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
  /**
   * Outlines οριζόντιων προβόλων (πλάκες/οροφές/μπαλκόνια **πάνω** από τα παράθυρα,
   * world XY μονάδα σκηνής) — geometry-derived overhang shading `F_ov` (ADR-422
   * L7.3 Slice B). Absent/κενό ⇒ κανένας πρόβολος ⇒ `F_ov=1.0` (zero-regression).
   */
  readonly overhangOutlines?: readonly OverhangOutline[];
  /**
   * Μάζες **γειτονικών κτιρίων** ως εμπόδια ορίζοντα (footprints στο **ενεργό** scene
   * frame μέσω `site-placement-transform` ADR-369 + απόλυτο ύψος κορυφής) — geometry-
   * derived horizon shading `F_hor` (ADR-422 L7.3 Slice E). Absent/κενό ⇒ καμία μάζα ⇒
   * fallback manual `horizonShadingLevel` (Slice C) ⇒ zero-regression.
   */
  readonly horizonObstacleOutlines?: readonly HorizonObstacle[];
  /**
   * METRES — απόλυτο ύψος βάσης του **ενεργού ορόφου** στο site datum (ADR-369:
   * `building.baseElevation + floor.elevation`) — αναφορά για το ύψος ανοίγματος στη
   * σκίαση ορίζοντα (Slice E). Absent ⇒ 0 (single-building / άστοχη τοποθέτηση).
   */
  readonly apertureBaseElevationM?: number;
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

/**
 * Αντιπροσωπευτικό σημείο τοίχου (XY) = μέσο της εσωτ. (ή εξωτ.) όψης του — πηγή του
 * προσανατολισμού του τοίχου μέσω `nearestEdgeOutwardAzimuthDeg(footprint, mid)`
 * (ADR-422 L7.6, ίδιο pattern με τα κουφώματα· reuse normal math, N.0.2). `null` αν
 * λείπει γεωμετρία όψης.
 */
function wallFaceMidpoint(wall: WallEntity): Vec2 | null {
  const pts = wall.geometry?.innerEdge?.points ?? wall.geometry?.outerEdge?.points;
  if (!pts || pts.length < 2) return null;
  const a = pts[0];
  const b = pts[pts.length - 1];
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
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

/**
 * Ένα κούφωμα ως `HeatLoadBoundary` (`external-air`): kind/U/area + το αζιμούθιο
 * (L7.2) + ο geometry-derived συντελεστής προβόλου `F_ov` (L7.3 Slice B) + ο
 * geometry-derived συντελεστής πλευρικού πτερυγίου `F_fin` (L7.3 Slice D, από τους
 * κάθετους τοίχους δίπλα· absent ⇒ fallback Slice C) + το per-window `g` (L7.4) + ο
 * γεωμετρικός συντελεστής πλαισίου `F_F` (L7.5, μόνο παράθυρα με ρητό `frameWidth`·
 * absent ⇒ 0.70). `null` αν μηδενικό εμβαδό.
 */
function buildOpeningBoundary(
  op: OpeningEntity,
  polygon: readonly Point3D[],
  ceilingHeightMm: number,
  sceneToM: number,
  wallThicknessMm: number,
  ctx: SpaceBoundaryContext,
): HeatLoadBoundary | null {
  const area = op.geometry?.area ?? 0;
  if (area <= 0) return null;
  const params = ctx.resolveOpeningEffective ? ctx.resolveOpeningEffective(op) : op.params;
  const pos = op.geometry?.position;
  const azimuthDeg = pos ? nearestEdgeOutwardAzimuthDeg(polygon, pos) ?? undefined : undefined;
  const isWindow = isWindowKind(params.kind);
  // L7.4: per-window g-value (SHGC)· πόρτες δεν έχουν ηλιακά κέρδη ⇒ undefined.
  const solarFactorG = isWindow ? getGlazingSolarFactor(params.glazingPanes) : undefined;
  // L7.5: γεωμετρικός F_F = (W−2f)(H−2f)/(W·H) — ΜΟΝΟ με ρητό frameWidth (absent-anchor).
  const frameFactorF =
    isWindow && params.frameWidth !== undefined
      ? computeFrameFactor(params.width, params.height, params.frameWidth)
      : undefined;
  return {
    kind: isWindow ? 'window' : 'door',
    condition: 'external-air',
    uValue: resolveOpeningUValue(params),
    area,
    refId: op.id,
    azimuthDeg,
    overhangShadingFactor: resolveOpeningOverhangFactor(
      pos, azimuthDeg, isWindow, params, ceilingHeightMm, sceneToM, wallThicknessMm, ctx,
    ),
    finShadingFactor: resolveOpeningFinFactor(
      op, pos, azimuthDeg, isWindow, params.width, sceneToM, wallThicknessMm, ctx,
    ),
    horizonShadingFactor: resolveOpeningHorizonFactor(
      pos, azimuthDeg, isWindow, params, sceneToM, wallThicknessMm, ctx,
    ),
    solarFactorG,
    frameFactorF,
  };
}

/** Boundaries ενός τοίχου: το παράθυρο/πόρτα + ο καθαρός τοίχος. `polygon` = το
 * footprint του χώρου (Point3D, CCW) — πηγή του προσανατολισμού των κουφωμάτων. */
function resolveWallBoundaries(
  wall: WallEntity,
  matchedLenScene: number,
  polygon: readonly Point3D[],
  ceilingHeightMm: number,
  sceneToM: number,
  ctx: SpaceBoundaryContext,
  wallSolarAbsorptance: number,
): HeatLoadBoundary[] {
  const isExterior = ctx.exteriorWallIds.has(wall.id);
  const condition: BoundaryCondition = isExterior ? 'external-air' : 'adjacent-heated';
  const heightM = Math.max(0, ceilingHeightMm) * 0.001;
  const grossAreaM2 = matchedLenScene * sceneToM * heightM;
  const out: HeatLoadBoundary[] = [];

  let openingsAreaM2 = 0;
  if (isExterior) {
    for (const op of openingsOnSpaceWall(wall.id, polygon, ctx)) {
      const boundary = buildOpeningBoundary(op, polygon, ceilingHeightMm, sceneToM, wall.params.thickness, ctx);
      if (!boundary) continue;
      openingsAreaM2 += boundary.area;
      out.push(boundary);
    }
  }

  // L7.6: ο εξωτ. τοίχος είναι «συλλέκτης» ηλιακής — azimuth για προσανατολισμό + α_S
  // για απορρόφηση. Εσωτ. τοίχοι (adjacent-heated) δεν δέχονται ήλιο ⇒ undefined.
  const mid = isExterior ? wallFaceMidpoint(wall) : null;
  const azimuthDeg = mid ? nearestEdgeOutwardAzimuthDeg(polygon, mid) ?? undefined : undefined;
  const netWallAreaM2 = Math.max(0, grossAreaM2 - openingsAreaM2);
  const resolveU = ctx.resolveWallU ?? defaultWallU;
  // L7.9-B: geometry-derived επιφανειακή θερμοχωρητικότητα `κ_m` από τα στρώματα του
  // assembly (EN ISO 13790 §12.3.1.1). Μόνο τοίχοι με resolvable DNA· custom/άγνωστα
  // υλικά → 0 → absent → fallback κατηγορία (zero-regression). Εξωτ. & εσωτ. τοίχοι
  // αποθηκεύουν θερμότητα, άρα stamp ανεξάρτητα από `isExterior`.
  const dna = wall.params.dna;
  const arealHeatCapacityJperM2K = dna
    ? computeWallArealHeatCapacity(dna) || undefined
    : undefined;
  out.push({
    kind: 'wall',
    condition,
    uValue: resolveU(wall),
    area: netWallAreaM2,
    refId: wall.id,
    azimuthDeg,
    solarAbsorptance: isExterior ? wallSolarAbsorptance : undefined,
    arealHeatCapacityJperM2K,
  });
  return out;
}

/**
 * Συνθήκη + U + kind δαπέδου ανάλογα με τη θέση ορόφου. Για δάπεδο **επί εδάφους**
 * (`lowest`/`only`) εφαρμόζεται EN ISO 13370 σύζευξη (ADR-422 L1.6): effective `U_g`
 * (από `A`, εκτεθειμένη περίμετρο `P`, ισοδύναμο πάχος) με override `b`=1.0. Όταν
 * `P≤0` (degenerate/πλήρως εσωτερικό δάπεδο) ⇒ `computeGroundFloorUValue` επιστρέφει
 * `null` ⇒ fallback flat `b≈0.5` με `DEFAULT_FLOOR_U` (συντηρητικό, zero-regression).
 */
function resolveFloorBoundary(
  areaM2: number,
  position: StoreyPosition,
  exposedPerimeterM: number,
  groundWallThicknessM: number,
): HeatLoadBoundary {
  const onGround = position === 'lowest' || position === 'only';
  if (!onGround) {
    return { kind: 'floor', condition: 'adjacent-heated', uValue: DEFAULT_FLOOR_U_WPER_M2K, area: areaM2 };
  }
  const groundUValue = computeGroundFloorUValue({
    areaM2,
    exposedPerimeterM,
    floorUValueWperM2K: DEFAULT_FLOOR_U_WPER_M2K,
    wallThicknessM: groundWallThicknessM,
    soilConductivityWperMK: SOIL_THERMAL_CONDUCTIVITY_WPER_MK,
    internalSurfaceResistanceM2KperW: GROUND_FLOOR_INTERNAL_RESISTANCE_R_SI,
    externalSurfaceResistanceM2KperW: EXTERNAL_SURFACE_RESISTANCE_R_SE,
  });
  return {
    kind: 'floor',
    condition: 'ground',
    uValue: groundUValue ?? DEFAULT_FLOOR_U_WPER_M2K,
    area: areaM2,
    // 13370 `U_g` ενσωματώνει τη διαδρομή εδάφους ⇒ πλήρες ΔΤ (b=1). Fallback (null) ⇒
    // χωρίς stamp ⇒ ο engine εφαρμόζει το flat ground `b`.
    ...(groundUValue !== null ? { groundTemperatureFactor: 1.0 } : {}),
  };
}

/**
 * Συνθήκη + U + kind οροφής ανάλογα με τη θέση ορόφου. L7.7: η εξωτ. στέγη (`roof` &
 * `external-air`) είναι «συλλέκτης» ηλιακής → στάμπα `solarAbsorptance` (per-space α_S).
 * Οριζόντια ⇒ `azimuthDeg` undefined (βλέπει όλο τον ουρανό). Εσωτ. οροφή
 * (`ceiling`/adjacent-heated) δεν δέχεται ήλιο ⇒ undefined.
 */
function resolveRoofBoundary(
  areaM2: number,
  position: StoreyPosition,
  roofSolarAbsorptance: number,
): HeatLoadBoundary {
  const isRoof = position === 'highest' || position === 'only';
  return {
    kind: isRoof ? 'roof' : 'ceiling',
    condition: isRoof ? 'external-air' : 'adjacent-heated',
    uValue: DEFAULT_ROOF_U_WPER_M2K,
    area: areaM2,
    solarAbsorptance: isRoof ? roofSolarAbsorptance : undefined,
  };
}

/**
 * Πλήρες `SpaceBoundaryResolution` ενός θερμικού χώρου: όρια (τοίχοι + κουφώματα +
 * δάπεδο + οροφή) + αριθμός εκτεθειμένων όψεων (L1.7). Idempotent. Επιστρέφει κενά
 * όρια + 0 όψεις για degenerate footprint (<3 κορυφές).
 */
export function resolveSpaceBoundaries(
  space: ThermalSpaceEntity,
  ctx: SpaceBoundaryContext,
): SpaceBoundaryResolution {
  const verts = space.params.footprint?.vertices ?? [];
  if (verts.length < 3) return { boundaries: [], exposedFacadeCount: 0 };

  const footprint: Vec2[] = verts.map((v) => ({ x: v.x, y: v.y }));
  const sceneUnits: SceneUnits = space.params.sceneUnits ?? 'mm';
  const sceneToM = sceneUnitsToMeters(sceneUnits);
  const ceilingHeightMm = space.params.ceilingHeightMm;
  const geometry = space.geometry ?? computeThermalSpaceGeometry(space.params);

  const faces = ctx.walls.map(wallFaceSegments);
  const matched = matchWallsToFootprint(footprint, faces, ctx.tol);

  // L7.6: per-space ηλιακή απορροφητικότητα εξωτ. τοίχων (απόχρωση ?? medium=0.6).
  const wallSolarAbsorptance = getSolarAbsorptance(
    resolveWallSolarAbsorptanceLevel(space.params),
  );
  // L7.7: per-space ηλιακή απορροφητικότητα στέγης (απόχρωση ?? medium=0.6· ξεχωριστή).
  const roofSolarAbsorptance = getSolarAbsorptance(
    resolveRoofSolarAbsorptanceLevel(space.params),
  );

  // L1.6: εκτεθειμένη περίμετρος `P` = Σ μηκών matched **εξωτ.** τοίχων + length-weighted
  // μέσο πάχος `w` (Revit-grade· fallback `DEFAULT_GROUND_WALL_THICKNESS_M` αν P≤0) — για
  // την EN ISO 13370 σύζευξη του δαπέδου επί εδάφους.
  let exposedPerimeterScene = 0;
  let exteriorThicknessLenScene = 0;
  // L1.7: αριθμός εκτεθειμένων όψεων (distinct matched εξωτ. τοίχοι) → συντελεστής
  // ανεμοπροστασίας `e` της διείσδυσης. Απλοποίηση v1: collinear τμήματα της ίδιας
  // όψης μετρώνται ξεχωριστά (conservative — περισσότερες όψεις ⇒ μεγαλύτερο `e`)·
  // ο τύπος ενδιαφέρεται μόνο για 0/1/≥2. Per-orientation grouping = future.
  let exposedFacadeCount = 0;

  const boundaries: HeatLoadBoundary[] = [];
  for (const wall of ctx.walls) {
    const lenScene = matched.get(wall.id);
    if (lenScene === undefined || lenScene <= 0) continue;
    if (ctx.exteriorWallIds.has(wall.id)) {
      exposedPerimeterScene += lenScene;
      exteriorThicknessLenScene += lenScene * Math.max(0, wall.params.thickness);
      exposedFacadeCount += 1;
    }
    boundaries.push(
      ...resolveWallBoundaries(
        wall,
        lenScene,
        verts,
        ceilingHeightMm,
        sceneToM,
        ctx,
        wallSolarAbsorptance,
      ),
    );
  }

  const exposedPerimeterM = exposedPerimeterScene * sceneToM;
  const groundWallThicknessM =
    exposedPerimeterScene > 0
      ? (exteriorThicknessLenScene / exposedPerimeterScene) * sceneToM
      : DEFAULT_GROUND_WALL_THICKNESS_M;

  boundaries.push(
    resolveFloorBoundary(geometry.area, ctx.storeyPosition, exposedPerimeterM, groundWallThicknessM),
  );
  boundaries.push(resolveRoofBoundary(geometry.area, ctx.storeyPosition, roofSolarAbsorptance));
  return { boundaries, exposedFacadeCount };
}
