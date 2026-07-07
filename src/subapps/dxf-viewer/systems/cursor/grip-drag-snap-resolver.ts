/**
 * Grip Drag Snap Resolver — ΜΙΑ πηγή αλήθειας για το OSNAP κατά το grip Alt-drag / drag
 * (ADR-560 §grip-OSNAP-unified). Ο τοίχος «απλά δουλεύει»· εδώ ο ΙΔΙΟΣ μηχανισμός γίνεται
 * κοινός για τοίχο · κολόνα · δοκό · θεμέλιο (και κάθε μελλοντικό μέλος).
 *
 * Πριν: η λογική ήταν γραμμένη ΤΡΕΙΣ φορές στο `mouse-handler-move` (generic cursor snap →
 * wall face-corner → column corner) ως διαδοχικά mutating branches «ο τελευταίος γράφει», ΚΑΙ
 * μια τέταρτη φορά στο `mouse-handler-up` (commit). Κάθε νέος τύπος έπαιρνε μόνο το generic
 * branch → ίδιο bug που είχε η κολόνα· move απαιτούσε ορατότητα, up όχι → preview≠commit.
 *
 * Τώρα: ΕΝΑΣ pure resolver — corner-source dispatch (wall → face· member → footprint) + ο
 * κοινός priority resolver `resolveProjectedSnap` (ορατή γωνία > ορατό cursor > σιωπηλό).
 * Δέχεται ΜΟΝΟ ορατές έλξεις (σιωπηλό grid → null → αναλαμβάνει το AutoAlign). Καλείται
 * πανομοιότυπα από move (preview) & up (commit) → WYSIWYG εξ ορισμού.
 *
 * Pure resolver (zero React/DOM). Τα `publishGripSnap`/`clearGripSnap` γράφουν στα imperative
 * stores + στο React `setSnapResults` callback — χρησιμοποιούνται ΜΟΝΟ από το move (το commit
 * δεν δημοσιεύει marker).
 *
 * @see ./corner-projection-snap.ts — shared core + `resolveProjectedSnap` priority SSoT
 * @see ../../bim/walls/wall-face-corner-snap.ts — wall corner-source
 * @see ../../bim/structural/member-grip-corner-snap.ts — column/beam/foundation corner-source
 */

import type { Point2D } from '../../rendering/types/Types';
import type { ProSnapResult } from '../../snapping/extended-types';
import { isWallEntity, type Entity } from '../../types/entities';
import type { ActiveDragGripInfo } from './GripDragStore';
import type { SnapResultItem } from './mouse-handler-types';
import { setImmediateSnap, clearImmediateSnap, setFullSnapResult } from './ImmediateSnapStore';
import { findWallFaceCornerSnap } from '../../bim/walls/wall-face-corner-snap';
import { findMemberGripCornerSnap } from '../../bim/structural/member-grip-corner-snap';
import {
  resolveProjectedSnap,
  isDiscreteSnapTarget,
  type CornerProjectionResult,
  type FindSnapPoint,
} from './corner-projection-snap';

/** Το επιλεγμένο grip-drag snap: η γλυφή/ετικέτα (`snapResult`) + το σημείο στο οποίο
 *  κουμπώνει το ghost (`moveWorldPos`, με corner-διόρθωση όταν προβλήθηκε γωνία). */
export interface GripDragSnap {
  readonly snapResult: ProSnapResult;
  readonly moveWorldPos: Point2D;
}

/**
 * Corner-source dispatch — παράγει την corner-projection του μέλους που σέρνεται:
 *   · wall endpoint grip → 2 face corners (axis ± thickness/2 ⟂) — `findWallFaceCornerSnap`.
 *   · column/beam/foundation → footprint vertices — `findMemberGripCornerSnap` (ελέγχει από
 *     μόνο του gate/altMove ανά τύπο· επιστρέφει `null` για μη-μέλη ή μη-projecting λαβές).
 * Ό,τι άλλο (γραμμή/κύκλος/…) → `null` (μόνο το cursor snap του `resolveProjectedSnap` ισχύει).
 */
function resolveGripCornerProjection(
  entity: Readonly<Entity>,
  grip: Readonly<ActiveDragGripInfo>,
  cursorPos: Point2D,
  findSnapPoint: FindSnapPoint,
  altMove: boolean,
): CornerProjectionResult | null {
  if ((grip.gripKind === 'wall-start' || grip.gripKind === 'wall-end') && isWallEntity(entity)) {
    const face = findWallFaceCornerSnap(entity, grip.gripKind, cursorPos, findSnapPoint);
    return face ? { snapResult: face.snapResult, adjustedCursorPos: face.adjustedAxisPos } : null;
  }
  if (grip.dragAnchor) {
    return findMemberGripCornerSnap(entity, grip.gripKind, grip.dragAnchor, cursorPos, findSnapPoint, altMove);
  }
  return null;
}

/**
 * ΜΙΑ pure ανάλυση του grip-drag OSNAP — κοινή για preview (move) & commit (up).
 *
 * @param entities       Οι οντότητες της σκηνής (για εύρεση του dragged member).
 * @param activeDragGrip Το ενεργό grip drag record (`GripDragStore`).
 * @param cursorPos      RAW world cursor (προ cursor-snap) — ίδιο input σε move & up.
 * @param findSnapPoint  Ο ενιαίος snap engine.
 * @param altMove        Blur-proof whole-entity Alt-move (`isActiveGripAltMove()`).
 * @returns `{ snapResult, moveWorldPos }` όταν κουμπώνει ΟΡΑΤΗ έλξη· αλλιώς `null`.
 */
export function resolveGripDragSnap(
  entities: readonly Entity[] | null | undefined,
  activeDragGrip: ActiveDragGripInfo | null,
  cursorPos: Point2D,
  findSnapPoint: FindSnapPoint,
  altMove: boolean,
): GripDragSnap | null {
  if (!activeDragGrip || !entities) return null;
  const entity = entities.find((e) => e.id === activeDragGrip.entityId);
  if (!entity) return null;

  const corner = resolveGripCornerProjection(entity, activeDragGrip, cursorPos, findSnapPoint, altMove);
  const picked = resolveProjectedSnap(cursorPos, corner, findSnapPoint);
  // Grip drag δέχεται ΜΟΝΟ ορατές έλξεις — σιωπηλό grid/guide → null ώστε να νικήσει το AutoAlign
  // (αντί να τραβήξει το ghost σε αόρατο grid point ΧΩΡΙΣ marker — το ADR-560 θ/ι root cause).
  // ADR-557 — ΚΑΙ μόνο ΔΙΑΚΡΙΤΟΥΣ στόχους (άκρο/μέσο/κέντρο/τομή): μια construction-line έλξη
  // (extension/perpendicular/parallel/…) υπάρχει ΠΑΝΤΟΥ και, μετρώντας ως «osnapFound», πνίγει τα
  // AutoAlign κυανά — ένα MTEXT που σέρνεται περνούσε συνέχεια πάνω από extension ακτίνες γειτονικών
  // γραμμών κι έχανε τις κυανές ενδείξεις (Giorgio browser-verify 2026-07-07). ΙΔΙΟ φίλτρο με το
  // corner-projection (`isDiscreteSnapTarget`/`NON_CORNER_TARGET_MODES`) → ΕΝΑ SSoT. Το corner-projection
  // result είναι ήδη διακριτό, οπότε ένα construction `picked` προέρχεται πάντα από το cursor fallback.
  return picked?.visible && isDiscreteSnapTarget(picked.snapResult)
    ? { snapResult: picked.snapResult, moveWorldPos: picked.ghostPoint }
    : null;
}

/** Ο SnapResultItem της γλυφής (React draw path) από ένα resolved snap. */
function toSnapResultItem(snapResult: ProSnapResult): SnapResultItem {
  return {
    point: snapResult.snappedPoint!,
    type: snapResult.activeMode || 'default',
    entityId: snapResult.snapPoint?.entityId || null,
    distance: snapResult.snapPoint?.distance || 0,
    priority: 0,
  };
}

/**
 * Δημοσιεύει ΜΙΑ φορά το grip snap και στα 3 κανάλια (marker overlay SSoT `setFullSnapResult`,
 * ghost cursor `setImmediateSnap`, React draw path `setSnapResults`). Αντικαθιστά το 3×copy-paste
 * του move handler. Μόνο για preview (το commit δεν δείχνει marker).
 */
export function publishGripSnap(
  snapResult: ProSnapResult,
  setSnapResults: (results: SnapResultItem[]) => void,
): void {
  setSnapResults([toSnapResultItem(snapResult)]);
  setFullSnapResult(snapResult);
  setImmediateSnap({
    found: true,
    point: snapResult.snappedPoint!,
    mode: snapResult.activeMode || 'endpoint',
    entityId: snapResult.snapPoint?.entityId,
  });
}

/** Καθαρίζει και τα 3 snap κανάλια (καμία ορατή έλξη κοντά στον cursor). */
export function clearGripSnap(setSnapResults: (results: SnapResultItem[]) => void): void {
  setSnapResults([]);
  setFullSnapResult(null);
  clearImmediateSnap();
}
