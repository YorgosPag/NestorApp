/**
 * @module line-preview-helpers
 * @description ADR-508 §line-cyan — flush/κάθετο κούμπωμα + κυανές listening dimensions για το
 * **LINE tool**, με ΠΛΗΡΗ reuse του ίδιου «Εγκεφάλου Έλξης» (ADR-514) που ήδη χρησιμοποιεί ο τοίχος.
 *
 * Η γραμμή = γραμμικό μέλος **μηδενικού πλάτους** (`toolKind:'line'` → `memberWidthMm = 0`): το σημείο
 * πατά ΑΚΡΙΒΩΣ πάνω στην παρειά υπάρχοντος μέλους και ο `faceFrame` τροφοδοτεί τις ΙΔΙΕΣ κυανές
 * διαστάσεις (gap-left / gap-right / κέντρο-προς-κέντρο) μέσω του ΚΟΙΝΟΥ `resolveGhostFaceDimensionsMeta`.
 *
 * Split ίδιο με τον τοίχο: **preview εδώ, commit στο `useDrawingHandlers.onDrawingPoint`** — και τα δύο
 * καλούν τον ΙΔΙΟ `resolveBimCursorSnap` πάνω στον ίδιο (ήδη OSNAP-snapped) cursor → **preview ≡ commit
 * by construction**. Μηδέν νέος painter, μηδέν νέο overlay-meta πεδίο, μηδέν δεύτερος snap μηχανισμός.
 *
 * @see ./wall-preview-helpers.ts — ο αδελφός του τοίχου (ίδια αρχιτεκτονική)
 * @see ../../bim/placement/bim-cursor-snap.ts — resolveBimCursorSnap (ο εγκέφαλος έλξης)
 * @see ./wysiwyg-preview-shared.ts — resolveGhostFaceDimensionsMeta / resolveEffectivePreviewCursor (SSoT)
 * @see docs/centralized-systems/reference/adrs/ADR-508-unified-linear-member-framing.md §line-cyan
 */

import type { Point2D } from '../../rendering/types/Types';
import type { SceneUnits } from '../../utils/scene-units';
import type { ExtendedLineEntity, ExtendedSceneEntity } from './drawing-types';
import { resolveBimCursorSnap } from '../../bim/placement/bim-cursor-snap';
import { sceneSnapTargetsStore } from '../../bim/framing/scene-snap-targets';
import { resolveEffectivePreviewCursor, resolveGhostFaceDimensionsMeta } from './wysiwyg-preview-shared';
import { worldPerPixel } from '../../rendering/utils/viewport-scale';
import { getImmediateTransform } from '../../systems/cursor/ImmediateTransformStore';
import { getDefaultLayerId } from '../../stores/LayerStore';
import type { GhostFaceFrame } from '../../bim/framing/linear-member-face-snap';
import type { GhostFaceDimensionsMeta } from '../../bim/framing/ghost-face-dim-references';
import { mmToSceneUnits } from '../../utils/scene-units';
import { resizeSegmentToLength } from '../../rendering/entities/shared/geometry-vector-utils';

/**
 * ADR-508 §line-cyan — μήκος του **κάθετου stub-φαντάσματος** πριν το 1ο κλικ (mm, scene). Ο εγκέφαλος
 * έλξης παράγει stub `MEMBER_GHOST_LEN_MM`=1200mm (όσο και ο τοίχος)· όμως η λεπτή γραμμή στα 1.2m διαβάζεται
 * οπτικά υπερμεγέθης (ο χοντρός τοίχος όχι). Κόβουμε το stub σε αυτό το κοντό μήκος ΜΟΝΟ για το οπτικό
 * φάντασμα — η διαμήκης θέση / οι κυανές διαστάσεις (`faceFrame`) ΔΕΝ επηρεάζονται (μετρούν κατά μήκος της
 * παρειάς, ανεξάρτητα από το μήκος του stub). Tunable.
 */
const LINE_GHOST_STUB_LEN_MM = 300;

/** Κόβει το stub ώστε `start→end` να έχει το πολύ `lenMm` (scene), διατηρώντας την (κάθετη) φορά. Reuse
 *  του geometry SSoT `resizeSegmentToLength` — εδώ ζει μόνο η συνθήκη max-clamp (mirror του wall min-clamp). */
function clampStubLength(start: Readonly<Point2D>, end: Readonly<Point2D>, lenMm: number, sceneUnits: SceneUnits): Point2D {
  const cur = Math.hypot(end.x - start.x, end.y - start.y);
  const target = lenMm * mmToSceneUnits(sceneUnits);
  if (cur <= target) return { x: end.x, y: end.y };
  return resizeSegmentToLength(start, end, target);
}

/** Αποτέλεσμα του εγκεφάλου έλξης για τη γραμμή (zero-width member face-snap). */
interface LineFaceSnap {
  /** Flush σημείο πάνω στην παρειά (το άκρο της γραμμής κλειδώνει εδώ). */
  readonly start: Point2D;
  /** Άκρο μικρού κάθετου stub-φαντάσματος (προς τα έξω από την παρειά). */
  readonly end: Point2D;
  readonly faceFrame: GhostFaceFrame;
}

/**
 * **Ο ΕΝΑΣ** πυρήνας έλξης για το LINE tool (zero-width), κοινός σε preview ΚΑΙ commit. Καλεί τον
 * εγκέφαλο (`resolveBimCursorSnap`) πάνω στον δοθέντα **ήδη OSNAP-snapped** cursor, **ΧΩΡΙΣ** `findSnapPoint`
 * (anti double-snap, ADR-514 §2). Επιστρέφει `{ start, end, faceFrame }` **ΜΟΝΟ** όταν το ghost γλιστράει
 * 🟢 flush/κάθετα πάνω σε παρειά μέλους (ο `faceFrame` υπάρχει στον Τ-framing κλάδο)· `null` σε ελεύθερη
 * κίνηση ή σε collinear-overlap (όπου δεν υπάρχει κάθετη παρειά).
 */
function resolveLineFaceSnapAt(effectiveCursor: Readonly<Point2D>, sceneUnits: SceneUnits): LineFaceSnap | null {
  const snapResult = resolveBimCursorSnap({
    toolKind: 'line',
    cursor: effectiveCursor,
    targets: sceneSnapTargetsStore.get(),
    sceneUnits,
    memberWidthMm: 0,
  });
  if (snapResult.kind !== 'member-placement') return null;
  const { start, end, faceFrame } = snapResult.placement;
  // ΜΟΝΟ ο 🟢 κάθετος Τ-framing κλάδος εκθέτει `faceFrame` (collinear-overlap → undefined → άκυρο εδώ).
  if (!faceFrame) return null;
  return { start, end, faceFrame };
}

/**
 * Preview wrapper: ο cursor περνά πρώτα από `resolveEffectivePreviewCursor` (διαβάζει το armed snap του
 * scheduler, mirror του commit `bimPoint`) → ο πυρήνας δουλεύει στο ΙΔΙΟ σημείο που θα κλειδώσει το κλικ.
 */
function resolveLineFaceSnap(cursor: Readonly<Point2D>, sceneUnits: SceneUnits): LineFaceSnap | null {
  return resolveLineFaceSnapAt(resolveEffectivePreviewCursor(cursor), sceneUnits);
}

/**
 * ADR-508 §line-cyan — **ΤΟ ΕΝΑ** σημείο υπολογισμού των κυανών listening dims από `faceFrame`
 * (gap-left / gap-right / κέντρο-προς-κέντρο). Καλείται από το stub-φάντασμα (State A, πριν το 1ο
 * κλικ) ΚΑΙ από το `resolveLineListeningDims` (State B, μετά το 1ο κλικ) — μηδέν διπλότυπο.
 */
export function resolveLineFaceDims(faceFrame: GhostFaceFrame, sceneUnits: SceneUnits): GhostFaceDimensionsMeta | null {
  const wpp = worldPerPixel(getImmediateTransform().scale);
  return resolveGhostFaceDimensionsMeta(faceFrame, false, sceneUnits, wpp);
}

/**
 * ADR-508 §line-cyan — listening dims στη ΘΕΣΗ του cursor (State B: μετά το 1ο κλικ), ΧΩΡΙΣ
 * μετακίνηση σημείου. Επιστρέφει `null` όταν ο cursor δεν είναι κοντά σε παρειά (ελεύθερη κίνηση →
 * καμία ένδειξη) — η γραμμή παραμένει ελεύθερη να περιστραφεί, μόνο οι διαστάσεις εμφανίζονται.
 */
export function resolveLineListeningDims(cursor: Readonly<Point2D>, sceneUnits: SceneUnits): GhostFaceDimensionsMeta | null {
  const snap = resolveLineFaceSnap(cursor, sceneUnits);
  return snap ? resolveLineFaceDims(snap.faceFrame, sceneUnits) : null;
}

/**
 * ADR-508 §line-cyan — **COMMIT** entry: εφαρμόζει το ΙΔΙΟ flush/κάθετο κούμπωμα στο ήδη resolved click
 * σημείο. Όταν υπάρχει παρειά εντός capture → επιστρέφει το flush σημείο (= το άκρο που δείχνει το preview)·
 * αλλιώς το σημείο αυτούσιο. **preview ≡ commit** (ίδιος πυρήνας `resolveLineFaceSnapAt`). Το σημείο εδώ
 * είναι ήδη OSNAP/tracking-resolved → ΧΩΡΙΣ `resolveEffectivePreviewCursor` (δεν ξανα-διαβάζουμε armed snap).
 */
export function resolveLineCommitPoint(point: Readonly<Point2D>, sceneUnits: SceneUnits): Point2D {
  const snap = resolveLineFaceSnapAt(point, sceneUnits);
  return snap ? { x: snap.start.x, y: snap.start.y } : { x: point.x, y: point.y };
}

/** Χτίζει minimal preview `ExtendedLineEntity`· τα στυλ (color/lineweight/grips/HUD) τα προσθέτει ο `applyPreviewStyling`. */
function makeLinePreviewEntity(
  id: string,
  start: Readonly<Point2D>,
  end: Readonly<Point2D>,
  faceFrame: GhostFaceFrame,
  sceneUnits: SceneUnits,
): ExtendedLineEntity {
  // ADR-508 §line-cyan — οι κυανές listening dims μέσω του ΚΟΙΝΟΥ SSoT helper (ίδιο σημείο υπολογισμού
  // με το State B attach στο `drawing-preview-partial.ts`).
  const faceDimensions = resolveLineFaceDims(faceFrame, sceneUnits);
  return {
    id,
    type: 'line',
    start: { x: start.x, y: start.y },
    end: { x: end.x, y: end.y },
    visible: true,
    layerId: getDefaultLayerId(),
    preview: true,
    ...(faceDimensions ? { faceDimensions } : {}),
  } as ExtendedLineEntity;
}

/**
 * ADR-508 §line-cyan — preview του LINE tool με flush/κάθετο κούμπωμα + κυανές listening dimensions.
 *
 *   · **πριν το 1ο κλικ** (`tempPoints = []`): μικρό **κάθετο stub-φάντασμα** flush πάνω στην πλησιέστερη
 *     υφιστάμενη γραμμή/μέλος (ΙΔΙΟ με το έξυπνο φάντασμα τοίχου) + κυανές. Μακριά → `null` (ο caller
 *     δείχνει την κανονική τελεία αφετηρίας).
 *
 * **ΜΕΤΑ το 1ο κλικ** (`tempPoints.length ≥ 1`, awaiting-end): **καμία** έλξη flush — η γραμμή πρέπει να
 * **περιστρέφεται ΕΛΕΥΘΕΡΑ** γύρω από την αρχή (Giorgio: «να μην κολλάει κατά μήκος του σώματος, να μπορώ
 * να την περιστρέψω»). Επιστρέφεται `null` → ο caller δείχνει την κανονική ελεύθερη γραμμή (μόνο OSNAP).
 *
 * `null` σε κάθε άλλη περίπτωση → fall-through στη γενική preview διαδρομή.
 */
export function generateLinePreview(
  tempPoints: readonly Point2D[],
  cursorPoint: Point2D,
  sceneUnits: SceneUnits,
): ExtendedSceneEntity | null {
  // ΜΟΝΟ πριν το 1ο κλικ: flush/κάθετο stub + κυανές. Μετά → null (ελεύθερη περιστροφή).
  if (tempPoints.length !== 0) return null;
  const snap = resolveLineFaceSnap(cursorPoint, sceneUnits);
  if (!snap) return null;
  // Κάθετο stub: start (flush στην παρειά) → end (κοντό φάντασμα προς τα έξω, κάθετα στην παρειά).
  // Κόβουμε το μήκος σε `LINE_GHOST_STUB_LEN_MM` (η λεπτή γραμμή διαβάζεται οπτικά μεγαλύτερη από τοίχο).
  const stubEnd = clampStubLength(snap.start, snap.end, LINE_GHOST_STUB_LEN_MM, sceneUnits);
  return makeLinePreviewEntity('preview_line_stub', snap.start, stubEnd, snap.faceFrame, sceneUnits);
}
