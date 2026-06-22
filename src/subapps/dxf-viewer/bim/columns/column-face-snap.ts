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
 * **ADR-398 §3.11 — center-on-axis σε ΑΚΜΗ ΠΛΑΚΑΣ + ΔΟΚΑΡΙ** (γενίκευση του §3.9 wall): όταν ο
 * cursor είναι κάθετα κοντά στον κεντρικό άξονα, το ΚΕΝΤΡΟ της κολώνας κουμπώνει στον άξονα και
 * ολισθαίνει **κατά μήκος** (anchor `center`)· αλλιώς → flush. Ισχύει και σε **λοξά** μέλη (κέντρο +
 * στραμμένη). **Τοίχος ΚΑΙ δοκάρι** (παχιά μέλη) → `axisFrame` στο bbox path, threshold ημι-πάχος/2
 * (`resolveMemberAxisCenter`)· **ακμή πλάκας** (μηδενικό πάχος) → axis-relative path, σταθερό
 * ±`SLAB_EDGE_CENTER_THRESHOLD_MM`. Κοινός SSoT core `resolveAxisCenterFoot` +
 * `buildCenteredAxisFaceFrame` + `axisAlignmentRotationDeg` μοιράζονται και τα τρία — μηδέν διπλό math.
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
} from '../geometry/shared/footprint-face-frame';
import { pickThird, type MemberGhostThird } from '../framing/member-face-third';
import { MEMBER_GHOST_CAPTURE_MM, MEMBER_GHOST_LEN_MM } from '../framing/member-column-face-snap';
import {
  collectSceneSnapTargets,
  type SceneSnapTargets,
} from '../framing/scene-snap-targets';
import {
  resolveLinearMemberFaceSnap,
  type LinearMemberSnapTarget,
  type GhostFaceFrame,
} from '../framing/linear-member-face-snap';
import { pointOnCircle, calculateAngle } from '../../rendering/entities/shared/geometry-vector-utils';
import { resolvePolarDiskSnap, type PolarDiskSnapOptions } from './polar-disk-snap';
import {
  clamp,
  SLAB_EDGE_CENTER_THRESHOLD_MM,
  isAxisAligned,
  axisAlignmentRotationDeg,
  resolveAxisCenterFoot,
  buildCenteredAxisFaceFrame,
  memberEndsAxis,
  buildMemberAxisFrame,
  buildColumnBboxFaceFrame,
  anchorForHorizontalFace,
  anchorForVerticalFace,
  isShortEndFace,
  edgeNearFace,
  edgeFlushAnchor,
  type MemberAxisFrame,
  type ColumnFaceSide,
} from './column-face-snap-helpers';

export type { ColumnFaceSide };

/** Αποτέλεσμα column face-snap: πού πάει το `position` + ποια λαβή ακουμπά + το status. */
export interface ColumnFaceSnap {
  /** Σημείο όπου εδράζεται η `anchor` λαβή (scene units) — το committed click point. */
  readonly position: Point2D;
  /** Ποια από τις 9 λαβές ακουμπά την παρειά (auto από face × zone). */
  readonly anchor: ColumnAnchor;
  /** 🟢 `beam` (έγκυρο κούμπωμα) / 🔴 `overlap` (κοντή άκρη δοκαριού). */
  readonly status: ColumnGhostStatus;
  /**
   * ADR-398 §3.10b — γωνία (μοίρες, world) στην οποία πρέπει να στραφεί η κολώνα ώστε να
   * ευθυγραμμιστεί **flush** με την παρειά/ακμή στόχου. `0` για axis-aligned στόχους (footprint
   * bbox / οριζόντια-κάθετη ακμή — μηδέν regression)· = γωνία **λοξής** ακμής πλάκας ώστε το
   * φάντασμα να ακολουθεί τη λοξάδα (αντί να μένει πάντα ορθό).
   */
  readonly rotation: number;
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

/** Στόχος: world-aligned bbox + ο άξονας των κοντών άκρων (`null` = κολόνα, καμία άκρη). */
interface FaceTarget {
  readonly id: string | null;
  readonly bounds: FootprintBounds;
  /** 'x' = οριζόντιο μέλος (άκρες E/W) · 'y' = κάθετο (άκρες N/S) · null = κολόνα (όλες έγκυρες). */
  readonly endsAxis: 'x' | 'y' | null;
  /**
   * ADR-398 §3.9/§3.11 — πλαίσιο άξονα για το center-on-axis. Υπάρχει για **τοίχους ΚΑΙ δοκάρια**
   * (παχιά γραμμικά μέλη με κεντρικό άξονα)· `undefined` για κολόνες (καθαρό bbox). Threshold =
   * ημι-πάχος/2 (εσωτερική μισή ζώνη — ίδιο για τοίχο & δοκάρι).
   */
  readonly axisFrame?: MemberAxisFrame | null;
}

/**
 * Στόχοι → ενιαία λίστα bbox-frames (reuse `footprintBounds` SSoT). `endsAxis` + `axisFrame`:
 *   · κολόνες  → `endsAxis null`, **χωρίς** axisFrame (καθαρό bbox· όλες οι 4 παρειές έγκυρες).
 *   · δοκάρια  → `endsAxis` μέλους (κοντές άκρες Α/Δ ή Β/Ν → 🔴 «extend instead» στο flush) **+**
 *               `axisFrame` (ADR-398 §3.11: center-on-axis στον κεντρικό άξονα, ίδιο με τοίχο).
 *   · τοίχοι   → `endsAxis null` (Giorgio: ΚΑΘΕ παρειά + μικρές άκρες έγκυρες) **+** `axisFrame` (§3.9).
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
    if (bounds) out.push({ id: m.id, bounds, endsAxis: memberEndsAxis(m), axisFrame: buildMemberAxisFrame(m.axis, m.outline) });
  }
  for (const m of walls) {
    const bounds = footprintBounds(m.outline);
    if (bounds) out.push({ id: m.id, bounds, endsAxis: null, axisFrame: buildMemberAxisFrame(m.axis, m.outline) });
  }
  return out;
}

/**
 * ADR-398 §3.9/§3.11 — **member-axis CENTER snap** (τοίχος Ή δοκάρι· mirror του §3.1b «Column→Beam
 * axis»): το κέντρο της κολώνας κουμπώνει στον κεντρικό άξονα του μέλους και ολισθαίνει κατά μήκος.
 * `null` όταν ο cursor είναι πιο κοντά σε **παρειά** παρά στον **άξονα** ή πέρα από τις άκρες → ο
 * caller πέφτει στο §3.7 flush (nearest-reference-wins). Threshold = ημι-πάχος/2 (ίδιο τοίχο/δοκάρι).
 * Λοξό μέλος → η κολώνα **στρέφεται** flush (`axisAlignmentRotationDeg`). Reuse κοινός `resolveAxisCenterFoot`
 * + `buildCenteredAxisFaceFrame` SSoT. ΧΩΡΙΣ split.
 */
function resolveMemberAxisCenter(cursor: Readonly<Point2D>, t: FaceTarget): ColumnFaceSnap | null {
  const fr = t.axisFrame;
  if (!fr) return null;
  // Reuse κοινός SSoT core (§3.11) — threshold = ημι-πάχος/2 (εσωτερική μισή ζώνη μέλους).
  const foot = resolveAxisCenterFoot(cursor, fr.a, fr.u, fr.alongMin, fr.alongMax, fr.halfThickness / 2);
  if (!foot) return null;
  return {
    position: foot.position,
    anchor: 'center',
    rotation: axisAlignmentRotationDeg(fr.u), // 0 axis-aligned (μηδέν regression)· λοξό → flush στροφή
    status: 'beam',
    targetId: t.id,
    face: pickDominantFace(cursor, t.bounds),
    third: 'mid',
    // §dim — center-on-axis: μετράμε κατά μήκος του άξονα μέλους προς άκρα/κέντρο (κοινό SSoT).
    faceFrame: buildCenteredAxisFaceFrame(
      fr.a, fr.u, { x: fr.u.y, y: -fr.u.x }, fr.alongMin, fr.alongMax, foot.along,
    ),
  };
}

/** Χτίζει το τελικό face-snap για τον επιλεγμένο στόχο (continuous slide + auto anchor). */
function resolveForTarget(cursor: Readonly<Point2D>, t: FaceTarget): ColumnFaceSnap {
  // ADR-398 §3.9/§3.11 — τοίχος/δοκάρι: πρώτα δοκίμασε center-on-axis· εσωτερική ζώνη → κέντρο στον άξονα.
  if (t.axisFrame) {
    const axisSnap = resolveMemberAxisCenter(cursor, t);
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
    return { position, anchor: anchorForHorizontalFace(face, third), rotation: 0, status, targetId: t.id, face, third, faceFrame: buildColumnBboxFaceFrame(t.bounds, face, position) };
  }
  const along = clamp(cursor.y, minY, maxY);
  const third = pickThird(along, minY, maxY);
  const x = face === 'E' ? maxX : minX;
  const position: Point2D = { x, y: along };
  return { position, anchor: anchorForVerticalFace(face, third), rotation: 0, status, targetId: t.id, face, third, faceFrame: buildColumnBboxFaceFrame(t.bounds, face, position) };
}

/**
 * ADR-398 §3.11 — center-on-axis snap σε ακμή πλάκας: κέντρο κολώνας στον foot πάνω στον άξονα,
 * `anchor:'center'`, `rotation` = γωνία ακμής (0 axis-aligned / λοξή — §3.10b ευθυγράμμιση).
 * faceFrame κεντραρισμένο (`facePerp 0`, `ghostHalfWidth 0` → listening dims προς κέντρο, Revit
 * centerline· `ghostCenterAlong` = foot.along κατά μήκος του άξονα).
 */
function buildEdgeCenterSnap(
  ff: GhostFaceFrame,
  foot: { position: Point2D; along: number },
  rotation: number,
  face: ColumnFaceSide,
): ColumnFaceSnap {
  // ADR-398 §3.12 — σε κύκλο/τόξο η κολώνα κάθεται ΑΚΡΙΒΩΣ στην περιφέρεια (radial reprojection:
  // διορθώνει το chord-inset· η γωνία θέσης διατηρείται). Ευθείς στόχοι → foot.position αυτούσιο.
  const position = ff.arc
    ? pointOnCircle(ff.arc.center, ff.arc.radius, calculateAngle(ff.arc.center, foot.position))
    : foot.position;
  return {
    position,
    anchor: 'center',
    rotation,
    status: 'beam',
    targetId: null,
    face,
    third: 'mid',
    faceFrame: buildCenteredAxisFaceFrame(
      ff.origin, ff.axisDir, ff.perpDir, ff.faceAlongMin, ff.faceAlongMax, foot.along, ff.arc,
    ),
  };
}

/**
 * ADR-508 §slab / ADR-398 §3.11 — **zero-width edges** (ΑΚΜΕΣ ΠΛΑΚΑΣ + σκέτες ΓΡΑΜΜΕΣ) μέσα από τον
 * **ΙΔΙΟ axis-relative resolver** που χρησιμοποιούν τοίχος/δοκάρι (`resolveLinearMemberFaceSnap`) —
 * δουλεύει σε ΚΑΘΕ προσανατολισμό (και διαγώνιες). `memberWidthScene=0` → η κολώνα μετριέται στο
 * **κέντρο** της (Revit centerline). Ακμή πλάκας ≡ γραμμή (ίδιο zero-width band, `edgeBandTarget`).
 *
 * **§3.11 nearest-reference-wins (mirror §3.9, αλλά axis-relative):**
 *   · cursor κάθετα κοντά στον άξονα (±`SLAB_EDGE_CENTER_THRESHOLD_MM`) → **center-on-axis**: κέντρο
 *     κολώνας στον άξονα + ολίσθηση **κατά μήκος** (`anchor:'center'`)·
 *   · αλλιώς → **flush** σε μία πλευρά (§3.10b· η σημερινή συμπεριφορά, anchor face × third).
 *
 * Επιστρέφει + απόσταση για σύγκριση προτεραιότητας με το bbox path. `null` όταν καμία ακμή εντός
 * capture. Function ≤40 γραμμές (N.7.1) μέσω helpers `edgeNearFace`/`edgeFlushAnchor`/
 * `buildEdgeCenterSnap` + κοινός `resolveAxisCenterFoot`.
 */
function resolveColumnEdgeSnap(
  cursor: Readonly<Point2D>,
  edges: readonly LinearMemberSnapTarget[],
  sceneUnits: SceneUnits,
): { snap: ColumnFaceSnap; dist: number } | null {
  if (edges.length === 0) return null;
  const f = mmToSceneUnits(sceneUnits);
  const r = resolveLinearMemberFaceSnap(cursor, edges, {
    ghostLenScene: MEMBER_GHOST_LEN_MM * f,
    captureScene: MEMBER_GHOST_CAPTURE_MM * f,
    memberWidthScene: 0,
  });
  if (!r || !r.faceFrame) return null;
  const ff = r.faceFrame;
  const axisAligned = isAxisAligned(ff.axisDir);
  const rotation = axisAlignmentRotationDeg(ff.axisDir); // κοινός SSoT (μηδέν διπλό atan2)
  const face = edgeNearFace(ff);
  // §3.11 — center-on-axis (cursor κάθετα κοντά στον άξονα). Αλλιώς πέφτει στο flush παρακάτω.
  const foot = resolveAxisCenterFoot(
    cursor, ff.origin, ff.axisDir, ff.faceAlongMin, ff.faceAlongMax, SLAB_EDGE_CENTER_THRESHOLD_MM * f,
  );
  if (foot) return { snap: buildEdgeCenterSnap(ff, foot, rotation, face), dist: foot.perp };
  // §3.10b flush — η κολώνα κάθεται με μία παρειά flush στην ακμή, στην πλευρά του cursor.
  const third = pickThird(ff.ghostCenterAlong, ff.faceAlongMin, ff.faceAlongMax);
  const snap: ColumnFaceSnap = {
    position: r.start,
    anchor: edgeFlushAnchor(face, third, axisAligned, ff.outwardSign),
    rotation,
    status: r.status === 'overlap' ? 'overlap' : 'beam',
    targetId: null,
    face,
    third,
    faceFrame: ff,
  };
  return { snap, dist: Math.hypot(cursor.x - r.start.x, cursor.y - r.start.y) };
}

/**
 * ADR-398 §3.13 — **Polar Magnet**: όταν ο cursor είναι ΕΝΤΟΣ κυκλικού δίσκου, η κολώνα κουμπώνει στο
 * πολικό πλέγμα (κέντρο / δακτύλιος∩ακτίνα), `anchor:'center'`. Επιστρέφει + dist για nearest-wins με
 * edge/bbox. `null` όταν λείπει `worldPerPixel` (zoom-adaptive) ή ο cursor είναι κοντά στο χείλος
 * (→ §3.12 circumference). Reuse `resolvePolarDiskSnap` SSoT — ΜΗΔΕΝ polar math εδώ.
 */
function resolvePolarDiskHit(
  cursor: Readonly<Point2D>,
  disks: readonly { center: Point2D; radius: number }[],
  sceneUnits: SceneUnits,
  opts: Readonly<PolarDiskSnapOptions>,
): { snap: ColumnFaceSnap; dist: number } | null {
  let best: { snap: ColumnFaceSnap; dist: number } | null = null;
  for (const disk of disks) {
    const r = resolvePolarDiskSnap(cursor, disk, sceneUnits, opts);
    if (r && (!best || r.dist < best.dist)) {
      best = {
        snap: { position: r.position, anchor: 'center', status: 'beam', rotation: 0, targetId: null, face: 'N', third: 'mid', faceFrame: r.faceFrame },
        dist: r.dist,
      };
    }
  }
  return best;
}

/** Το ΠΛΗΣΙΕΣΤΕΡΟ hit (μικρότερο dist) ανάμεσα στα tiers (edge / bbox / polar) — nearest-wins. */
function nearestHit(...hits: readonly ({ snap: ColumnFaceSnap; dist: number } | null)[]): ColumnFaceSnap | null {
  let best: { snap: ColumnFaceSnap; dist: number } | null = null;
  for (const h of hits) if (h && (!best || h.dist < best.dist)) best = h;
  return best?.snap ?? null;
}

/**
 * ADR-398 §3.10 — **core** column face-snap από **pre-collected** στόχους (sync-in-preview SSoT,
 * mirror του `resolveLinearMemberFaceSnap` που καταναλώνουν τοίχος/δοκάρι). Καλείται σύγχρονα από
 * το preview ghost ΚΑΙ από το commit (ίδιοι στόχοι από το κοινό `sceneSnapTargetsStore` + ίδιος
 * cursor → preview ≡ commit). Pure. `null` όταν κανένας στόχος εντός `MEMBER_GHOST_CAPTURE_MM`.
 */
export function resolveColumnFaceSnapFromTargets(
  cursor: Readonly<Point2D>,
  t: Readonly<SceneSnapTargets>,
  sceneUnits: SceneUnits,
  opts?: Readonly<PolarDiskSnapOptions>,
): ColumnFaceSnap | null {
  // Τα zero-width edges (ΑΚΜΕΣ ΠΛΑΚΑΣ + σκέτες ΓΡΑΜΜΕΣ) πάνε ΞΕΧΩΡΙΣΤΑ μέσα από τον axis-relative
  // resolver (ίδιος με τοίχο/δοκάρι)· κολόνες/δοκάρια/τοίχοι → bbox path. Βλ. `resolveColumnEdgeSnap`.
  // Concat slab+line (ίδιο zero-width μοντέλο): η κολώνα ολισθαίνει σε γραμμή ΟΠΩΣ σε ακμή πλάκας.
  const edgeHit = resolveColumnEdgeSnap(cursor, [...t.slabTargets, ...t.lineTargets], sceneUnits);
  const targets = buildFaceTargets(t.footprints, t.beamTargets, t.wallTargets);
  const captureScene = MEMBER_GHOST_CAPTURE_MM * mmToSceneUnits(sceneUnits);
  let best: FaceTarget | null = null;
  let bestDist = Infinity;
  for (const ft of targets) {
    const d = distanceToFootprintBounds(cursor, ft.bounds);
    if (d <= captureScene && d < bestDist) {
      bestDist = d;
      best = ft;
    }
  }
  const bboxHit = best ? { snap: resolveForTarget(cursor, best), dist: bestDist } : null;
  // ADR-398 §3.13 — Polar Magnet: cursor ΕΝΤΟΣ δίσκου → πολικό πλέγμα (μόνο όταν δίνεται worldPerPixel).
  const polarHit = opts && opts.worldPerPixel > 0 && t.diskTargets.length > 0
    ? resolvePolarDiskHit(cursor, t.diskTargets, sceneUnits, opts)
    : null;
  // Προτεραιότητα: το ΠΛΗΣΙΕΣΤΕΡΟ ανάμεσα σε bbox / edge / polar (στο χείλος ο polar=null → §3.12 κερδίζει).
  return nearestHit(edgeHit, bboxHit, polarHit);
}

/**
 * Επιλέγει το column face-snap για το ghost/click. Pure. Thin wrapper που μαζεύει τους στόχους
 * από `entities` (κοινό `collectSceneSnapTargets`) και delegate-άρει στον core
 * `resolveColumnFaceSnapFromTargets` (ΕΝΑ SSoT). `null` όταν κανένας στόχος εντός capture.
 */
export function resolveColumnFaceSnap(
  cursor: Readonly<Point2D>,
  entities: readonly Entity[],
  sceneUnits: SceneUnits,
): ColumnFaceSnap | null {
  return resolveColumnFaceSnapFromTargets(cursor, collectSceneSnapTargets(entities), sceneUnits);
}
