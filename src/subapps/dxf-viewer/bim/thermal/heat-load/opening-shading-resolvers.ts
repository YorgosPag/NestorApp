/**
 * ADR-422 L7.3 — Per-opening geometry-derived solar-shading resolvers (PURE-ish SSoT).
 *
 * Εξαγωγή από `space-boundary-resolver.ts` (surgical split για ≤500 γραμμές/αρχείο):
 * συγκεντρώνει τους **τρεις** geometry-derived συντελεστές σκίασης ενός κουφώματος —
 * πρόβολος `F_ov` (Slice B), πλευρικό πτερύγιο `F_fin` (Slice D), ορίζοντας `F_hor`
 * (Slice E) — + τα candidate-outline helpers των κάθετων τοίχων (fin). Κάθε resolver
 * επιστρέφει `number | undefined` (absent ⇒ fallback/×1 ⇒ zero-regression). Καμία
 * scene/store — όλα τα entities/outlines δίνονται από τον caller (`buildOpeningBoundary`).
 *
 * @see ./solar-overhang-geometry · ./solar-fin-geometry · ./solar-horizon-geometry
 * @see ./space-boundary-resolver (caller — stamp στο window boundary)
 * @see docs/centralized-systems/reference/adrs/ADR-422-bim-heating-mechanical-study.md §3 (L7.3 Slice B/D/E)
 */

import type { WallEntity } from '../../types/wall-types';
import type { OpeningEntity } from '../../types/opening-types';
import type { Point3D } from '../../types/bim-base';
import { resolveWindowOverhangFactor, type OverhangOutline } from './solar-overhang-geometry';
import { resolveWindowFinFactor } from './solar-fin-geometry';
import { resolveWindowHorizonFactor, type HorizonObstacle } from './solar-horizon-geometry';
import type { Vec2 } from './wall-footprint-match';

/**
 * Structural subset του `SpaceBoundaryContext` που χρειάζονται οι shading resolvers
 * (ο πλήρης ctx είναι assignable). Αποφεύγει circular import του `SpaceBoundaryContext`.
 */
export interface OpeningShadingContext {
  /** Τοίχοι του ίδιου ορόφου (πηγή κάθετων πτερυγίων `F_fin`). */
  readonly walls: readonly WallEntity[];
  /** Outlines οριζόντιων προβόλων πάνω από τα παράθυρα (`F_ov`, Slice B). */
  readonly overhangOutlines?: readonly OverhangOutline[];
  /** Μάζες γειτονικών κτιρίων στο ενεργό frame (`F_hor`, Slice E). */
  readonly horizonObstacleOutlines?: readonly HorizonObstacle[];
  /** METRES — απόλυτο ύψος βάσης ενεργού ορόφου (site datum, Slice E). */
  readonly apertureBaseElevationM?: number;
}

/** Μοναδιαία διεύθυνση τοίχου (start→end άξονα/εσωτ. όψης), ή `null` αν degenerate. */
function wallDirection(wall: WallEntity): Vec2 | null {
  const pts = wall.geometry?.axisPolyline?.points ?? wall.geometry?.innerEdge?.points;
  if (!pts || pts.length < 2) return null;
  const a = pts[0];
  const b = pts[pts.length - 1];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  return len < 1e-9 ? null : { x: dx / len, y: dy / len };
}

/** Footprint πολύγωνο τοίχου (inner edge + reversed outer edge) ως XY, ή `null`. */
function wallFootprintPolygon(wall: WallEntity): readonly Vec2[] | null {
  const inner = wall.geometry?.innerEdge?.points;
  const outer = wall.geometry?.outerEdge?.points;
  if (!inner || inner.length < 2 || !outer || outer.length < 2) return null;
  const poly: Vec2[] = inner.map((p) => ({ x: p.x, y: p.y }));
  for (let i = outer.length - 1; i >= 0; i--) poly.push({ x: outer[i].x, y: outer[i].y });
  return poly.length >= 3 ? poly : null;
}

/** cos(30°) — κατώφλι «κάθετου στο facade» τοίχου (~παράλληλου στον outward normal). */
const FIN_PERPENDICULAR_COS = Math.cos((30 * Math.PI) / 180);

/**
 * Footprints των **κάθετων** τοίχων/πτερυγίων δίπλα σε ένα παράθυρο (geometry-derived
 * `F_fin`, ADR-422 L7.3 Slice D): κάθε τοίχος **εκτός του host** (`hostWallId`) με
 * διεύθυνση ~παράλληλη στον outward normal `n` (`|dir·n| ≥ cos30°` ⇒ ⟂ στην όψη)
 * δίνει το footprint του ως candidate fin outline. Το αν προεξέχει πέρα από το facade
 * το κρίνει η ray-cast (recessed/flush ⇒ d=0 ⇒ absent). Same-floor (κατακόρυφα πτερύγια).
 */
function perpendicularWallOutlines(
  ctx: OpeningShadingContext,
  hostWallId: string | undefined,
  normal: Vec2,
): OverhangOutline[] {
  const outlines: OverhangOutline[] = [];
  for (const wall of ctx.walls) {
    if (wall.id === hostWallId) continue;
    const dir = wallDirection(wall);
    if (!dir) continue;
    if (Math.abs(dir.x * normal.x + dir.y * normal.y) < FIN_PERPENDICULAR_COS) continue;
    const poly = wallFootprintPolygon(wall);
    if (poly) outlines.push({ polygonXY: poly });
  }
  return outlines;
}

/**
 * Geometry-derived συντελεστής προβόλου `F_ov` ενός κουφώματος (L7.3 Slice B) — μόνο
 * παράθυρα με θέση/αζιμούθιο & διαθέσιμα overhang outlines· αλλιώς `undefined` (1.0).
 */
export function resolveOpeningOverhangFactor(
  pos: Point3D | undefined,
  azimuthDeg: number | undefined,
  isWindow: boolean,
  params: OpeningEntity['params'],
  ceilingHeightMm: number,
  sceneToM: number,
  wallThicknessMm: number,
  ctx: OpeningShadingContext,
): number | undefined {
  if (!isWindow || !pos || azimuthDeg == null || !ctx.overhangOutlines?.length) return undefined;
  return resolveWindowOverhangFactor({
    openingPos: pos,
    azimuthDeg,
    sillHeightMm: params.sillHeight,
    openingHeightMm: params.height,
    ceilingHeightMm,
    wallThicknessMm,
    sceneToM,
    outlines: ctx.overhangOutlines,
  });
}

/**
 * Geometry-derived συντελεστής πλευρικού πτερυγίου `F_fin` ενός παραθύρου (L7.3 Slice D):
 * μαζεύει τα footprints των κάθετων τοίχων (εξαιρώντας τον host) και ray-cast-άρει.
 * `undefined` για μη-παράθυρα, χωρίς θέση/αζιμούθιο, ή χωρίς ανιχνεύσιμο πτερύγιο
 * (⇒ fallback manual `finShadingLevel` Slice C ⇒ zero-regression).
 */
export function resolveOpeningFinFactor(
  op: OpeningEntity,
  pos: Point3D | undefined,
  azimuthDeg: number | undefined,
  isWindow: boolean,
  openingWidthMm: number,
  sceneToM: number,
  wallThicknessMm: number,
  ctx: OpeningShadingContext,
): number | undefined {
  if (!isWindow || !pos || azimuthDeg == null) return undefined;
  const azRad = (azimuthDeg * Math.PI) / 180;
  const normal: Vec2 = { x: Math.sin(azRad), y: Math.cos(azRad) };
  const outlines = perpendicularWallOutlines(ctx, op.params.wallId, normal);
  if (outlines.length === 0) return undefined;
  return resolveWindowFinFactor({
    openingPos: { x: pos.x, y: pos.y },
    azimuthDeg,
    openingWidthMm,
    wallThicknessMm,
    sceneToM,
    outlines,
  });
}

/**
 * Geometry-derived συντελεστής **ορίζοντα** `F_hor` ενός παραθύρου (L7.3 Slice E):
 * ray-cast προς τις μάζες γειτονικών κτιρίων (στο ενεργό frame) με αναφορά το απόλυτο
 * ύψος ανοίγματος (`apertureBaseElevationM + ποδιά + μισό ύψος`). `undefined` για
 * μη-παράθυρα, χωρίς θέση/αζιμούθιο, ή χωρίς διαθέσιμες μάζες (⇒ fallback manual
 * `horizonShadingLevel` Slice C ⇒ zero-regression).
 */
export function resolveOpeningHorizonFactor(
  pos: Point3D | undefined,
  azimuthDeg: number | undefined,
  isWindow: boolean,
  params: OpeningEntity['params'],
  sceneToM: number,
  wallThicknessMm: number,
  ctx: OpeningShadingContext,
): number | undefined {
  if (!isWindow || !pos || azimuthDeg == null || !ctx.horizonObstacleOutlines?.length) return undefined;
  const apertureElevationM =
    (ctx.apertureBaseElevationM ?? 0) + (params.sillHeight + params.height * 0.5) * 0.001;
  return resolveWindowHorizonFactor({
    openingPos: { x: pos.x, y: pos.y },
    azimuthDeg,
    wallThicknessMm,
    sceneToM,
    apertureElevationM,
    obstacles: ctx.horizonObstacleOutlines,
  });
}
