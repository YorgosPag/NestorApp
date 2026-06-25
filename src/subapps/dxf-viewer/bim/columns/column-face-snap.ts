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
import { MEMBER_GHOST_CAPTURE_MM } from '../framing/member-column-face-snap';
import {
  collectSceneSnapTargets,
  type SceneSnapTargets,
} from '../framing/scene-snap-targets';
import {
  type LinearMemberSnapTarget,
  type GhostFaceFrame,
} from '../framing/linear-member-face-snap';
import type { PolarDiskSnapOptions } from './polar-disk-snap';
import { resolveCircularTangentHit, resolveQuadrantEndAlignment, type PlacementAlignmentGuide } from './column-tangent-snap';
import { resolvePolarDiskHit, resolveRectHit } from './column-magnet-snap';
import {
  resolveColumnHeadReferenceSnap,
  type HeadReferenceLines,
} from './column-reference-lines';
import { resolveColumnBeamCornerSnap, type LCornerSizing } from './column-beam-corner-snap';
// N.7.1 file-size split — zero-width edge resolvers (slab/line + footprint ακμές).
import { resolveColumnEdgeSnap, resolveFootprintEdgeSnap } from './column-face-snap-edges';
import {
  clamp,
  axisAlignmentRotationDeg,
  resolveAxisCenterFoot,
  buildCenteredAxisFaceFrame,
  memberEndsAxis,
  buildMemberAxisFrame,
  distanceToMemberSolid,
  buildColumnBboxFaceFrame,
  anchorForHorizontalFace,
  anchorForVerticalFace,
  isShortEndFace,
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
  /**
   * ADR-398 §3.20/§3.20d — γραμμή(ές)-οδηγός ευθυγράμμισης (world segments) όταν το **τεταρτημόριο**
   * κυκλικής κολόνας κουμπώνει σε άκρο/μέσον παρειάς (τοίχος/γραμμή/πολυγραμμή/ακμή πλάκας) ή σε **πλευρά
   * ορθογωνίου**. Ένας οδηγός στους γραμμικούς στόχους· **έως δύο** στη **γωνία ορθογωνίου** (§3.20d:
   * u-edge + v-edge κουμπώνουν ταυτόχρονα). `undefined` σε όλα τα άλλα snaps (preview-only overlay).
   */
  readonly alignmentGuide?: PlacementAlignmentGuide | readonly PlacementAlignmentGuide[] | null;
  /**
   * ADR-525 — auto-διαστασιολόγηση L-κολόνας ώστε τα σκέλη της να γεμίζουν το γωνιακό κενό μεταξύ δύο
   * κάθετων δοκαριών (width/depth/armWidth/armLength σε mm + flipY). Παρόν ΜΟΝΟ στο `lCornerHit`· ο
   * caller (preview/commit) το εφαρμόζει ως one-shot override (`autoSized:false`). `undefined`/`null`
   * σε όλα τα άλλα snaps → η κολώνα κρατά τις διαστάσεις του ribbon (μηδέν regression).
   */
  readonly sizing?: LCornerSizing | null;
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
 *   · ΚΥΚΛΙΚΕΣ κολόνες (§3.18) → `endsAxis null`, **χωρίς** axisFrame (καθαρό bbox· 4 παρειές έγκυρες).
 *     Οι ΜΗ-κυκλικές δεν φτάνουν εδώ — πάνε `resolveFootprintEdgeSnap` (slant-following).
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

/** ADR-398 §3.20c — opts κυκλικού ghost για quadrant-to-end alignment στο center-on-axis (radius + zoom). */
export interface CircleGhostOpts {
  readonly radius: number;
  readonly wpp: number;
  readonly scaleF: number;
}

/**
 * ADR-398 §3.9/§3.11 — **member-axis CENTER snap** (τοίχος Ή δοκάρι· mirror του §3.1b «Column→Beam
 * axis»): το κέντρο της κολώνας κουμπώνει στον κεντρικό άξονα του μέλους και ολισθαίνει κατά μήκος.
 * `null` όταν ο cursor είναι πιο κοντά σε **παρειά** παρά στον **άξονα** ή πέρα από τις άκρες → ο
 * caller πέφτει στο §3.7 flush (nearest-reference-wins). Threshold = ημι-πάχος/2 (ίδιο τοίχο/δοκάρι).
 * Λοξό μέλος → η κολώνα **στρέφεται** flush (`axisAlignmentRotationDeg`). Reuse κοινός `resolveAxisCenterFoot`
 * + `buildCenteredAxisFaceFrame` SSoT. ΧΩΡΙΣ split.
 */
function resolveMemberAxisCenter(cursor: Readonly<Point2D>, t: FaceTarget, circle?: CircleGhostOpts | null): ColumnFaceSnap | null {
  const fr = t.axisFrame;
  if (!fr) return null;
  // Reuse κοινός SSoT core (§3.11) — threshold = ημι-πάχος/2 (εσωτερική μισή ζώνη μέλους).
  const foot = resolveAxisCenterFoot(cursor, fr.a, fr.u, fr.alongMin, fr.alongMax, fr.halfThickness / 2);
  if (!foot) return null;
  // ADR-398 §3.20c — κυκλικό ghost: quadrant-to-end alignment + γραμμή-οδηγός ΚΑΙ στο center-on-axis (όταν
  // το κέντρο είναι ΜΕΣΑ στο σώμα του τοίχου, το αν./δυτ. τεταρτημόριο κουμπώνει στο άκρο). Reuse §3.20 SSoT.
  const align = circle
    ? resolveQuadrantEndAlignment(foot.along, fr.alongMin, fr.alongMax, circle.radius, fr.a, fr.u, fr.halfThickness, circle.wpp, circle.scaleF)
    : null;
  const along = align ? align.along : foot.along;
  const position: Point2D = align ? { x: fr.a.x + along * fr.u.x, y: fr.a.y + along * fr.u.y } : foot.position;
  return {
    position,
    anchor: 'center',
    rotation: axisAlignmentRotationDeg(fr.u), // 0 axis-aligned (μηδέν regression)· λοξό → flush στροφή
    status: 'beam',
    targetId: t.id,
    face: pickDominantFace(cursor, t.bounds),
    third: 'mid',
    ...(align?.guide ? { alignmentGuide: align.guide } : {}),
    // §dim — center-on-axis: μετράμε κατά μήκος του άξονα μέλους προς άκρα/κέντρο (κοινό SSoT).
    faceFrame: buildCenteredAxisFaceFrame(
      fr.a, fr.u, { x: fr.u.y, y: -fr.u.x }, fr.alongMin, fr.alongMax, along,
    ),
  };
}

/** Χτίζει το τελικό face-snap για τον επιλεγμένο στόχο (continuous slide + auto anchor). */
function resolveForTarget(cursor: Readonly<Point2D>, t: FaceTarget, circle?: CircleGhostOpts | null): ColumnFaceSnap {
  // ADR-398 §3.9/§3.11 — τοίχος/δοκάρι: πρώτα δοκίμασε center-on-axis· εσωτερική ζώνη → κέντρο στον άξονα.
  if (t.axisFrame) {
    const axisSnap = resolveMemberAxisCenter(cursor, t, circle);
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

/** Το ΠΛΗΣΙΕΣΤΕΡΟ hit (μικρότερο dist) ανάμεσα στα tiers (edge / bbox / polar / rect) — nearest-wins. */
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
  columnHead?: Readonly<HeadReferenceLines> | null,
  lShapeGhost?: boolean,
): ColumnFaceSnap | null {
  // ADR-525 — L-κολόνα: όταν το ghost είναι «Σχήμα Γ» και υπάρχουν ≥2 ΚΑΘΕΤΑ δοκάρια που σχηματίζουν
  // γωνιακό κενό κοντά στον cursor, η L αυτο-τοποθετείται+διαστασιολογείται ώστε η κορυφή της να πέσει
  // στην τομή των εξωτερικών-παρειών-προεκτάσεων και τα σκέλη της να ενωθούν flush με τα άκρα των δοκαριών.
  // Gated `lShapeGhost` → ο tier αδρανής για κάθε άλλο kind (μηδέν regression). Priority ΠΡΩΤΟ (auto-junction).
  const lCornerHit = (() => {
    if (!lShapeGhost) return null;
    const r = resolveColumnBeamCornerSnap(cursor, t.beamTargets, sceneUnits);
    if (!r) return null;
    const snap: ColumnFaceSnap = {
      position: r.position, anchor: 'center', status: 'beam', rotation: r.rotation,
      targetId: null, face: 'N', third: 'mid', faceFrame: r.faceFrame,
      alignmentGuide: r.guides, sizing: r.sizing,
    };
    return { snap, dist: r.dist };
  })();
  // ADR-523 — Τ-κολόνα: η κεφαλή (flange) κουμπώνει Revit-style με ΤΡΕΙΣ reference lines στις τρεις του
  // τοίχου (nearest-wins κάθετα + ολίσθηση κατά μήκος). Όταν υπάρχει `columnHead`, οι ΤΟΙΧΟΙ φεύγουν από
  // το bbox center-on-axis (παρακάτω) και πάνε εδώ (priority + μηδέν διπλό handling)· το flush περιμετρικά
  // μένει μέσω `footprintEdgeHit`. `null` head (μη-Τ ghost) → tier αδρανής, μηδέν regression.
  const headRefHit = (() => {
    if (!columnHead) return null;
    const r = resolveColumnHeadReferenceSnap(cursor, t.wallTargets, columnHead, sceneUnits);
    if (!r) return null;
    const snap: ColumnFaceSnap = {
      position: r.position, anchor: 'center', status: 'beam', rotation: r.rotation,
      targetId: null, face: 'N', third: 'mid', faceFrame: r.faceFrame,
    };
    return { snap, dist: r.dist };
  })();
  const scaleF = mmToSceneUnits(sceneUnits);
  // ADR-398 §3.20c/d — κυκλικό ghost → quadrant-to-end alignment + οδηγός ΚΑΙ στο center-on-axis (κέντρο
  // μέσα στο σώμα τοίχου / πάνω σε γραμμή/ακμή πλάκας / πλευρά ορθογωνίου). Gated `circleRadiusScene>0`.
  const circleOpts: CircleGhostOpts | null = opts?.circleRadiusScene
    ? { radius: opts.circleRadiusScene, wpp: opts.worldPerPixel ?? 0, scaleF }
    : null;
  // Τα zero-width edges (ΑΚΜΕΣ ΠΛΑΚΑΣ + σκέτες ΓΡΑΜΜΕΣ) πάνε ΞΕΧΩΡΙΣΤΑ μέσα από τον axis-relative
  // resolver (ίδιος με τοίχο/δοκάρι). slab+line edges → center-on-axis/flush (ίδιο zero-width μοντέλο,
  // ακμή πλάκας ≡ γραμμή). Κυκλικό ghost → §3.20d quadrant-to-end οδηγός. Βλ. `resolveColumnEdgeSnap`.
  const edgeHit = resolveColumnEdgeSnap(cursor, [...t.slabTargets, ...t.lineTargets], sceneUnits, circleOpts);
  // ADR-514 Φ6d / ADR-398 §3.18 — υφιστάμενα ΠΕΔΙΛΑ + ΜΗ-ΚΥΚΛΙΚΕΣ ΚΟΛΟΝΕΣ + ΤΟΙΧΟΙ → ΞΕΧΩΡΙΣΤΟ footprint
  // edge face-snap: flush-beside + γωνία-με-γωνία + slant-following (ΟΧΙ center-on-axis straddle). Έτσι το
  // φάντασμα ακολουθεί τις πραγματικές (λοξές/πολυγωνικές) παρειές. `?? []` για partial test objects.
  const footprintEdgeHit = resolveFootprintEdgeSnap(cursor, t.footprintEdgeTargets ?? [], sceneUnits);
  // ΜΟΝΟ ΚΥΚΛΙΚΕΣ κολόνες στο bbox path (§3.18 — χωρίς λοξές παρειές)· δοκάρια/τοίχοι → bbox center-on-axis
  // (ο τοίχος ΚΑΙ στο footprintEdgeHit: bbox κερδίζει cursor-εντός, edge ακολουθεί λοξάδα cursor-εκτός).
  // ADR-523 — όταν ο ghost είναι Τ (head refs), οι τοίχοι χειρίζονται ΑΠΟΚΛΕΙΣΤΙΚΑ από το `headRefHit`
  // (multi-reference) → εκτός bbox center-on-axis ώστε να μην ανταγωνίζονται δύο μηχανισμοί στον ίδιο τοίχο.
  const bboxWalls = columnHead ? [] : t.wallTargets;
  const targets = buildFaceTargets(t.circularFootprints ?? [], t.beamTargets, bboxWalls);
  const captureScene = MEMBER_GHOST_CAPTURE_MM * scaleF;
  let best: FaceTarget | null = null;
  let bestDist = Infinity;
  for (const ft of targets) {
    // ADR-398 §3.18b — γραμμικά μέλη (axisFrame): ΠΡΟΣΑΝΑΤΟΛΙΣΜΕΝΗ απόσταση στο στερεό (όχι axis-aligned
    // bbox) ώστε το λοξό μέλος να μη δίνει spurious `0` cursor-εντός-AABB και σκιάζει το tangent (§3.19) →
    // ο κύκλος ολισθαίνει σε λοξό όπως σε οριζόντιο. Axis-aligned: ταυτόσημο με AABB (μηδέν regression).
    const d = ft.axisFrame ? distanceToMemberSolid(cursor, ft.axisFrame) : distanceToFootprintBounds(cursor, ft.bounds);
    if (d <= captureScene && d < bestDist) {
      bestDist = d;
      best = ft;
    }
  }
  const bboxHit = best ? { snap: resolveForTarget(cursor, best, circleOpts), dist: bestDist } : null;
  // ADR-398 §3.13 — Polar Magnet: cursor ΕΝΤΟΣ δίσκου → πολικό πλέγμα (μόνο όταν δίνεται worldPerPixel).
  const polarHit = opts && opts.worldPerPixel > 0 && t.diskTargets.length > 0
    ? resolvePolarDiskHit(cursor, t.diskTargets, sceneUnits, opts)
    : null;
  // ADR-398 §3.15 — Cartesian Magnet: cursor ΕΝΤΟΣ ορθογωνίου → καρτεσιανό πλέγμα (μόνο όταν worldPerPixel).
  const rectHit = opts && opts.worldPerPixel > 0 && t.rectTargets.length > 0
    ? resolveRectHit(cursor, t.rectTargets, sceneUnits, opts)
    : null;
  // ADR-398 §3.19 — circumference-tangent (ΜΟΝΟ κυκλικό φάντασμα: `circleRadiusScene>0`): η περιφέρεια
  // εφάπτεται σε άξονα/παρειά (mode #3/#4) ως επιπλέον candidate. Gated → rect/polygon/πέδιλο αμετάβλητα.
  const tangentHit = opts && opts.circleRadiusScene
    ? resolveCircularTangentHit(cursor, t, sceneUnits, opts.circleRadiusScene, opts.worldPerPixel ?? 0)
    : null;
  // Προτεραιότητα: το ΠΛΗΣΙΕΣΤΕΡΟ (nearest-wins). Το `tangentHit` μπαίνει **ΠΡΙΝ** το `bboxHit`: για
  // ΛΟΞΑ μέλη το AABB είναι μεγαλύτερο από το στερεό → ο `bboxHit` δίνει spurious `dist=0` cursor-εντός·
  // σε ισοπαλία (tangent στο ιδανικό = dist 0) θέλουμε να κερδίζει το tangent. Χάνει όμως από γνήσιο
  // μικρότερο edge/center dist (flush/center-on-axis), οπότε μηδέν regression στα center modes.
  // ADR-398 §3.20d — `rectHit` ΠΡΙΝ το `tangentHit`: ένα ορθογώνιο παράγει ΚΑΙ `lineTargets` (4 ακμές) →
  // ο tangent θα κούμπωνε στην πλησιέστερη ΜΙΑ ακμή (dist 0) και θα προ-κατελάμβανε τον Cartesian Magnet
  // στη ΓΩΝΙΑ (όπου θέλουμε 2 οδηγούς u+v). Ο μαγνήτης «cursor ΕΝΤΟΣ ορθογωνίου» κερδίζει την εφαπτομένη
  // στο ΙΔΙΟ του το όριο (Revit-grade «inside-shape»). Ο rect είναι null κοντά στο χείλος → εκεί tangent.
  // `headRefHit` ΠΡΩΤΟ: ισοπαλία dist → η Τ multi-reference (κεφαλή↔τοίχος) κερδίζει (Revit alignment refs).
  // ADR-525 — `lCornerHit` ΠΡΩΤΙΣΤΟ: η L auto-junction (κορυφή σε τομή εξωτ. παρειών + auto-size) είναι
  // ρητή πρόθεση τοποθέτησης· σε ισοπαλία/εγγύτητα στο κενό κερδίζει κάθε ανταγωνιστικό beam-face hit.
  return nearestHit(lCornerHit, headRefHit, edgeHit, footprintEdgeHit, rectHit, tangentHit, bboxHit, polarHit);
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
