/**
 * ADR-398 §3.19 + §3.20 — **Circumference-tangent + quadrant-to-end alignment** κυκλικής κολόνας (pure SSoT).
 *
 * Επεκτείνει το column face-snap ώστε η ΚΥΚΛΙΚΗ κολόνα να κουμπώνει όχι μόνο με το **κέντρο** της
 * (modes #1/#2 — center-on-face / center-on-axis, ήδη στο `column-face-snap`) αλλά και με την
 * **ΠΕΡΙΦΕΡΕΙΑ** της (tangent), όπως η Revit:
 *
 *   · **§3.19 mode #4 — περιφέρεια → ΚΕΝΤΡΙΚΟΣ ΑΞΟΝΑΣ** μέλους (τοίχος/δοκάρι): ο κύκλος εφάπτεται στον άξονα.
 *   · **§3.19 mode #3 — περιφέρεια → ΠΑΡΕΙΑ/ΑΚΜΗ** (τοίχος / μη-κυκλική κολόνα / πέδιλο / πλάκα / γραμμή):
 *     ο κύκλος εφάπτεται στην παρειά, **έξω** από το μέλος.
 *   · **§3.20 quadrant-to-end alignment** (ΝΕΟ): ενώ η περιφέρεια εφάπτεται σε μια παρειά (Y κλειδωμένο),
 *     καθώς ο κύκλος γλιστράει **κατά μήκος** της, το **ακραίο τεταρτημόριο** (κέντρο ∓ R κατά τον άξονα)
 *     **κουμπώνει** στα **άκρα** (δυτικό/ανατολικό) **+ κέντρο** της παρειάς → hard snap + γραμμή-οδηγός
 *     (Revit alignment). Είναι ο κυκλικός ανάλογος του corner-lock (§3.18 `pickThird`).
 *
 * **Κεντρική ιδέα (angle-general, Revit-grade):** tangent = **offset του κέντρου κατά `R` κατά μήκος της
 * καθέτου της αναφοράς, προς την πλευρά του cursor**. Επειδή η γεωμετρία της κυκλικής κολόνας αγνοεί το
 * anchor (κέντρο πάντα στο `position` — ADR-363), επιστρέφουμε `position = offsetCenter` + `anchor:'center'`
 * → **ΜΗΔΕΝ αλλαγή στο geometry/anchor pipeline**. Το §3.20 απλώς **κουμπώνει το διαμήκες `along`** του
 * κέντρου σε `{alongMin+R, alongMax−R, μέσον}` (μικρή ζώνη έλξης) → η περιφέρεια ευθυγραμμίζεται με το άκρο.
 *
 * **Auto-candidates (Giorgio 2026-06-25):** δεν υπάρχει mode toggle — τα tangent candidates μπαίνουν
 * ΔΙΠΛΑ στα center candidates και ο υπάρχων `nearestHit` διαλέγει το πλησιέστερο. Μετρική: center
 * `dist=perp` / tangent `dist=|perp−R|`.
 *
 * **FULL SSoT — μηδέν νέα geometry primitive:** reuse `buildMemberAxisFrame` (frame άξονα),
 * `resolveLinearMemberFaceSnap` (frame παρειάς), `GhostFaceFrame` (`perpDir`/`outwardSign`/`facePerp`),
 * `buildCenteredAxisFaceFrame` (CL dims). Η γραμμή-οδηγός = κάθετο τμήμα στο άκρο/μέσον (η ίδια η παρειά
 * άκρου του τοίχου). Pure — zero React/DOM/store. Μονάδες: scene units.
 *
 * @see ./column-face-snap.ts — ο core resolver που το καλεί (gated `opts.circleRadiusScene>0`, nearest-wins)
 * @see ../placement/placement-ghost-assembly.ts — surface του `alignmentGuide` στο preview overlay
 * @see docs/centralized-systems/reference/adrs/ADR-398-column-placement-snap.md §3.19/§3.20
 */

import type { Point2D } from '../../rendering/types/Types';
import { mmToSceneUnits, type SceneUnits } from '../../utils/scene-units';
import { footprintBounds, pickDominantFace } from '../geometry/shared/footprint-face-frame';
import { MEMBER_GHOST_CAPTURE_MM, MEMBER_GHOST_LEN_MM } from '../framing/member-column-face-snap';
import {
  resolveLinearMemberFaceSnap,
  type LinearMemberSnapTarget,
} from '../framing/linear-member-face-snap';
import type { SceneSnapTargets } from '../framing/scene-snap-targets';
import {
  buildMemberAxisFrame,
  buildCenteredAxisFaceFrame,
  edgeNearFace,
} from './column-face-snap-helpers';
// Type-only (erased) — μηδέν runtime cycle με τον core resolver που μας καλεί.
import type { ColumnFaceSnap } from './column-face-snap';

/**
 * ADR-398 §3.20 — γραμμή-οδηγός ευθυγράμμισης (world segment) που εμφανίζεται όταν το τεταρτημόριο της
 * κυκλικής κολόνας κουμπώνει σε άκρο/μέσον παρειάς. Είναι κάθετη στον άξονα ολίσθησης, στο σημείο του
 * άκρου — δηλ. **η ίδια η παρειά-άκρου** του τοίχου. Ζωγραφίζεται ως dashed overlay (Revit alignment).
 */
export interface PlacementAlignmentGuide {
  readonly a: Point2D;
  readonly b: Point2D;
}

/** Hit κοινό με τους υπόλοιπους tiers του core resolver (snap + dist για nearest-wins). */
type TangentHit = { snap: ColumnFaceSnap; dist: number };

/** Screen-space ζώνη έλξης (px) για το διαμήκες snap στο άκρο/μέσον· fallback σε mm όταν λείπει zoom. */
const ALIGN_SNAP_PX = 12;
const ALIGN_SNAP_FALLBACK_MM = 60;

/**
 * Μηδενίζει τον FP θόρυβο (~1e-14) στο tangent dist ώστε στο **ιδανικό** (περιφέρεια ακριβώς πάνω στην
 * αναφορά) να ισοφαρίζει με το `distanceToFootprintBounds=0` (cursor-εντός AABB λοξού μέλους) — και, ως
 * προγενέστερος candidate στον `nearestHit`, να κερδίζει την ισοπαλία. Μακριά από το ιδανικό η σύγκριση
 * μένει ανέπαφη («bbox κερδίζει cursor-εντός», §3.18). */
const cleanDist = (d: number): number => (d < 1e-6 ? 0 : d);

/** Πλησιέστερο (μικρότερο dist) hit· `cand` νικά τον `best` μόνο γνήσια μικρότερο (σταθερή σειρά). */
function keepNearest(best: TangentHit | null, cand: TangentHit | null): TangentHit | null {
  if (!cand) return best;
  return !best || cand.dist < best.dist ? cand : best;
}

/** Ζώνη έλξης (scene units) — zoom-adaptive όταν δίνεται `wpp>0`, αλλιώς σταθερό mm fallback. */
function alignZone(wpp: number, scaleF: number): number {
  return wpp > 0 ? ALIGN_SNAP_PX * wpp : ALIGN_SNAP_FALLBACK_MM * scaleF;
}

/** Διαμήκες snap-αποτέλεσμα: το (πιθανώς κουμπωμένο) `along` του κέντρου + η along-θέση του οδηγού (`null` = free). */
interface LongSnap { readonly along: number; readonly guideAlong: number | null; }

/**
 * §3.20 — κούμπωσε το διαμήκες `alongFree` του κέντρου σε `{alongMin+R, alongMax−R, μέσον}` εντός `zone`
 * (το ακραίο τεταρτημόριο πέφτει στο άκρο της παρειάς· το κέντρο στο μέσον). Επιστρέφει + την along-θέση
 * του **οδηγού** (= άκρο/μέσον, ΟΧΙ το κέντρο) για τη γραμμή ευθυγράμμισης. `guideAlong:null` → ελεύθερο γλίστρημα.
 */
function snapAlongToEnds(
  alongFree: number, alongMin: number, alongMax: number, radius: number, zone: number,
): LongSnap {
  const cands: { c: number; g: number }[] = [];
  const lead = alongMin + radius;
  const trail = alongMax - radius;
  if (lead <= alongMax) cands.push({ c: lead, g: alongMin });   // Δ-τεταρτημόριο ↔ min-άκρο
  if (trail >= alongMin) cands.push({ c: trail, g: alongMax });  // Α-τεταρτημόριο ↔ max-άκρο
  cands.push({ c: (alongMin + alongMax) / 2, g: (alongMin + alongMax) / 2 }); // κέντρο ↔ μέσον
  let best: { c: number; g: number } | null = null;
  let bestD = zone;
  for (const k of cands) {
    const d = Math.abs(alongFree - k.c);
    if (d <= bestD) { bestD = d; best = k; }
  }
  return best ? { along: best.c, guideAlong: best.g } : { along: alongFree, guideAlong: null };
}

/** Κάθετο τμήμα μήκους `2·halfLen` με κέντρο το `(px,py)` κατά τη διεύθυνση `(perpX,perpY)` — η γραμμή-οδηγός. */
function perpGuide(px: number, py: number, perpX: number, perpY: number, halfLen: number): PlacementAlignmentGuide {
  return {
    a: { x: px - halfLen * perpX, y: py - halfLen * perpY },
    b: { x: px + halfLen * perpX, y: py + halfLen * perpY },
  };
}

/**
 * §3.19 mode #4 — **περιφέρεια → ΚΕΝΤΡΙΚΟΣ ΑΞΟΝΑΣ** ενός μέλους: ο κύκλος εφάπτεται στον άξονα. Το κέντρο
 * μετατοπίζεται κατά `R` κατά μήκος της καθέτου `perpDir=(u.y,−u.x)` **προς την πλευρά του cursor**. Το
 * διαμήκες `along` κουμπώνει στα άκρα/μέσον (§3.20) → γραμμή-οδηγός. `dist=|perp−R|`. `null` εκτός άκρων /
 * εκτός ζώνης tangent.
 */
function axisTangentForMember(
  cursor: Readonly<Point2D>, m: LinearMemberSnapTarget, radius: number, captureScene: number, zone: number,
): TangentHit | null {
  const fr = buildMemberAxisFrame(m.axis, m.outline);
  if (!fr) return null;
  const rx = cursor.x - fr.a.x;
  const ry = cursor.y - fr.a.y;
  const alongFree = rx * fr.u.x + ry * fr.u.y;
  if (alongFree < fr.alongMin || alongFree > fr.alongMax) return null;
  const signedPerp = rx * fr.u.y - ry * fr.u.x;             // (cursor−a)·perpDir
  const dist = Math.abs(Math.abs(signedPerp) - radius);
  if (dist > captureScene) return null;
  const sign = signedPerp >= 0 ? 1 : -1;                    // πλευρά cursor
  const { along, guideAlong } = snapAlongToEnds(alongFree, fr.alongMin, fr.alongMax, radius, zone);
  const center: Point2D = {
    x: fr.a.x + along * fr.u.x + sign * radius * fr.u.y,
    y: fr.a.y + along * fr.u.y - sign * radius * fr.u.x,
  };
  const bounds = footprintBounds(m.outline);
  const guide = guideAlong === null ? null : perpGuide(
    fr.a.x + guideAlong * fr.u.x, fr.a.y + guideAlong * fr.u.y, fr.u.y, -fr.u.x, fr.halfThickness + 2 * radius,
  );
  return {
    snap: {
      position: center, anchor: 'center', rotation: 0, status: 'beam', targetId: m.id,
      face: bounds ? pickDominantFace(cursor, bounds) : 'N', third: 'mid',
      faceFrame: buildCenteredAxisFaceFrame(fr.a, fr.u, { x: fr.u.y, y: -fr.u.x }, fr.alongMin, fr.alongMax, along),
      ...(guide ? { alignmentGuide: guide } : {}),
    },
    dist: cleanDist(dist),
  };
}

/** §3.19 mode #4 — το πλησιέστερο axis-tangent hit ανάμεσα σε όλα τα μέλη με κεντρικό άξονα. */
function resolveAxisTangent(
  cursor: Readonly<Point2D>, members: readonly LinearMemberSnapTarget[], radius: number, captureScene: number, zone: number,
): TangentHit | null {
  let best: TangentHit | null = null;
  for (const m of members) best = keepNearest(best, axisTangentForMember(cursor, m, radius, captureScene, zone));
  return best;
}

/**
 * §3.19 mode #3 — **περιφέρεια → ΠΑΡΕΙΑ/ΑΚΜΗ**: ο κύκλος εφάπτεται στην πλησιέστερη παρειά, **έξω** από
 * το μέλος (πλευρά cursor = `outwardSign·perpDir`). Reuse του ΙΔΙΟΥ `resolveLinearMemberFaceSnap` (zero-width
 * edges). Το διαμήκες `along` κουμπώνει στα άκρα/μέσον της παρειάς (§3.20) → γραμμή-οδηγός. `dist=||perp|−R|`.
 */
function resolveEdgeTangent(
  cursor: Readonly<Point2D>, edges: readonly LinearMemberSnapTarget[], radius: number, scaleF: number, zone: number,
): TangentHit | null {
  if (edges.length === 0) return null;
  const r = resolveLinearMemberFaceSnap(cursor, edges, {
    ghostLenScene: MEMBER_GHOST_LEN_MM * scaleF,
    captureScene: MEMBER_GHOST_CAPTURE_MM * scaleF,
    memberWidthScene: 0,
  });
  if (!r || !r.faceFrame) return null;
  const ff = r.faceFrame;
  const perpToFace = (cursor.x - ff.origin.x) * ff.perpDir.x + (cursor.y - ff.origin.y) * ff.perpDir.y - ff.facePerp;
  const dist = Math.abs(Math.abs(perpToFace) - radius);
  if (dist > MEMBER_GHOST_CAPTURE_MM * scaleF) return null;
  const { along, guideAlong } = snapAlongToEnds(ff.ghostCenterAlong, ff.faceAlongMin, ff.faceAlongMax, radius, zone);
  const faceX = ff.origin.x + along * ff.axisDir.x + ff.facePerp * ff.perpDir.x;
  const faceY = ff.origin.y + along * ff.axisDir.y + ff.facePerp * ff.perpDir.y;
  const center: Point2D = {
    x: faceX + radius * ff.outwardSign * ff.perpDir.x,
    y: faceY + radius * ff.outwardSign * ff.perpDir.y,
  };
  const guide = guideAlong === null ? null : perpGuide(
    ff.origin.x + guideAlong * ff.axisDir.x + ff.facePerp * ff.perpDir.x,
    ff.origin.y + guideAlong * ff.axisDir.y + ff.facePerp * ff.perpDir.y,
    ff.perpDir.x, ff.perpDir.y, 2 * radius,
  );
  return {
    snap: {
      position: center, anchor: 'center', rotation: 0, status: 'beam', targetId: null,
      face: edgeNearFace(ff), third: 'mid',
      faceFrame: buildCenteredAxisFaceFrame(ff.origin, ff.axisDir, ff.perpDir, ff.faceAlongMin, ff.faceAlongMax, along, ff.arc),
      ...(guide ? { alignmentGuide: guide } : {}),
    },
    dist: cleanDist(dist),
  };
}

/**
 * §3.19/§3.20 — **το πλησιέστερο circumference-tangent hit** (mode #3 ∪ #4) για κυκλικό φάντασμα ακτίνας
 * `radiusScene`. Επιστρέφεται ως επιπλέον candidate στον `nearestHit` του core resolver (additive). `wpp` =
 * worldPerPixel (zoom-adaptive ζώνη για το §3.20 end-align). `null` όταν `radiusScene<=0` ή κανένα tangent.
 */
export function resolveCircularTangentHit(
  cursor: Readonly<Point2D>,
  t: Readonly<SceneSnapTargets>,
  sceneUnits: SceneUnits,
  radiusScene: number,
  wpp: number,
): TangentHit | null {
  if (!(radiusScene > 0)) return null;
  const f = mmToSceneUnits(sceneUnits);
  const captureScene = MEMBER_GHOST_CAPTURE_MM * f;
  const zone = alignZone(wpp, f);
  const axisHit = resolveAxisTangent(cursor, [...t.wallTargets, ...t.beamTargets], radiusScene, captureScene, zone);
  const edgeHit = resolveEdgeTangent(
    cursor, [...(t.footprintEdgeTargets ?? []), ...t.slabTargets, ...t.lineTargets], radiusScene, f, zone,
  );
  return keepNearest(axisHit, edgeHit);
}
