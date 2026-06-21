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
import type { LinearMemberSnapTarget } from '../framing/linear-member-face-snap';

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
}

/** Στόχος: world-aligned bbox + ο άξονας των κοντών άκρων (`null` = κολόνα, καμία άκρη). */
interface FaceTarget {
  readonly id: string | null;
  readonly bounds: FootprintBounds;
  /** 'x' = οριζόντιο μέλος (άκρες E/W) · 'y' = κάθετο (άκρες N/S) · null = κολόνα (όλες έγκυρες). */
  readonly endsAxis: 'x' | 'y' | null;
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
    if (bounds) out.push({ id: m.id, bounds, endsAxis: null });
  }
  return out;
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

/** Χτίζει το τελικό face-snap για τον επιλεγμένο στόχο (continuous slide + auto anchor). */
function resolveForTarget(cursor: Readonly<Point2D>, t: FaceTarget): ColumnFaceSnap {
  const { minX, maxX, minY, maxY } = t.bounds;
  const face = pickDominantFace(cursor, t.bounds);
  const status: ColumnGhostStatus = isShortEndFace(face, t.endsAxis) ? 'overlap' : 'beam';
  if (face === 'N' || face === 'S') {
    const along = clamp(cursor.x, minX, maxX);
    const third = pickThird(along, minX, maxX);
    const y = face === 'N' ? maxY : minY;
    return { position: { x: along, y }, anchor: anchorForHorizontalFace(face, third), status, targetId: t.id, face, third };
  }
  const along = clamp(cursor.y, minY, maxY);
  const third = pickThird(along, minY, maxY);
  const x = face === 'E' ? maxX : minX;
  return { position: { x, y: along }, anchor: anchorForVerticalFace(face, third), status, targetId: t.id, face, third };
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
  const walls = collectMemberSnapTargets(entities, { memberKinds: ['wall'] }).memberTargets;
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
