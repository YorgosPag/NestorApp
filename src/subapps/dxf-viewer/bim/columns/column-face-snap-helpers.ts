/**
 * Column face-snap — pure geometry/anchor helpers (split από `column-face-snap.ts`, N.7.1 <500).
 *
 * Καθαρές βοηθητικές (zero React/DOM/store) που μοιράζονται οι resolvers του column smart face-snap
 * (ADR-398 §3.7–§3.12): member-axis frames, center-on-axis core, anchor επιλογή ανά παρειά/zone,
 * flush-edge γεωμετρία. Κρατήθηκαν σε ξεχωριστό αρχείο ώστε ο κύριος resolver να μένει <500 γραμμές.
 * Μονάδες: scene units.
 *
 * @see ./column-face-snap.ts — οι resolvers που τις καταναλώνουν
 * @see docs/centralized-systems/reference/adrs/ADR-398-column-placement-snap.md
 */

import type { Point2D } from '../../rendering/types/Types';
import type { ColumnAnchor } from '../types/column-types';
import {
  type FootprintFace,
} from '../geometry/shared/footprint-face-frame';
import { type MemberGhostThird } from '../framing/member-face-third';
import {
  type LinearMemberSnapTarget,
  type GhostFaceFrame,
} from '../framing/linear-member-face-snap';

// ADR-508 §dim — `buildColumnBboxFaceFrame` + `buildCenteredAxisFaceFrame` μετακινήθηκαν στο
// `linear-member-face-snap` (SSoT home του `GhostFaceFrame`) ώστε να τα μοιράζεται ΚΑΙ το framing
// («τοίχος/δοκάρι → κολώνα», incl. το §3.9-mirror center snap) χωρίς εξάρτηση `bim/framing →
// bim/columns`. Re-export aliases εδώ για συνέχεια των column consumers (byte-for-byte).
export { buildColumnBboxFaceFrame, buildCenteredAxisFaceFrame } from '../framing/linear-member-face-snap';
import {
  projectPointOnAxis,
  projectPolygonOnAxis,
} from '../geometry/shared/polygon-axis-projection';

/** Παρειά στόχου (world-aligned) στην οποία κουμπώνει η κολώνα. */
export type ColumnFaceSide = FootprintFace;

/** Πλαίσιο άξονα τοίχου (χορδή axis[0]→axis[last]) για το §3.9 axis-center — scene units. */
export interface MemberAxisFrame {
  readonly a: Point2D;            // αρχή άξονα (axis[0])
  readonly u: Point2D;            // μοναδιαία διεύθυνση χορδής
  readonly alongMin: number;      // διαμήκης έκταση outline (άκρες) — relative στο `a`
  readonly alongMax: number;
  readonly halfThickness: number; // perp ημι-πάχος (max|perp| του outline)
}

export const clamp = (v: number, lo: number, hi: number): number => Math.min(Math.max(v, lo), hi);

/**
 * ADR-398 §3.11 — κάθετη ζώνη (mm) center-on-axis πάνω σε **ακμή πλάκας**. Σε αντίθεση με τον τοίχο
 * (§3.9, threshold = ημι-πάχος/2), η ακμή έχει **μηδενικό πάχος** → δεν υπάρχει «εσωτερική ζώνη»·
 * σταθερή ±τιμή (Giorgio 2026-06-22): cursor εντός αυτής από τη γραμμή → κέντρο κολώνας στον άξονα.
 */
export const SLAB_EDGE_CENTER_THRESHOLD_MM = 150;

/** Όριο «axis-aligned» ακμής: κάποιο component του άξονα ~0 ⇒ οριζόντια/κάθετη (rotation 0). */
const AXIS_EPS = 1e-6;

/** `true` όταν ο άξονας είναι οριζόντιος/κάθετος (κάποιο component ~0) → καμία στρέψη. */
export function isAxisAligned(dir: Readonly<Point2D>): boolean {
  return Math.abs(dir.x) < AXIS_EPS || Math.abs(dir.y) < AXIS_EPS;
}

/**
 * ADR-398 §3.10b/§3.11 — **κοινός SSoT** γωνία ευθυγράμμισης (μοίρες, world) ώστε η κολώνα να γίνει
 * flush με τον άξονα ενός μέλους/ακμής: `0` για axis-aligned (μηδέν regression), αλλιώς `atan2`.
 * Μοιράζεται center-on-axis (wall/beam/slab) ΚΑΙ flush slab — μηδέν διπλό atan2.
 */
export function axisAlignmentRotationDeg(dir: Readonly<Point2D>): number {
  return isAxisAligned(dir) ? 0 : (Math.atan2(dir.y, dir.x) * 180) / Math.PI;
}

/**
 * ADR-398 §3.11 — **κοινός SSoT core** center-on-axis (μοιράζεται §3.9 wall-axis ΚΑΙ §3.11 slab-edge):
 * προβάλλει τον cursor στον άξονα `a + t·u`· `null` όταν είναι πέρα από τα άκρα `[alongMin,alongMax]`
 * ή κάθετα πιο μακριά από `perpThreshold` → ο caller πέφτει στο flush (nearest-reference-wins). Reuse
 * `projectPointOnAxis` SSoT (το `perp` είναι ήδη απόλυτη απόσταση). Pure (scene units).
 */
export function resolveAxisCenterFoot(
  cursor: Readonly<Point2D>,
  a: Readonly<Point2D>,
  u: Readonly<Point2D>,
  alongMin: number,
  alongMax: number,
  perpThreshold: number,
): { position: Point2D; along: number; perp: number } | null {
  const { along, perp } = projectPointOnAxis(cursor.x, cursor.y, a.x, a.y, u.x, u.y);
  if (along < alongMin || along > alongMax) return null; // πέρα από τα άκρα → flush
  if (perp > perpThreshold) return null;                 // πιο μακριά από τη ζώνη → flush
  return { position: { x: a.x + along * u.x, y: a.y + along * u.y }, along, perp };
}

/**
 * ADR-398 §3.18b — **προσανατολισμένη** απόσταση cursor → στερεό **γραμμικού μέλους** (μέσω του
 * `MemberAxisFrame`, ΟΧΙ axis-aligned bbox). Για **λοξό** τοίχο/δοκάρι το AABB είναι πολύ μεγαλύτερο
 * από το πραγματικό στερεό → `distanceToFootprintBounds` δίνει spurious `0` cursor-εντός-AABB και σκιάζει
 * το circumference-tangent (§3.19) → ο κύκλος ΔΕΝ ολισθαίνει όπως σε οριζόντιο. Η προσανατολισμένη
 * απόσταση (perp − ημι-πάχος, + along-overflow) είναι **ταυτόσημη με το AABB για axis-aligned μέλη**
 * (μηδέν regression) και σωστή για λοξά. `0` cursor-εντός του πραγματικού στερεού. Pure (scene units).
 */
export function distanceToMemberSolid(cursor: Readonly<Point2D>, fr: MemberAxisFrame): number {
  const rx = cursor.x - fr.a.x;
  const ry = cursor.y - fr.a.y;
  const along = rx * fr.u.x + ry * fr.u.y;
  const perp = Math.abs(rx * fr.u.y - ry * fr.u.x);
  const alongOut = Math.max(0, fr.alongMin - along, along - fr.alongMax);
  const perpOut = Math.max(0, perp - fr.halfThickness);
  return Math.hypot(alongOut, perpOut);
}

/** Κυρίαρχος άξονας ενός γραμμικού μέλους → κατά μήκος ποιου κείτονται οι κοντές άκρες. */
export function memberEndsAxis(m: LinearMemberSnapTarget): 'x' | 'y' {
  const a = m.axis[0];
  const b = m.axis[m.axis.length - 1];
  return Math.abs(b.x - a.x) >= Math.abs(b.y - a.y) ? 'x' : 'y';
}

/**
 * ADR-398 §3.9/§3.11 — frame κεντρικού άξονα **γραμμικού μέλους** (τοίχος Ή δοκάρι): χορδή
 * `axis[0]→axis[last]` + perp ημι-πάχος (από προβολή του outline στον άξονα). Reuse
 * `projectPolygonOnAxis` SSoT — μηδέν νέο projection. `null` σε εκφυλισμένο άξονα. Ευθύ μέλος
 * (axis 2 σημείων) → χορδή ≡ άξονας (ακριβής foot)· λοξό → χορδή (rotation από `axisAlignmentRotationDeg`).
 */
export function buildMemberAxisFrame(
  axis: readonly Point2D[],
  outline: readonly Point2D[],
): MemberAxisFrame | null {
  if (axis.length < 2) return null;
  const a = axis[0];
  const last = axis[axis.length - 1];
  const dx = last.x - a.x;
  const dy = last.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) return null;
  const u: Point2D = { x: dx / len, y: dy / len };
  const proj = projectPolygonOnAxis(outline, a.x, a.y, u.x, u.y);
  return {
    a: { x: a.x, y: a.y },
    u,
    alongMin: proj.alongMin,
    alongMax: proj.alongMax,
    halfThickness: Math.max(Math.abs(proj.perpMin), Math.abs(proj.perpMax)),
  };
}

/** Λαβή για οριζόντια παρειά (N/S, άξονας X): lo/hi → flush-γωνία, mid → κεντραρισμένη. */
export function anchorForHorizontalFace(face: 'N' | 'S', third: MemberGhostThird): ColumnAnchor {
  if (face === 'N') return third === 'lo' ? 'sw' : third === 'hi' ? 'se' : 's';
  return third === 'lo' ? 'nw' : third === 'hi' ? 'ne' : 'n';
}

/** Λαβή για κάθετη παρειά (E/W, άξονας Y): lo/hi → flush-γωνία, mid → κεντραρισμένη. */
export function anchorForVerticalFace(face: 'E' | 'W', third: MemberGhostThird): ColumnAnchor {
  if (face === 'E') return third === 'lo' ? 'sw' : third === 'hi' ? 'nw' : 'w';
  return third === 'lo' ? 'se' : third === 'hi' ? 'ne' : 'e';
}

/** `true` όταν η παρειά είναι κοντή άκρη δοκαριού (→ 🔴 overlap, mirror «extend instead»). */
export function isShortEndFace(face: ColumnFaceSide, endsAxis: 'x' | 'y' | null): boolean {
  if (endsAxis === 'x') return face === 'E' || face === 'W';
  if (endsAxis === 'y') return face === 'N' || face === 'S';
  return false;
}

/** ADR-398 §3.10/§3.11 — πλησιέστερη axis παρειά (N/S/E/W) από το faceFrame (status/metadata + axis-aligned geometry). */
export function edgeNearFace(ff: GhostFaceFrame): ColumnFaceSide {
  const horizontal = Math.abs(ff.axisDir.x) >= Math.abs(ff.axisDir.y);
  const outwardY = ff.outwardSign * ff.perpDir.y;
  const outwardX = ff.outwardSign * ff.perpDir.x;
  return horizontal ? (outwardY >= 0 ? 'N' : 'S') : (outwardX >= 0 ? 'E' : 'W');
}

/**
 * ADR-398 §3.10b — λαβή flush για ακμή πλάκας. Axis-aligned → υπάρχον N/S/E/W × third anchor (μηδέν
 * regression). ΛΟΞΗ → n/s-family (η κολώνα στρέφεται flush· anchor στην εσωτερική παρειά ανά
 * `outwardSign>0` → n-family, αλλιώς s-family· corner ανά third).
 */
export function edgeFlushAnchor(
  face: ColumnFaceSide,
  third: MemberGhostThird,
  axisAligned: boolean,
  outwardSign: number,
): ColumnAnchor {
  if (axisAligned) {
    return face === 'N' || face === 'S' ? anchorForHorizontalFace(face, third) : anchorForVerticalFace(face, third);
  }
  return outwardSign > 0
    ? (third === 'lo' ? 'nw' : third === 'hi' ? 'ne' : 'n')
    : (third === 'lo' ? 'sw' : third === 'hi' ? 'se' : 's');
}
