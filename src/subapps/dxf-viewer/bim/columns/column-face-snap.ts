/**
 * Column smart face-snap — pure SSoT (ADR-398 §Column smart-ghost face-snap).
 *
 * Δίνει στο **εργαλείο Κολώνα** την ίδια «έξυπνη» συμπεριφορά φαντάσματος με το δοκάρι/τοίχο
 * (ADR-508 unified linear-member framing), **πιστά προσαρμοσμένη** σε σημειακό (1-κλικ) μέλος:
 * κοντά σε παρειά υφιστάμενου **δοκαριού, τοίχου ή κολώνας**, η κολώνα «κουμπώνει» στην παρειά, γλιστράει
 * κατά μήκος της και αναπτύσσεται **εξωτερικά**· η θέση κατά μήκος (lo/mid/hi via `pickThird`)
 * επιλέγει ΑΥΤΟΜΑΤΑ ποια από τις 9 λαβές ακουμπά:
 *   · γωνία (lo/hi) → flush-corner (η απέναντι γωνία της κολώνας ≡ γωνία στόχου)
 *   · μέσον (mid)   → κεντραρισμένη στην παρειά
 *
 * **Continuous slide** (mirror του member-to-member: το ghost ακολουθεί τον — ήδη snapped —
 * cursor κατά μήκος της παρειάς) ώστε «να κολλάει οπουδήποτε». Χρωματισμός: μακριά παρειά →
 * `beam` (🟢 valid attach)· **κοντή άκρη** δοκαριού → `overlap` (🔴, mirror «extend instead»).
 * Κολώνα-στόχος → όλες οι 4 παρειές έγκυρες.
 *
 * **ADR-398 §3.9 — wall-axis CENTER snap** (mirror του §3.1b «Column→Beam axis»): πάνω σε
 * **τοίχο**, όταν ο cursor είναι πιο κοντά στον **άξονα** παρά σε παρειά (εσωτερική μισή ζώνη),
 * το ΚΕΝΤΡΟ της κολώνας κουμπώνει στον άξονα του τοίχου (anchor `center`, 🟢) — ΧΩΡΙΣ split.
 * Στην εξωτερική μισή ζώνη/άκρες πέφτει στο §3.7 flush (Revit-grade nearest-reference-wins).
 *
 * **ΕΝΑ SSoT για preview ΚΑΙ click** (preview === commit): καλείται και από τον `snap-scheduler`
 * (move/ghost) και από τον `mouse-handler-up` (click/commit) — όπως το beam
 * `resolveMemberGhostSnapFromStore`.
 *
 * Pure — zero React/DOM/store. **Reuse (μηδέν διπλότυπο):** `collectMemberSnapTargets` (στόχοι),
 * `footprintBounds`/`distanceToFootprintBounds`/`pickDominantFace` (κοινό geometry SSoT — το ΙΔΙΟ
 * που καταναλώνει και το `member-column-face-snap`), `pickThird` (zone), `MEMBER_GHOST_CAPTURE_MM`.
 * Η τελική γεωμετρία (anchor offset) εφαρμόζεται από το `computeColumnGeometry` downstream —
 * ΚΑΝΕΝΑ νέο geometry εδώ. Μονάδες: scene units.
 *
 * @see ../geometry/shared/footprint-face-frame.ts — κοινό bbox/face SSoT (column + framing)
 * @see ../framing/member-snap-targets.ts — collectMemberSnapTargets (στόχοι: κολόνες + δοκάρια)
 * @see ../framing/member-column-face-snap.ts — η αδελφή «δοκάρι→κολόνα» (ίδιο capture/zones)
 * @see ../../systems/cursor/snap-scheduler.ts — move-path consumer (ghost)
 * @see ../../systems/cursor/mouse-handler-up.ts — click-path consumer (commit ≡ ghost)
 * @see docs/centralized-systems/reference/adrs/ADR-398-column-placement-snap.md
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import type { ColumnAnchor } from '../types/column-types';
import type { ColumnGhostStatus } from '../../systems/cursor/ColumnPlacementGhostStatusStore';
import { mmToSceneUnits, type SceneUnits } from '../../utils/scene-units';
import {
  footprintBounds,
  distanceToFootprintBounds,
  pickDominantFace,
  type FootprintBounds,
  type FootprintFace,
} from '../geometry/shared/footprint-face-frame';
import { pickThird, type MemberGhostThird } from '../framing/member-face-third';
import { MEMBER_GHOST_CAPTURE_MM } from '../framing/member-column-face-snap';
import { collectMemberSnapTargets } from '../framing/member-snap-targets';
import type { LinearMemberSnapTarget, GhostFaceFrame } from '../framing/linear-member-face-snap';
import {
  projectPointOnAxis,
  projectPolygonOnAxis,
} from '../geometry/shared/polygon-axis-projection';

/** Παρειά στόχου (world-aligned) στην οποία κουμπώνει η κολώνα. */
export type ColumnFaceSide = FootprintFace;

/** Αποτέλεσμα column face-snap: πού πάει το `position` + ποια λαβή ακουμπά + το status. */
export interface ColumnFaceSnap {
  /** Σημείο όπου εδράζεται η `anchor` λαβή (scene units) — το committed click point. */
  readonly position: Point2D;
  /** Ποια από τις 9 λαβές ακουμπά την παρειά (auto από face × zone). */
  readonly anchor: ColumnAnchor;
  /** 🟢 `beam` (έγκυρο κούμπωμα) / 🔴 `overlap` (κοντή άκρη δοκαριού). */
  readonly status: ColumnGhostStatus;
  /** id στόχου (δοκάρι· `null` για κολόνα-στόχο — τα footprints δεν φέρουν id). */
  readonly targetId: string | null;
  readonly face: ColumnFaceSide;
  readonly third: MemberGhostThird;
  /**
   * ADR-508 §dim — πλαίσιο παρειάς για τις listening dimensions (ΙΔΙΟ SSoT με τοίχο/δοκάρι).
   * `ghostHalfWidth=0` → οι αποστάσεις μετρούν προς το **κέντρο** της κολώνας (Revit centerline).
   */
  readonly faceFrame: GhostFaceFrame;
}

/** Πλαίσιο άξονα τοίχου (χορδή axis[0]→axis[last]) για το §3.9 axis-center — scene units. */
interface WallAxisFrame {
  readonly a: Point2D;            // αρχή άξονα (axis[0])
  readonly u: Point2D;            // μοναδιαία διεύθυνση χορδής
  readonly alongMin: number;      // διαμήκης έκταση outline (άκρες) — relative στο `a`
  readonly alongMax: number;
  readonly halfThickness: number; // perp ημι-πάχος (max|perp| του outline)
}

/** Στόχος: world-aligned bbox + ο άξονας των κοντών άκρων (`null` = κολόνα, καμία άκρη). */
interface FaceTarget {
  readonly id: string | null;
  readonly bounds: FootprintBounds;
  /** 'x' = οριζόντιο μέλος (άκρες E/W) · 'y' = κάθετο (άκρες N/S) · null = κολόνα (όλες έγκυρες). */
  readonly endsAxis: 'x' | 'y' | null;
  /** ADR-398 §3.9 — μόνο για τοίχους: πλαίσιο άξονα για το center-on-axis (αλλιώς undefined). */
  readonly wallFrame?: WallAxisFrame | null;
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(Math.max(v, lo), hi);

/** Κυρίαρχος άξονας ενός γραμμικού μέλους → κατά μήκος ποιου κείτονται οι κοντές άκρες. */
function memberEndsAxis(m: LinearMemberSnapTarget): 'x' | 'y' {
  const a = m.axis[0];
  const b = m.axis[m.axis.length - 1];
  return Math.abs(b.x - a.x) >= Math.abs(b.y - a.y) ? 'x' : 'y';
}

/**
 * Στόχοι → ενιαία λίστα bbox-frames (reuse `footprintBounds` SSoT). `endsAxis`:
 *   · κολόνες  → `null` (όλες οι 4 παρειές έγκυρες· δεν υπάρχει «κοντή άκρη»).
 *   · δοκάρια  → άξονας μέλους → οι κοντές άκρες (Α/Δ ή Β/Ν) γίνονται 🔴 (mirror «extend instead»).
 *   · τοίχοι   → `null` (Giorgio: σε ΚΑΘΕ παρειά τοίχου, **και τις μικρές άκρες**, ΕΠΙΤΡΕΠΕΤΑΙ
 *               κολώνα → όλες πράσινες, όπως οι κολόνες-στόχοι).
 */
function buildFaceTargets(
  cols: readonly (readonly Point2D[])[],
  beams: readonly LinearMemberSnapTarget[],
  walls: readonly LinearMemberSnapTarget[],
): FaceTarget[] {
  const out: FaceTarget[] = [];
  for (const fp of cols) {
    const bounds = footprintBounds(fp);
    if (bounds) out.push({ id: null, bounds, endsAxis: null });
  }
  for (const m of beams) {
    const bounds = footprintBounds(m.outline);
    if (bounds) out.push({ id: m.id, bounds, endsAxis: memberEndsAxis(m) });
  }
  for (const m of walls) {
    const bounds = footprintBounds(m.outline);
    if (bounds) out.push({ id: m.id, bounds, endsAxis: null, wallFrame: buildWallAxisFrame(m.axis, m.outline) });
  }
  return out;
}

/**
 * ADR-398 §3.9 — frame άξονα τοίχου: χορδή `axis[0]→axis[last]` + perp ημι-πάχος (από προβολή
 * του outline στον άξονα). Reuse `projectPolygonOnAxis` SSoT — μηδέν νέο projection. `null` σε
 * εκφυλισμένο άξονα. Ευθύς τοίχος (axis 2 σημείων) → χορδή ≡ άξονας (ακριβής foot).
 */
function buildWallAxisFrame(
  axis: readonly Point2D[],
  outline: readonly Point2D[],
): WallAxisFrame | null {
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

/**
 * ADR-508 §dim — `GhostFaceFrame` για listening dimensions της κολώνας: άξονας κατά μήκος της
 * παρειάς-στόχου, `ghostHalfWidth=0` (μετράμε προς το κέντρο της κολώνας — Revit centerline).
 * Όρισμα `centerAlong` = θέση κολώνας κατά μήκος της παρειάς (από `position`).
 */
function buildColumnBboxFaceFrame(b: FootprintBounds, face: ColumnFaceSide, position: Point2D): GhostFaceFrame {
  if (face === 'N' || face === 'S') {
    const faceY = face === 'N' ? b.maxY : b.minY;
    return {
      origin: { x: b.minX, y: faceY }, axisDir: { x: 1, y: 0 }, perpDir: { x: 0, y: -1 },
      facePerp: 0, outwardSign: face === 'N' ? -1 : 1,
      faceAlongMin: 0, faceAlongMax: b.maxX - b.minX,
      ghostCenterAlong: position.x - b.minX, ghostHalfWidth: 0,
    };
  }
  const faceX = face === 'E' ? b.maxX : b.minX;
  return {
    origin: { x: faceX, y: b.minY }, axisDir: { x: 0, y: 1 }, perpDir: { x: 1, y: 0 },
    facePerp: 0, outwardSign: face === 'E' ? 1 : -1,
    faceAlongMin: 0, faceAlongMax: b.maxY - b.minY,
    ghostCenterAlong: position.y - b.minY, ghostHalfWidth: 0,
  };
}

/** Λαβή για οριζόντια παρειά (N/S, άξονας X): lo/hi → flush-γωνία, mid → κεντραρισμένη. */
function anchorForHorizontalFace(face: 'N' | 'S', third: MemberGhostThird): ColumnAnchor {
  if (face === 'N') return third === 'lo' ? 'sw' : third === 'hi' ? 'se' : 's';
  return third === 'lo' ? 'nw' : third === 'hi' ? 'ne' : 'n';
}

/** Λαβή για κάθετη παρειά (E/W, άξονας Y): lo/hi → flush-γωνία, mid → κεντραρισμένη. */
function anchorForVerticalFace(face: 'E' | 'W', third: MemberGhostThird): ColumnAnchor {
  if (face === 'E') return third === 'lo' ? 'sw' : third === 'hi' ? 'nw' : 'w';
  return third === 'lo' ? 'se' : third === 'hi' ? 'ne' : 'e';
}

/** `true` όταν η παρειά είναι κοντή άκρη δοκαριού (→ 🔴 overlap, mirror «extend instead»). */
function isShortEndFace(face: ColumnFaceSide, endsAxis: 'x' | 'y' | null): boolean {
  if (endsAxis === 'x') return face === 'E' || face === 'W';
  if (endsAxis === 'y') return face === 'N' || face === 'S';
  return false;
}

/**
 * ADR-398 §3.9 — wall-axis CENTER snap (mirror του §3.1b «Column→Beam axis»). `null` όταν ο
 * cursor είναι πιο κοντά σε **παρειά** παρά στον **άξονα** ή πέρα από τις άκρες → ο caller
 * πέφτει στο §3.7 flush (nearest-reference-wins). Reuse `projectPointOnAxis` SSoT. ΧΩΡΙΣ split.
 */
function resolveWallAxisCenter(cursor: Readonly<Point2D>, t: FaceTarget): ColumnFaceSnap | null {
  const fr = t.wallFrame;
  if (!fr) return null;
  const { along, perp } = projectPointOnAxis(cursor.x, cursor.y, fr.a.x, fr.a.y, fr.u.x, fr.u.y);
  if (along < fr.alongMin || along > fr.alongMax) return null; // πέρα από τις άκρες → flush
  if (perp > fr.halfThickness / 2) return null;                // πιο κοντά σε παρειά → flush
  const position: Point2D = { x: fr.a.x + along * fr.u.x, y: fr.a.y + along * fr.u.y };
  return {
    position,
    anchor: 'center',
    status: 'beam',
    targetId: t.id,
    face: pickDominantFace(cursor, t.bounds),
    third: 'mid',
    // §dim — center-on-axis: μετράμε κατά μήκος του άξονα τοίχου προς άκρα/κέντρο.
    faceFrame: {
      origin: fr.a, axisDir: fr.u, perpDir: { x: fr.u.y, y: -fr.u.x },
      facePerp: 0, outwardSign: 1,
      faceAlongMin: fr.alongMin, faceAlongMax: fr.alongMax,
      ghostCenterAlong: along, ghostHalfWidth: 0,
    },
  };
}

/** Χτίζει το τελικό face-snap για τον επιλεγμένο στόχο (continuous slide + auto anchor). */
function resolveForTarget(cursor: Readonly<Point2D>, t: FaceTarget): ColumnFaceSnap {
  // ADR-398 §3.9 — τοίχος: πρώτα δοκίμασε center-on-axis· εσωτερική ζώνη → κέντρο στον άξονα.
  if (t.wallFrame) {
    const axisSnap = resolveWallAxisCenter(cursor, t);
    if (axisSnap) return axisSnap;
  }
  const { minX, maxX, minY, maxY } = t.bounds;
  const face = pickDominantFace(cursor, t.bounds);
  const status: ColumnGhostStatus = isShortEndFace(face, t.endsAxis) ? 'overlap' : 'beam';
  if (face === 'N' || face === 'S') {
    const along = clamp(cursor.x, minX, maxX);
    const third = pickThird(along, minX, maxX);
    const y = face === 'N' ? maxY : minY;
    const position: Point2D = { x: along, y };
    return { position, anchor: anchorForHorizontalFace(face, third), status, targetId: t.id, face, third, faceFrame: buildColumnBboxFaceFrame(t.bounds, face, position) };
  }
  const along = clamp(cursor.y, minY, maxY);
  const third = pickThird(along, minY, maxY);
  const x = face === 'E' ? maxX : minX;
  const position: Point2D = { x, y: along };
  return { position, anchor: anchorForVerticalFace(face, third), status, targetId: t.id, face, third, faceFrame: buildColumnBboxFaceFrame(t.bounds, face, position) };
}

/**
 * Επιλέγει το column face-snap για το ghost/click. Pure. `null` όταν κανένας στόχος δεν είναι
 * εντός `MEMBER_GHOST_CAPTURE_MM` (ελεύθερη τοποθέτηση → ο caller πέφτει στο default path).
 */
export function resolveColumnFaceSnap(
  cursor: Readonly<Point2D>,
  entities: readonly Entity[],
  sceneUnits: SceneUnits,
): ColumnFaceSnap | null {
  // Στόχοι = κολόνες (πάντα) + δοκάρια + τοίχοι — μαζεμένα ΞΕΧΩΡΙΣΤΑ ώστε ο τοίχος να μην
  // κληρονομεί το beam «κοντή άκρη → 🔴» (Giorgio: όλες οι παρειές τοίχου έγκυρες). `footprints`
  // (κολόνες) είναι ίδια και στις δύο κλήσεις → παίρνουμε από τη μία (μηδέν διπλο-μέτρημα).
  const beamPass = collectMemberSnapTargets(entities, { memberKinds: ['beam'] });
  // Τοίχοι + ΑΚΜΕΣ ΠΛΑΚΑΣ (ADR-508 §slab): η κολώνα κουμπώνει στις πλευρές πλάκας όπως στις
  // παρειές τοίχου (axis-aligned ακμές → bbox face + listening dims).
  const walls = collectMemberSnapTargets(entities, { memberKinds: ['wall', 'slab'] }).memberTargets;
  const targets = buildFaceTargets(beamPass.footprints, beamPass.memberTargets, walls);
  if (targets.length === 0) return null;
  const captureScene = MEMBER_GHOST_CAPTURE_MM * mmToSceneUnits(sceneUnits);
  let best: FaceTarget | null = null;
  let bestDist = Infinity;
  for (const t of targets) {
    const d = distanceToFootprintBounds(cursor, t.bounds);
    if (d <= captureScene && d < bestDist) {
      bestDist = d;
      best = t;
    }
  }
  return best ? resolveForTarget(cursor, best) : null;
}
