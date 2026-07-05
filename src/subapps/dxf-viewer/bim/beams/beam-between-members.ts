/**
 * ADR-569 — «Δοκάρι ανάμεσα σε μέλη» (beam between two picked structural members).
 *
 * Ζητούμενο (Giorgio 2026-07-03): ενεργοποιείς την εντολή και κάνεις **σειριακά κλικ** σε
 * κολόνες/τοιχία· κάθε δεύτερο κλικ δημιουργεί ΑΜΕΣΩΣ ένα δοκάρι ανάμεσα στο προηγούμενο και
 * στο τρέχον μέλος, και το τρέχον μέλος γίνεται η αρχή του επόμενου δοκαριού (αλυσίδα). Αντίστροφα:
 * με **δύο ήδη επιλεγμένα** μέλη, η εντολή φτιάχνει άμεσα το δοκάρι ανάμεσά τους.
 *
 * Γεωμετρία (Giorgio: «το πιο κοντινό είναι οι **παρειές**»): ο άξονας του δοκαριού είναι η **πιο
 * σύντομη διαδρομή** ανάμεσα στα δύο σχήματα κάτοψης — τα δύο πλησιέστερα σημεία των outlines
 * (αντικριστές παρειές), μέσω του SSoT `shortestSegmentBetweenPolygons`. Δύο κολόνες → κέντρο-προς-
 * κέντρο κατεύθυνση με άκρα στις παρειές· κολόνα↔μακρύς τοίχος → πλησιέστερο σημείο στον τοίχο.
 *
 * FULL SSoT reuse — μηδέν αναπαραγωγή geometry/builder math:
 *   - Pick τοίχου: `pickWallEntityAt` (bim/beams/beam-from-wall.ts, ίδιο SSoT με «Δοκάρι από τοίχο»).
 *   - Pick κολόνας: `isPointInPolygon` (utils/geometry, ίδιο SSoT με το column hit-test).
 *   - Footprint μέλους: `resolveMemberFootprintVertices` (κολόνα) + `closedRingFromEdges` (τοίχος).
 *   - Σύνδεσμος παρειών: `shortestSegmentBetweenPolygons` (bim/geometry/shared/polygon-nearest.ts).
 *   - Κατασκευή entity: `completeBeamFromTwoClicks` (hooks/drawing/beam-completion.ts).
 *
 * Pure — zero React/DOM/store.
 *
 * @see bim/geometry/shared/polygon-nearest.ts — shortestSegmentBetweenPolygons (SSoT παρειά→παρειά)
 * @see hooks/drawing/beam-completion.ts — beam builder SSoT
 * @see hooks/drawing/useBeamBetweenMembersTool.ts — React FSM orchestrator (αλυσίδα + reverse)
 * @see docs/centralized-systems/reference/adrs/ADR-569-beam-between-members.md
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import { isColumnEntity, isWallEntity } from '../../types/entities';
import type { BeamEntity } from '../types/beam-types';
import { DEFAULT_BEAM_WIDTH_MM } from '../types/beam-types';
import { resolveMemberFootprintVertices } from '../structural/member-footprint-2d';
import { closedRingFromEdges, polygon2DCentroid, projectVerticesTo2D } from '../geometry/shared/polygon-utils';
import { projectPolygonOnAxis } from '../geometry/shared/polygon-axis-projection';
import {
  shortestSegmentBetweenPolygons,
  closestPointOnPolygonOutline,
  closestFacingEdgeBetweenPolygons,
  type NearestPair,
} from '../geometry/shared/polygon-nearest';
import { isPointInPolygon } from '../../utils/geometry/GeometryUtils';
import { mmToSceneUnits } from '../../utils/scene-units';
import { canonicalAxisNormal } from '../grid/axis-normal';
import { unjustifyAxisPoints } from '../grid/axis-justify';
import type { StripJustification } from '../types/foundation-types';
import { pickWallEntityAt } from './beam-from-wall';
import {
  completeBeamFromTwoClicks,
  type BeamParamOverrides,
  type SceneUnits,
} from '../../hooks/drawing/beam-completion';

const EPS = 1e-6;

/** Ένα διαλεγμένο δομικό μέλος (κολόνα ή τοίχος) + το 2D outline του (world/scene units). */
export interface PickedStructuralMember {
  readonly entity: Entity;
  readonly footprint: readonly Point2D[];
}

/**
 * 2D outline κάτοψης ενός φέροντος μέλους (world coords), ή `null` αν δεν υπάρχει έγκυρο (≥3 κορυφές).
 * Τοίχος → κλειστός δακτύλιος outer+inner (`closedRingFromEdges`)· κολόνα/δοκάρι → footprint outline
 * (`resolveMemberFootprintVertices`). Τα σημεία επιστρέφονται ως καθαρά `Point2D` (z αγνοείται).
 */
export function getStructuralMemberFootprint2D(entity: Entity): Point2D[] | null {
  if (isWallEntity(entity)) {
    const outer = entity.geometry?.outerEdge?.points;
    const inner = entity.geometry?.innerEdge?.points;
    if (!outer || !inner || outer.length < 2 || inner.length < 2) return null;
    const ring = closedRingFromEdges(outer, inner);
    return ring.length >= 3 ? projectVerticesTo2D(ring) : null;
  }
  const verts = resolveMemberFootprintVertices(entity);
  return verts && verts.length >= 3 ? projectVerticesTo2D(verts) : null;
}

/**
 * Διάλεξε το δομικό μέλος (κολόνα ή τοίχος) κάτω από το κλικ. Προτεραιότητα στην **κολόνα** όταν
 * το σημείο πέφτει μέσα στο footprint της (ή εντός `tolerance` από την παρειά)· αλλιώς **τοίχος**
 * μέσω του ΚΟΙΝΟΥ `pickWallEntityAt` (κλικ οπουδήποτε στο σώμα). Επιστρέφει `null` αν κανένα μέλος
 * δεν βρίσκεται κάτω/κοντά στο σημείο.
 */
export function pickStructuralMemberAt(
  point: Readonly<Point2D>,
  entities: readonly Entity[],
  tolerance: number,
): PickedStructuralMember | null {
  let nearestByEdge: PickedStructuralMember | null = null;
  let nearestDist = Infinity;
  for (const e of entities) {
    if (!isColumnEntity(e)) continue;
    const footprint = getStructuralMemberFootprint2D(e);
    if (!footprint) continue;
    if (isPointInPolygon(point, footprint)) {
      return { entity: e, footprint }; // μέσα στο footprint → άμεση επιλογή
    }
    const q = closestPointOnPolygonOutline(footprint, point);
    const d = Math.hypot(q.x - point.x, q.y - point.y);
    if (d <= tolerance && d < nearestDist) {
      nearestDist = d;
      nearestByEdge = { entity: e, footprint };
    }
  }
  if (nearestByEdge) return nearestByEdge;

  const wall = pickWallEntityAt(point, entities, tolerance);
  if (wall) {
    const footprint = getStructuralMemberFootprint2D(wall);
    if (footprint) return { entity: wall, footprint };
  }
  return null;
}

/** Αποτέλεσμα κατασκευής δοκαριού ανάμεσα σε δύο μέλη. */
export type BuildBeamBetweenResult =
  | { readonly ok: true; readonly entity: BeamEntity; readonly connector: NearestPair }
  | { readonly ok: false; readonly reason: 'no-connector' | 'build-failed'; readonly hardErrors?: readonly string[] };

/**
 * Ο **σύνδεσμος παρειών** (πιο σύντομη διαδρομή) ανάμεσα σε δύο μέλη, ή `null` αν εφάπτονται/
 * επικαλύπτονται (κανένα καθαρό κενό). Pure — ίδιο σημείο για preview ΚΑΙ commit (preview ≡ commit).
 */
export function connectorBetweenMembers(
  a: PickedStructuralMember,
  b: PickedStructuralMember,
): NearestPair | null {
  return shortestSegmentBetweenPolygons(a.footprint, b.footprint);
}

/**
 * Σύνδεσμος από την παρειά ενός μέλους προς **ελεύθερο σημείο** (ο κέρσορας πριν διαλεγεί το 2ο
 * μέλος) — για το rubber-band ghost. Το άκρο `a` κουμπώνει στην παρειά του μέλους που κοιτάζει
 * τον κέρσορα, το `b` είναι ο κέρσορας.
 */
export function connectorFromMemberToPoint(
  member: PickedStructuralMember,
  point: Readonly<Point2D>,
): NearestPair {
  const a = closestPointOnPolygonOutline(member.footprint, point);
  return { a, b: { x: point.x, y: point.y }, dist: Math.hypot(a.x - point.x, a.y - point.y) };
}

/**
 * ADR-529 — map το lateral flush (νότια/βόρεια/κέντρο) → **Revit Location-Line justification**
 * ('left'/'right'/'center') ως προς τον canonical normal του άξονα του δοκαριού. Έτσι το
 * `buildBeamBetweenMembers` αποθηκεύει **location line (= flush παρειά) + justification** → το flush
 * μένει **associative με το πλάτος**: όταν ο στατικός οργανισμός ξανα-διαστασιολογεί, η νότια/βόρεια
 * παρειά ΜΕΝΕΙ αγκυρωμένη. `nNx,nNy` = ο lateral normal (δείχνει βορρά). Reuse του PUBLIC
 * `canonicalAxisNormal` SSoT (`JUSTIFICATION_NORMAL_SIGN`: left=+1 / right=−1 / center=0).
 */
function resolveFlushJustification(
  a: Readonly<Point2D>,
  b: Readonly<Point2D>,
  nNx: number,
  nNy: number,
  flush: 'south' | 'north' | 'center',
): StripJustification {
  if (flush === 'center') return 'center';
  const cn = canonicalAxisNormal(a, b);
  if (!cn) return 'center';
  // c = πρόσημο ευθυγράμμισης canonical-normal ↔ north-normal (παράλληλα → ±1).
  const c = Math.sign(cn.nx * nNx + cn.ny * nNy) || 1;
  // νότια-flush (παρειά στο −north) → SIGN = c· βόρεια-flush → SIGN = −c. SIGN>0 → 'left', <0 → 'right'.
  const wantSign = flush === 'south' ? c : -c;
  return wantSign > 0 ? 'left' : 'right';
}

/**
 * **Άξονας (centerline) του δοκαριού** ανάμεσα σε δύο μέλη — decoupled σε δύο άξονες (ADR-569 §lateral):
 *
 *   • **Διεύθυνση (`u`) — ακολουθεί τις παρειές του πιο κοντινού σκέλους** (Giorgio 2026-07-03): ο άξονας
 *     ορίζεται ως η **κάθετος της facing-ακμής** (`closestFacingEdgeBetweenPolygons`), προσανατολισμένος
 *     A→B, ΟΧΙ κέντρο→κέντρο. Έτσι το δοκάρι μένει **ορθογώνιο στην παρειά** και ποτέ λοξό — ένας
 *     centroid→centroid άξονας θα έγερνε όταν τα κέντρα των μελών διαφέρουν σε Y (διαφορετικό βάθος ή
 *     μικρο-offset εισηγμένων DXF θέσεων) → όλο το δοκάρι λοξό (το bug που διόρθωσε το ADR-569).
 *   • **Διαμήκης (span):** τα άκρα = οι **αντικριστές παρειές** (`alongMax` του A προς B, `alongMin` του
 *     B προς A πάνω στον `u` — face-to-face, Revit trimmed-to-face).
 *   • **Πλευρικός (lateral flush κατά φορά, Giorgio):** ο άξονας τοποθετείται εγκάρσια στην επικάλυψη
 *     `[lo, hi]` των **facing-παρειών** — του **cross-section στη θέση σύνδεσης**, ΟΧΙ ολόκληρου του
 *     footprint (ADR-569 §Τ-mirror). Για **Τ/Γ** μέλη η facing-παρειά είναι ΜΟΝΟ το αντικριστό **σκέλος**
 *     (βραχίονας) → το δοκάρι **φωλιάζει στα ευθυγραμμισμένα σκέλη** αντί να πέσει στον νότιο πάτο του
 *     spine· για **ορθογώνια** η facing-παρειά = όλο το ύψος → **ίδιο νότιο-flush** όπως πριν. 2ο κλικ
 *     **δεξιά** (dx≥0) → **νότια-flush** (`lo`)· **αριστερά** → **βόρεια-flush** (`hi`). Επειδή `lo`/`hi`
 *     = οι άκρες της **παρειάς-επικάλυψης**, το δοκάρι πατάει ΚΑΙ στα δύο σκέλη, μηδέν κρέμασμα.
 *     **Ειδική περίπτωση — ομοαξονικοί βραχίονες Τ** (Giorgio): όταν ΚΑΙ οι δύο facing-παρειές είναι
 *     **προεξέχοντες βραχίονες** (στενότερες από το πλήρες footprint) ΚΑΙ **ομοαξονικοί**, ο άξονας
 *     ευθυγραμμίζεται στον **κοινό άξονα των βραχιόνων** (κέντρο) → `justification='center'` → μένει
 *     κεντραρισμένος και όταν αλλάξει το πλάτος (associative), αντί να ξεκολλήσει νότια.
 *
 * `halfWidthScene` = μισό πλάτος δοκαριού σε scene units (ώστε το centerline να μετατοπιστεί σωστά).
 * FULL SSoT reuse: `closestFacingEdgeBetweenPolygons` (facing-ακμή) + `polygon2DCentroid` +
 * `projectPolygonOnAxis` (ίδιο με ADR-528 auto-span). `{u,n}` ορθοκανονική βάση → ανακατασκευή σημείου
 * `P = O + s·u + t·n`. `null` αν τα μέλη εφάπτονται/επικαλύπτονται (καμία καθαρή facing-ακμή).
 *
 * Επιστρέφει ΚΑΙ το **`justification`** (Revit Location-Line) του flush → ο `buildBeamBetweenMembers`
 * αποθηκεύει location line (= flush παρειά) + αυτό, ώστε το flush να μένει associative με το πλάτος.
 * Το `a`/`b` είναι ο **body axis** (flush centerline για το τρέχον πλάτος — αυτό δείχνει και το ghost).
 */
export function computeBeamAxisBetweenMembers(
  footprintA: readonly Point2D[],
  footprintB: readonly Point2D[],
  halfWidthScene: number,
): { a: Point2D; b: Point2D; justification: StripJustification } | null {
  const cA = polygon2DCentroid(footprintA);
  const cB = polygon2DCentroid(footprintB);
  // Διεύθυνση δοκαριού = κάθετος της facing-ακμής του πιο κοντινού σκέλους (ADR-569 — ποτέ λοξό).
  const facing = closestFacingEdgeBetweenPolygons(footprintA, footprintB);
  if (!facing) return null;
  let ux = -facing.edge.y; // περιστροφή της edge-διεύθυνσης κατά 90° = κάθετος της παρειάς
  let uy = facing.edge.x;
  if (ux * (cB.x - cA.x) + uy * (cB.y - cA.y) < 0) {
    ux = -ux; // προσανατολισμός A→B (η facing-κάθετος δείχνει προς το άλλο μέλος)
    uy = -uy;
  }
  const len = Math.hypot(ux, uy);
  if (len < EPS) return null;
  ux /= len;
  uy /= len;
  // Κάθετος `n` = στροφή του `u` κατά +90° = (-uy, ux)· εξαναγκασμός να δείχνει **βορρά** (n.y ≥ 0).
  let nx = -uy;
  let ny = ux;
  if (ny < 0) {
    nx = -nx;
    ny = -ny;
  }
  const ox = cA.x;
  const oy = cA.y;
  // Διαμήκεις παρειές (κατά `u`, αρχή = κέντρο A).
  const puA = projectPolygonOnAxis(footprintA, ox, oy, ux, uy);
  const puB = projectPolygonOnAxis(footprintB, ox, oy, ux, uy);
  const sStart = puA.alongMax; // παρειά A προς B
  const sEnd = puB.alongMin; // παρειά B προς A
  // Πλευρική επικάλυψη = τομή των **facing-παρειών** (cross-section στη θέση σύνδεσης), ΟΧΙ ολόκληρου
  // του footprint (ADR-569 §Τ-mirror): για Τ/Γ μέλη η facing-παρειά είναι ΜΟΝΟ το αντικριστό σκέλος
  // (βραχίονας) → το δοκάρι φωλιάζει στα **ευθυγραμμισμένα σκέλη**· για ορθογώνια η facing-παρειά = όλη
  // η παρειά → **ίδιο νότιο-flush όπως πριν**. Reuse `projectPolygonOnAxis` (η ακμή = 2-point «πολύγωνο»).
  const bandA = projectPolygonOnAxis(facing.segA, ox, oy, nx, ny);
  const bandB = projectPolygonOnAxis(facing.segB, ox, oy, nx, ny);
  const lo = Math.max(bandA.alongMin, bandB.alongMin);
  const hi = Math.min(bandA.alongMax, bandB.alongMax);
  // Ομοαξονικοί βραχίονες Τ (Giorgio 2026-07-03): αν η facing-παρειά κάθε μέλους είναι **προεξέχων
  // βραχίονας** (στενότερη από το πλήρες footprint — το spine εκτείνεται πέρα απ' αυτήν) ΚΑΙ οι δύο
  // βραχίονες είναι **ομοαξονικοί** (ίδιο κέντρο-άξονα), ο άξονας του δοκαριού ευθυγραμμίζεται με τον
  // **κοινό άξονα των βραχιόνων** (κέντρο επικάλυψης) → justification 'center' → μένει κεντραρισμένος
  // ακόμη κι όταν ο οργανισμός αλλάζει πλάτος (associative). Ορθογώνια/Γ (facing = όλη η παρειά) → όχι
  // «βραχίονας» → πέφτει στο νότιο/βόρειο-flush όπως πριν (μηδέν regression).
  const fullA = projectPolygonOnAxis(footprintA, ox, oy, nx, ny);
  const fullB = projectPolygonOnAxis(footprintB, ox, oy, nx, ny);
  const armA = bandA.alongMin > fullA.alongMin + EPS || bandA.alongMax < fullA.alongMax - EPS;
  const armB = bandB.alongMin > fullB.alongMin + EPS || bandB.alongMax < fullB.alongMax - EPS;
  const centerA = (bandA.alongMin + bandA.alongMax) / 2;
  const centerB = (bandB.alongMin + bandB.alongMax) / 2;
  const bandDepth = Math.min(bandA.alongMax - bandA.alongMin, bandB.alongMax - bandB.alongMin);
  const coaxialArms = armA && armB && Math.abs(centerA - centerB) <= 0.25 * bandDepth;
  const dx = cB.x - cA.x;
  let t: number;
  let flush: 'south' | 'north' | 'center';
  if (lo > hi) {
    t = (lo + hi) / 2; // καμία πλευρική επικάλυψη → midpoint fallback
    flush = 'center';
  } else if (coaxialArms) {
    t = (lo + hi) / 2; // ομοαξονικοί βραχίονες Τ → κέντρο άξονα δοκαριού στον κοινό άξονα (Giorgio)
    flush = 'center';
  } else if (dx >= 0) {
    t = lo + halfWidthScene; // 2ο κλικ δεξιά → νότια-flush (νότια = lo, ο n δείχνει βορρά)
    flush = 'south';
  } else {
    t = hi - halfWidthScene; // 2ο κλικ αριστερά → βόρεια-flush
    flush = 'north';
  }
  const a = { x: ox + sStart * ux + t * nx, y: oy + sStart * uy + t * ny };
  const b = { x: ox + sEnd * ux + t * nx, y: oy + sEnd * uy + t * ny };
  return { a, b, justification: resolveFlushJustification(a, b, nx, ny, flush) };
}

/**
 * Χτίσε ΕΝΑ δοκάρι ανάμεσα σε δύο μέλη — body axis από `computeBeamAxisBetweenMembers` (face-to-face
 * span + lateral flush κατά φορά). **ADR-529 associative flush:** αντί να αποθηκεύσει τον flush
 * **centerline** (που θα «ξεκόλλαγε» από την παρειά όταν ο στατικός οργανισμός ξανα-διαστασιολογεί το
 * πλάτος), αποθηκεύει τη **location line (= flush παρειά)** μέσω `unjustifyAxisPoints` + το
 * `justification` ως πεδίο → το `computeBeamGeometry` re-derives το body με offset → η νότια/βόρεια
 * παρειά ΜΕΝΕΙ αγκυρωμένη όποιο κι αν γίνει το νέο πλάτος. Ίδιο SSoT pattern με το auto-span
 * (`appendCenterlineBeam`). Reuse `completeBeamFromTwoClicks` (ίδιο builder/validator/geometry).
 * Επιστρέφει `no-connector` αν εφάπτονται/ταυτίζονται, ή `build-failed` αν ο validator απορρίψει.
 */
export function buildBeamBetweenMembers(
  a: PickedStructuralMember,
  b: PickedStructuralMember,
  layerId: string,
  overrides: BeamParamOverrides,
  sceneUnits: SceneUnits,
): BuildBeamBetweenResult {
  const widthMm = overrides.width ?? DEFAULT_BEAM_WIDTH_MM;
  const halfWidthScene = (widthMm * mmToSceneUnits(sceneUnits)) / 2;
  const axis = computeBeamAxisBetweenMembers(a.footprint, b.footprint, halfWidthScene);
  if (!axis) return { ok: false, reason: 'no-connector' };
  // Location line (= flush παρειά) + justification → associative με το πλάτος. `center` → identity.
  const justified = axis.justification !== 'center';
  const loc = justified
    ? unjustifyAxisPoints(axis.a, axis.b, widthMm, axis.justification, sceneUnits)
    : { start: axis.a, end: axis.b };
  const finalOverrides = justified ? { ...overrides, justification: axis.justification } : overrides;
  const result = completeBeamFromTwoClicks(loc.start, loc.end, layerId, 'straight', finalOverrides, sceneUnits);
  if (!result.ok) return { ok: false, reason: 'build-failed', hardErrors: result.hardErrors };
  const dist = Math.hypot(axis.b.x - axis.a.x, axis.b.y - axis.a.y);
  return { ok: true, entity: result.entity, connector: { a: axis.a, b: axis.b, dist } };
}
