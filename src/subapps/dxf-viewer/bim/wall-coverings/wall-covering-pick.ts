/**
 * Wall Covering — Wall/Face Picking SSoT (ADR-511, Slice B foundation).
 *
 * Δοθέντος ενός world-point (κλικ ή cursor) + της λίστας τοίχων, βρίσκει ΠΟΙΟΝ τοίχο
 * αφορά, ΠΟΙΑ παρειά (inner/outer) και τη διαμήκη θέση `alongMm` πάνω στον άξονα. Είναι η
 * ΜΙΑ πηγή αυτής της απόφασης — το καταναλώνουν ΚΑΙ το manual tool (Slice B) ΚΑΙ το
 * room-fill (Slice C επιλέγει τοίχο+πλευρά πριν κατατμήσει σε δωμάτια). Μηδέν διπλότυπο.
 *
 * Reuse `projectPointOnAxis` (διαμήκης/κάθετη προβολή SSoT). Pure.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-511-wall-finish-per-room.md
 * @see bim/geometry/shared/polygon-axis-projection.ts
 */

import type { Point2D } from '../../rendering/types/Types';
import type { WallCoveringFaceSide } from '../types/wall-covering-types';
import type { WallCoveringHost } from './wall-covering-strip-geometry';
import { projectPointOnAxis } from '../geometry/shared/polygon-axis-projection';
import { mmScaleFor } from '../../utils/scene-units';
import type { SceneUnits } from '../../utils/scene-units';

/** Αποτέλεσμα picking. Γενικό πάνω στον host τύπο (WallEntity ή DxfWall — ίδιο επιστρέφεται). */
export interface WallFacePick<T extends WallCoveringHost = WallCoveringHost> {
  readonly wall: T;
  readonly faceSide: WallCoveringFaceSide;
  /** Διαμήκης θέση πάνω στον άξονα, σε mm [0..L]. */
  readonly alongMm: number;
  /** Μήκος άξονα του τοίχου σε mm (για clamp span). */
  readonly axisLengthMm: number;
  /** Κάθετη απόσταση κλικ↔άξονα (scene units) — επιλογή πλησιέστερου τοίχου. */
  readonly perpScene: number;
}

export interface PickWallFaceOptions {
  /**
   * Μέγιστη κάθετη απόσταση (scene units) από την παρειά για να «πιαστεί» ο τοίχος.
   * Πέρα από thickness/2, δίνει περιθώριο κλικ. Default 400 (≈ μισός τοίχος + slack).
   */
  readonly toleranceScene?: number;
  /** Scene units (default 'mm'). */
  readonly sceneUnits?: SceneUnits;
}

const DEFAULT_TOLERANCE_SCENE = 400;

interface Vec2 {
  x: number;
  y: number;
}

function axisFrame(wall: WallCoveringHost): { a: Point2D; u: Vec2; lengthScene: number } | null {
  const pts = wall.geometry?.axisPolyline?.points;
  if (!pts || pts.length < 2) return null;
  const a = pts[0];
  const b = pts[pts.length - 1];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthScene = Math.hypot(dx, dy);
  if (lengthScene < 1e-6) return null;
  return { a: { x: a.x, y: a.y }, u: { x: dx / lengthScene, y: dy / lengthScene }, lengthScene };
}

/** Πρόσημο της κάθετης προβολής της `outerEdge[0]` ως προς τον άξονα (ποια πλευρά = «outer»). */
function outerPerpSign(wall: WallCoveringHost, a: Point2D, u: Vec2): number {
  const outer = wall.geometry?.outerEdge?.points?.[0];
  if (!outer) return 1;
  const signed = (outer.x - a.x) * u.y - (outer.y - a.y) * u.x;
  return signed >= 0 ? 1 : -1;
}

/** Half-thickness του τοίχου σε scene units (για το κατώφλι «μέσα στον τοίχο»). */
function halfThicknessScene(wall: WallCoveringHost, sceneUnits: SceneUnits): number {
  const inner = wall.geometry?.innerEdge?.points?.[0];
  const outer = wall.geometry?.outerEdge?.points?.[0];
  if (inner && outer) {
    return Math.hypot(outer.x - inner.x, outer.y - inner.y) / 2;
  }
  // Fallback: από params thickness (mm) → scene.
  const thicknessMm = wall.params?.thickness;
  if (typeof thicknessMm === 'number') return (thicknessMm * mmScaleFor({ sceneUnits })) / 2;
  return 0;
}

/**
 * Βρίσκει τον πλησιέστερο τοίχο + παρειά + διαμήκη θέση για ένα world-point. Επιστρέφει
 * `null` αν κανένας τοίχος δεν είναι αρκετά κοντά (εντός tolerance και εντός του διαμήκους
 * εύρους του άξονα).
 */
export function pickWallFaceFromPoint<T extends WallCoveringHost>(
  point: Readonly<Point2D>,
  walls: readonly T[],
  options: PickWallFaceOptions = {},
): WallFacePick<T> | null {
  const tolerance = options.toleranceScene ?? DEFAULT_TOLERANCE_SCENE;
  const sceneUnits = options.sceneUnits ?? 'mm';
  const mmToScene = mmScaleFor({ sceneUnits });

  let best: WallFacePick<T> | null = null;

  for (const wall of walls) {
    const frame = axisFrame(wall);
    if (!frame) continue;

    const proj = projectPointOnAxis(point.x, point.y, frame.a.x, frame.a.y, frame.u.x, frame.u.y);
    // Εκτός διαμήκους εύρους (με μικρό slack) → δεν αφορά αυτόν τον τοίχο.
    if (proj.along < -tolerance || proj.along > frame.lengthScene + tolerance) continue;

    const reach = halfThicknessScene(wall, sceneUnits) + tolerance;
    if (proj.perp > reach) continue;

    if (best && proj.perp >= best.perpScene) continue;

    const signed = (point.x - frame.a.x) * frame.u.y - (point.y - frame.a.y) * frame.u.x;
    const clickSign = signed >= 0 ? 1 : -1;
    const faceSide: WallCoveringFaceSide = clickSign === outerPerpSign(wall, frame.a, frame.u) ? 'outer' : 'inner';

    const alongScene = Math.max(0, Math.min(proj.along, frame.lengthScene));
    best = {
      wall,
      faceSide,
      alongMm: alongScene / mmToScene,
      axisLengthMm: frame.lengthScene / mmToScene,
      perpScene: proj.perp,
    };
  }

  return best;
}
