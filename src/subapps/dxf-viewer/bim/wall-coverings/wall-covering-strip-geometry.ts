/**
 * Wall Covering — Strip Geometry SSoT (ADR-511, Slice B foundation).
 *
 * Το `WallCoveringEntity` **δεν** αποθηκεύει render polygon (αποφεύγει stale geometry όταν
 * ο host τοίχος μετακινείται). Αντ' αυτού, η ορατή «χρωματιστή λωρίδα στην παρειά»
 * υπολογίζεται **live** από τον host τοίχο + τις params. Αυτό το module είναι η ΜΙΑ πηγή
 * αυτού του υπολογισμού — το καταναλώνουν ΚΑΙ ο 2D renderer (`WallCoveringRenderer`) ΚΑΙ
 * το tool preview ΚΑΙ (μελλοντικά Slice D) ο 3D converter. Μηδέν διπλότυπη γεωμετρία.
 *
 * Γεωμετρία (ευθύς τοίχος, MVP):
 *   - Διαλέγουμε την παρειά (`innerEdge` ή `outerEdge`, `Polyline3D.points`).
 *   - Map του along-axis `[spanStartMm, spanEndMm]` σε σημεία πάνω στην παρειά (αρχή =
 *     `face[0]`, μοναδιαία διεύθυνση κατά μήκος της παρειάς).
 *   - Offset «προς τα έξω» (μακριά από τον δομικό κορμό) κατά το πάχος του assembly
 *     → λεπτό quad (όπως μπογιά/σοβάς που κάθεται ΠΑΝΩ στην παρειά).
 *
 * Pure — zero React / canvas / Firestore deps. Reuse `projectPointOnAxis` (SSoT προβολή).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-511-wall-finish-per-room.md
 * @see bim/geometry/shared/polygon-axis-projection.ts — projectPointOnAxis SSoT
 */

import type { Point2D } from '../../rendering/types/Types';
import type { WallCoveringFaceSide, WallCoveringParams } from '../types/wall-covering-types';
import { totalCoveringThicknessMm } from '../types/wall-covering-types';
import { mmScaleFor } from '../../utils/scene-units';
import type { SceneUnits } from '../../utils/scene-units';
import { clamp } from '../../utils/scalar-math';
// ADR-584 — reuse the shared 2D point-array bbox SSoT (avoid a sibling clone of the loop).
import { bboxOf } from '../geometry/member-column-cutback';

/**
 * Δομικό (structural) minimum που χρειάζεται ο υπολογισμός λωρίδας από τον host τοίχο.
 * Το ικανοποιούν ΚΑΙ το canonical `WallEntity` (tool path) ΚΑΙ ο `DxfWall` render-wrapper
 * — μία signature, μηδέν casts. Διαβάζουμε ΜΟΝΟ x/y από τα edge points.
 */
export interface WallCoveringHost {
  readonly id: string;
  readonly geometry?: {
    readonly innerEdge?: { readonly points: readonly { readonly x: number; readonly y: number }[] };
    readonly outerEdge?: { readonly points: readonly { readonly x: number; readonly y: number }[] };
    readonly axisPolyline?: { readonly points: readonly { readonly x: number; readonly y: number }[] };
  };
  readonly params?: { readonly thickness?: number };
}

/**
 * Ελάχιστο ορατό πλάτος λωρίδας (mm). Καθαρή μπογιά (0πάχος) θα ήταν αόρατη — της δίνουμε
 * ένα λεπτό band ώστε ο χρήστης να βλέπει ΠΟΥ εφαρμόστηκε το φινίρισμα.
 */
export const MIN_WALL_COVERING_STRIP_WIDTH_MM = 25;

/** Αποτέλεσμα: το ορατό quad + η γραμμή παρειάς (για grips/preview) + outward normal. */
export interface WallCoveringStrip {
  /** Τα 4 σημεία της λωρίδας (CCW): faceStart → faceEnd → faceEnd+offset → faceStart+offset. */
  readonly quad: readonly [Point2D, Point2D, Point2D, Point2D];
  /** Σημείο έναρξης πάνω στην παρειά (spanStart). */
  readonly faceStart: Point2D;
  /** Σημείο λήξης πάνω στην παρειά (spanEnd). */
  readonly faceEnd: Point2D;
  /** Μοναδιαίο «προς τα έξω» normal (μακριά από τον κορμό του τοίχου). */
  readonly outward: Point2D;
  /** Πλάτος band σε scene units (ορατό πάχος assembly, ≥ MIN). */
  readonly widthScene: number;
}

interface Vec2 {
  x: number;
  y: number;
}

function sub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

function len(v: Vec2): number {
  return Math.hypot(v.x, v.y);
}

function firstLast(points: readonly { x: number; y: number }[]): { a: Point2D; b: Point2D } | null {
  if (points.length < 2) return null;
  const a = points[0];
  const b = points[points.length - 1];
  return { a: { x: a.x, y: a.y }, b: { x: b.x, y: b.y } };
}

/**
 * Δημόσια: τα άκρα της επιλεγμένης παρειάς (inner/outer) σε world scene units. SSoT —
 * το χρησιμοποιεί ΚΑΙ ο strip υπολογισμός ΚΑΙ το room-partition (Slice C) για να προβάλει
 * δωμάτια στην παρειά. `null` όταν η γεωμετρία λείπει.
 */
export function wallCoveringFaceLine(
  wall: WallCoveringHost,
  faceSide: WallCoveringFaceSide,
): { a: Point2D; b: Point2D } | null {
  const edge = faceSide === 'outer' ? wall.geometry?.outerEdge : wall.geometry?.innerEdge;
  if (!edge) return null;
  return firstLast(edge.points);
}

/** Διαλέγει την παρειά (inner/outer) από τη γεωμετρία τοίχου. */
function faceEndpoints(wall: WallCoveringHost, faceSide: WallCoveringFaceSide): { a: Point2D; b: Point2D } | null {
  return wallCoveringFaceLine(wall, faceSide);
}

/**
 * Υπολογίζει τη λωρίδα φινιρίσματος (live) από host τοίχο + params. Επιστρέφει `null` όταν
 * η γεωμετρία τοίχου λείπει / είναι εκφυλισμένη (ο renderer απλώς δεν ζωγραφίζει).
 *
 * @param wall   ο host δομικός τοίχος (SSoT, άθικτος).
 * @param params οι params του covering (faceSide / span / layers).
 */
export function computeWallCoveringStrip(
  wall: WallCoveringHost,
  params: Pick<WallCoveringParams, 'faceSide' | 'spanStartMm' | 'spanEndMm' | 'layers' | 'sceneUnits'>,
): WallCoveringStrip | null {
  const face = faceEndpoints(wall, params.faceSide);
  if (!face) return null;

  const faceVec = sub(face.b, face.a);
  const faceLen = len(faceVec);
  if (faceLen < 1e-6) return null;

  const u: Vec2 = { x: faceVec.x / faceLen, y: faceVec.y / faceLen };

  // mm → scene units (1 για 'mm' σκηνές).
  const sceneUnits: SceneUnits = params.sceneUnits ?? 'mm';
  const mmToScene = mmScaleFor({ sceneUnits });

  // span [mm] → scene distance, clamped στο μήκος της παρειάς.
  const s0 = clamp(params.spanStartMm * mmToScene, 0, faceLen);
  const s1 = clamp(params.spanEndMm * mmToScene, 0, faceLen);
  const lo = Math.min(s0, s1);
  const hi = Math.max(s0, s1);

  const faceStart: Point2D = { x: face.a.x + u.x * lo, y: face.a.y + u.y * lo };
  const faceEnd: Point2D = { x: face.a.x + u.x * hi, y: face.a.y + u.y * hi };

  // Outward normal = κάθετο στην παρειά, με φορά ΜΑΚΡΙΑ από τον άξονα του τοίχου (ο κορμός
  // βρίσκεται στην πλευρά του άξονα). Χρησιμοποιούμε το αριστερό normal και διαλέγουμε
  // πρόσημο ώστε να δείχνει αντίθετα από τον άξονα.
  const left: Vec2 = { x: -u.y, y: u.x };
  const outward = orientOutward(wall, face.a, left);

  const widthScene = Math.max(
    totalCoveringThicknessMm(params.layers),
    MIN_WALL_COVERING_STRIP_WIDTH_MM,
  ) * mmToScene;

  const offX = outward.x * widthScene;
  const offY = outward.y * widthScene;

  const quad: [Point2D, Point2D, Point2D, Point2D] = [
    faceStart,
    faceEnd,
    { x: faceEnd.x + offX, y: faceEnd.y + offY },
    { x: faceStart.x + offX, y: faceStart.y + offY },
  ];

  return { quad, faceStart, faceEnd, outward, widthScene };
}

/**
 * Επιστρέφει το `left` normal με σωστή φορά «προς τα έξω»: μακριά από τον άξονα του τοίχου.
 * Αν δεν υπάρχει axisPolyline, επιστρέφει το `left` ως έχει (η παρειά είναι ήδη offset).
 */
function orientOutward(wall: WallCoveringHost, faceAnchor: Point2D, left: Vec2): Point2D {
  const axisPts = wall.geometry?.axisPolyline?.points;
  if (!axisPts || axisPts.length === 0) return left;
  const axis0 = axisPts[0];
  // Διάνυσμα από άξονα → παρειά. Αν δείχνει στην ίδια φορά με `left`, το `left` είναι έξω.
  const toFace = { x: faceAnchor.x - axis0.x, y: faceAnchor.y - axis0.y };
  const dot = toFace.x * left.x + toFace.y * left.y;
  if (dot < 0) return { x: -left.x, y: -left.y };
  return left;
}

// ─── Cacheable render geometry (selection / hit-test) ─────────────────────────

/** 2D bbox (z=0) από τα 4 σημεία της λωρίδας. */
function stripBounds(quad: WallCoveringStrip['quad']): {
  readonly min: { x: number; y: number; z: number };
  readonly max: { x: number; y: number; z: number };
} {
  const b = bboxOf(quad);
  return { min: { x: b.minX, y: b.minY, z: 0 }, max: { x: b.maxX, y: b.maxY, z: 0 } };
}

/** Cacheable render bits (outline + bbox) από host τοίχο + params. SSoT — completion + command. */
export interface WallCoveringRenderGeometry {
  readonly outline?: readonly { readonly x: number; readonly y: number; readonly z: number }[];
  readonly bbox?: {
    readonly min: { x: number; y: number; z: number };
    readonly max: { x: number; y: number; z: number };
  };
}

/**
 * Υπολογίζει τα cacheable render bits (strip outline + bbox) από τον host τοίχο. Επιστρέφει
 * `{}` όταν ο host λείπει/είναι εκφυλισμένος (selection πέφτει σε no-target — ο live render
 * παραμένει σωστός). Καταναλώνεται από `wall-covering-completion` (build) +
 * `UpdateWallCoveringParamsCommand` (edit), ώστε selection/hit-test να μην χρειάζονται walls.
 */
export function computeWallCoveringRenderGeometry(
  wall: WallCoveringHost,
  params: Pick<WallCoveringParams, 'faceSide' | 'spanStartMm' | 'spanEndMm' | 'layers' | 'sceneUnits'>,
): WallCoveringRenderGeometry {
  const strip = computeWallCoveringStrip(wall, params);
  if (!strip) return {};
  const bbox = stripBounds(strip.quad);
  const outline = strip.quad.map((p) => ({ x: p.x, y: p.y, z: 0 }));
  return { outline, bbox };
}
