/**
 * ADR-398 §3.19 — **Circumference-tangent** κυκλικής κολόνας (pure SSoT).
 *
 * Επεκτείνει το column face-snap ώστε η ΚΥΚΛΙΚΗ κολόνα να κουμπώνει όχι μόνο με το **κέντρο** της
 * (modes #1/#2 — center-on-face / center-on-axis, ήδη υπάρχουν στο `column-face-snap`) αλλά και με
 * την **ΠΕΡΙΦΕΡΕΙΑ** της (tangent), όπως η Revit:
 *
 *   · **mode #4 — περιφέρεια → ΚΕΝΤΡΙΚΟΣ ΑΞΟΝΑΣ** μέλους (τοίχος/δοκάρι): ο κύκλος εφάπτεται στον άξονα.
 *   · **mode #3 — περιφέρεια → ΠΑΡΕΙΑ/ΑΚΜΗ** (τοίχος / μη-κυκλική κολόνα / πέδιλο / πλάκα / γραμμή):
 *     ο κύκλος εφάπτεται στην παρειά, **έξω** από το μέλος.
 *
 * **Κεντρική ιδέα (angle-general, Revit-grade):** tangent = **offset του κέντρου κατά `R` κατά μήκος
 * της καθέτου της αναφοράς, προς την πλευρά του cursor**. Επειδή η γεωμετρία της κυκλικής κολόνας
 * αγνοεί το anchor (κέντρο πάντα στο `position` — ADR-363), επιστρέφουμε `position = offsetCenter` +
 * `anchor:'center'` → **ΜΗΔΕΝ αλλαγή στο geometry/anchor pipeline**. Δουλεύει σε **κάθε γωνία** (λοξός
 * τοίχος) γιατί η κάθετος βγαίνει από το frame της αναφοράς (`buildMemberAxisFrame` / `GhostFaceFrame`).
 *
 * **Auto-candidates (Giorgio 2026-06-25):** δεν υπάρχει mode toggle — τα tangent candidates μπαίνουν
 * ΔΙΠΛΑ στα center candidates και ο υπάρχων `nearestHit` διαλέγει το πλησιέστερο στον cursor. Μετρική:
 *   · center  → `dist = perp`            (κερδίζει όταν ο cursor είναι ΠΑΝΩ στην αναφορά)·
 *   · tangent → `dist = |perp − R|`      (κερδίζει όταν ο cursor είναι ~`R` από την αναφορά).
 * Έτσι, καθώς ο χρήστης σπρώχνει τον κύκλο προς τον τοίχο, κουμπώνει ομαλά: κέντρο-στον-άξονα →
 * περιφέρεια-στον-άξονα → κέντρο-στην-παρειά → περιφέρεια-στην-παρειά, χωρίς flicker.
 *
 * **FULL SSoT — μηδέν νέα geometry primitive:** reuse `buildMemberAxisFrame` (frame άξονα),
 * `resolveLinearMemberFaceSnap` (frame παρειάς, ίδιο που τρώει το flush face-snap), `GhostFaceFrame`
 * (`perpDir`/`outwardSign`/`facePerp`), `buildCenteredAxisFaceFrame` (CL listening dims). Η μόνη «math»
 * = το ±`R·perp` offset. Pure — zero React/DOM/store. Μονάδες: scene units.
 *
 * @see ./column-face-snap.ts — ο core resolver που το καλεί (gated `opts.circleRadiusScene>0`, nearest-wins)
 * @see ./column-polar-opts.ts — εκεί υπολογίζεται το `circleRadiusScene` (gated circular)
 * @see docs/centralized-systems/reference/adrs/ADR-398-column-placement-snap.md §3.19
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

/** Hit κοινό με τους υπόλοιπους tiers του core resolver (snap + dist για nearest-wins). */
type TangentHit = { snap: ColumnFaceSnap; dist: number };

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

/**
 * §3.19 mode #4 — **περιφέρεια → ΚΕΝΤΡΙΚΟΣ ΑΞΟΝΑΣ** ενός μέλους: ο κύκλος εφάπτεται στον άξονα.
 * Προβάλλει τον cursor στον άξονα (`a + along·u`)· `null` εκτός των άκρων ή όταν το `|perp − R|` ξεπερνά
 * τη ζώνη `captureScene` (δεν είναι υποψήφιο). Το κέντρο μετατοπίζεται κατά `R` κατά μήκος της καθέτου
 * `perpDir = (u.y, −u.x)` **προς την πλευρά του cursor** (πρόσημο του signed perp). `dist = |perp − R|`.
 */
function resolveAxisTangent(
  cursor: Readonly<Point2D>,
  members: readonly LinearMemberSnapTarget[],
  radius: number,
  captureScene: number,
): TangentHit | null {
  let best: TangentHit | null = null;
  for (const m of members) {
    const fr = buildMemberAxisFrame(m.axis, m.outline);
    if (!fr) continue;
    const rx = cursor.x - fr.a.x;
    const ry = cursor.y - fr.a.y;
    const along = rx * fr.u.x + ry * fr.u.y;
    if (along < fr.alongMin || along > fr.alongMax) continue; // πέρα από τα άκρα
    const signedPerp = rx * fr.u.y - ry * fr.u.x;             // (cursor−a)·perpDir, perpDir=(u.y,−u.x)
    const dist = Math.abs(Math.abs(signedPerp) - radius);
    if (dist > captureScene) continue;                        // εκτός ζώνης tangent → όχι υποψήφιο
    const sign = signedPerp >= 0 ? 1 : -1;                    // πλευρά cursor
    const center: Point2D = {
      x: fr.a.x + along * fr.u.x + sign * radius * fr.u.y,
      y: fr.a.y + along * fr.u.y - sign * radius * fr.u.x,
    };
    const bounds = footprintBounds(m.outline);
    best = keepNearest(best, {
      snap: {
        position: center, anchor: 'center', rotation: 0, status: 'beam', targetId: m.id,
        face: bounds ? pickDominantFace(cursor, bounds) : 'N', third: 'mid',
        faceFrame: buildCenteredAxisFaceFrame(
          fr.a, fr.u, { x: fr.u.y, y: -fr.u.x }, fr.alongMin, fr.alongMax, along,
        ),
      },
      dist: cleanDist(dist),
    });
  }
  return best;
}

/**
 * §3.19 mode #3 — **περιφέρεια → ΠΑΡΕΙΑ/ΑΚΜΗ**: ο κύκλος εφάπτεται στην πλησιέστερη παρειά, **έξω** από
 * το μέλος (πλευρά cursor = `outwardSign·perpDir`, ίδιο που δίνει το flush face-snap). Reuse του ΙΔΙΟΥ
 * `resolveLinearMemberFaceSnap` (zero-width edges) που καταναλώνει το flush path → μηδέν διπλό frame
 * math. `dist = ||perp_to_face| − R|`. `null` όταν καμία ακμή εντός capture ή εκτός tangent ζώνης.
 */
function resolveEdgeTangent(
  cursor: Readonly<Point2D>,
  edges: readonly LinearMemberSnapTarget[],
  radius: number,
  scaleF: number,
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
  const along = ff.ghostCenterAlong;
  const faceX = ff.origin.x + along * ff.axisDir.x + ff.facePerp * ff.perpDir.x;
  const faceY = ff.origin.y + along * ff.axisDir.y + ff.facePerp * ff.perpDir.y;
  const center: Point2D = {
    x: faceX + radius * ff.outwardSign * ff.perpDir.x,
    y: faceY + radius * ff.outwardSign * ff.perpDir.y,
  };
  return {
    snap: {
      position: center, anchor: 'center', rotation: 0, status: 'beam', targetId: null,
      face: edgeNearFace(ff), third: 'mid',
      faceFrame: buildCenteredAxisFaceFrame(
        ff.origin, ff.axisDir, ff.perpDir, ff.faceAlongMin, ff.faceAlongMax, along, ff.arc,
      ),
    },
    dist: cleanDist(dist),
  };
}

/**
 * §3.19 — **το πλησιέστερο circumference-tangent hit** (mode #3 ∪ #4) για κυκλικό φάντασμα ακτίνας
 * `radiusScene`. Επιστρέφεται ως επιπλέον candidate στον `nearestHit` του core resolver (additive, μηδέν
 * regression στα center modes). References:
 *   · **άξονας**: τοίχοι + δοκάρια (`buildMemberAxisFrame` — κεντρική γραμμή)·
 *   · **παρειά/ακμή**: footprint edges (τοίχοι/μη-κυκλικές κολόνες/πέδιλα) + ακμές πλάκας + γραμμές.
 * `null` όταν `radiusScene<=0` (μη-κυκλικό → caller δεν το καλεί καν) ή κανένα tangent εντός ζώνης.
 */
export function resolveCircularTangentHit(
  cursor: Readonly<Point2D>,
  t: Readonly<SceneSnapTargets>,
  sceneUnits: SceneUnits,
  radiusScene: number,
): TangentHit | null {
  if (!(radiusScene > 0)) return null;
  const f = mmToSceneUnits(sceneUnits);
  const captureScene = MEMBER_GHOST_CAPTURE_MM * f;
  const axisHit = resolveAxisTangent(cursor, [...t.wallTargets, ...t.beamTargets], radiusScene, captureScene);
  const edgeHit = resolveEdgeTangent(
    cursor,
    [...(t.footprintEdgeTargets ?? []), ...t.slabTargets, ...t.lineTargets],
    radiusScene,
    f,
  );
  return keepNearest(axisHit, edgeHit);
}
