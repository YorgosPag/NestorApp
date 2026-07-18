/**
 * SSOT — grip-ghost-locked-delta
 *
 * Η ΜΙΑ σκάλα προτεραιότητας των «κλειδωμένων» delta που εφαρμόζονται στο ghost μιας λαβής
 * (grip drag), πριν τον υπολογισμό της τελικής γεωμετρίας. Κάθε resolver εδώ τρέχει **και στο
 * commit** (`grip-mouseup`), οπότε το preview ταυτίζεται με το commit εξ ορισμού — αν αλλάξει η
 * σειρά ή ένα gate, αλλάζει σε ΕΝΑ σημείο και για τα δύο.
 *
 * Σειρά (αμοιβαία αποκλειόμενα grip kinds — το πρώτο που «πιάνει» κερδίζει):
 *   1. **Πλάτος κουφώματος** — λαβή παρειάς, μήκος κατά τον άξονα του τοίχου (ADR-513 §opening-width)
 *   2. **Άκρο γραμμής** — Μήκος/Γωνία στο grip 0/1 (ADR-513 §grip-parity)
 *   3. **Vertex/edge reshape** — displacement Model A σε τόξο/πολυγραμμή/προβεβλημένο ορθογώνιο
 *   4. **POLAR angle-snap άκρου** — γύρω από τον ΣΤΑΘΕΡΟ γείτονα (ADR-357/513 §grip-polar)
 *   5. **Μετακίνηση ολόκληρης οντότητας** — displacement Model A σε λαβή `movesEntity` (ADR-513 §grip-parity)
 *
 * Γιατί χωριστό module (2026-07-18): εξήχθη από το `useGripGhostPreview` όταν εκείνο πέρασε το
 * όριο των 500 γραμμών (N.7.1). Το όριο είναι σημασιολογικό — αυτή είναι καθαρή, testable
 * λογική **χωρίς React**, ενώ το hook είναι RAF/canvas ενορχήστρωση.
 *
 * @see ./useGripGhostPreview — ο καταναλωτής (RAF draw loop)
 * @see ADR-513 — Radial Command Ring (§grip-parity, §opening-width)
 * @see ADR-357 — ORTHO/POLAR SSoT
 */

import type { Point2D } from '../../rendering/types/Types';
import type { WallEntity } from '../../bim/types/wall-types';
import type { LevelSceneReader } from '../../systems/levels/level-scene-accessor';
import type { DxfGripDragPreview } from '../grip-computation';
import { gripKindOf } from '../grip-kinds';
// ADR-508 §grip-tracking — καθολικό POLAR σε reshape λαβές πολυγωνικών BIM (κολόνα/πλάκα/…).
import { resolveActiveFootprintGripKind } from '../../systems/grip/footprint-reshape-anchors';
import { resolveLineEndpointLockedDelta } from '../../systems/dynamic-input/grip-endpoint-lock';
import { resolveVertexReshapeLockedDelta } from '../../systems/dynamic-input/vertex-reshape-lock';
import { resolveOpeningWidthLockedDelta, isOpeningCornerGripKind } from '../../systems/dynamic-input/opening-width-lock';
// ADR-513 §grip-parity — 5ο σκαλί: typed «Μήκος» σε λαβή ΜΕΤΑΚΙΝΗΣΗΣ ολόκληρης οντότητας.
import { resolveMoveDisplacementLockedDelta } from '../../systems/dynamic-input/move-displacement-lock';
import { resolveEndpointReshapePolarLock, type EndpointReshapePolarLock } from '../grips/grip-endpoint-polar-lock';

/** Το αποτέλεσμα ενός κλειδώματος: το delta που αντικαθιστά το ελεύθερο drag + το polar context. */
export interface GripGhostLockedDelta {
  /** Το delta που εφαρμόζεται στη λαβή αντί του ελεύθερου `dp.delta`. */
  readonly delta: Point2D;
  /**
   * Μη-null **μόνο** όταν κέρδισε ο POLAR angle-snap του άκρου — ο καταναλωτής το χρειάζεται
   * για το HUD (ακτίνα/γωνία). Στα υπόλοιπα κλειδώματα δεν υπάρχει polar context.
   */
  readonly endpointPolar: EndpointReshapePolarLock | null;
}

/**
 * Βρίσκει τον host τοίχο ενός κουφώματος — φθηνό gate: αναλύεται **μόνο** για λαβή παρειάς
 * (wall-axial πλαίσιο), όχι για περιστροφή κουφώματος.
 */
function resolveOpeningHostWall(
  entity: unknown,
  levelManager: LevelSceneReader,
): WallEntity | null {
  const wallId = (entity as { params?: { wallId?: string } } | null | undefined)?.params?.wallId;
  if (!wallId || !levelManager.currentLevelId) return null;
  const scene = levelManager.getLevelScene(levelManager.currentLevelId);
  return ((scene?.entities ?? []).find((e) => e.id === wallId) as WallEntity | undefined) ?? null;
}

/**
 * Εφαρμόζει τη σκάλα προτεραιότητας και επιστρέφει το πρώτο κλείδωμα που ισχύει, ή `null` όταν
 * κανένα δεν ενεργοποιείται (ελεύθερο drag — ο καλών κρατά το δικό του `dp.delta`).
 *
 * Καθαρή συνάρτηση ως προς την είσοδο· διαβάζει κατάσταση μόνο μέσω των ίδιων stores που
 * διαβάζει και το commit (`DynamicInputLockStore`, `cadToggleState`) — γι' αυτό preview ≡ commit.
 */
export function resolveGripGhostLockedDelta(
  entity: unknown,
  dp: DxfGripDragPreview,
  anchorPos: Readonly<Point2D>,
  cursorWorld: Readonly<Point2D>,
  levelManager: LevelSceneReader,
): GripGhostLockedDelta | null {
  // 1 — ΠΛΑΤΟΣ ΚΟΥΦΩΜΑΤΟΣ (λαβή παρειάς): η διεύθυνση είναι κλειδωμένη στον άξονα του τοίχου.
  const openingKind = gripKindOf(dp, 'opening');
  if (isOpeningCornerGripKind(openingKind)) {
    const openingWidthDelta = resolveOpeningWidthLockedDelta(
      resolveOpeningHostWall(entity, levelManager), openingKind, anchorPos, cursorWorld,
    );
    if (openingWidthDelta) return { delta: openingWidthDelta, endpointPolar: null };
  }

  // ADR-602 Stage 4 — διαβάζεται ×2 παρακάτω· invariant για όλη τη σκάλα.
  const lineKind = gripKindOf(dp, 'line');

  // 2 — ΑΚΡΟ ΓΡΑΜΜΗΣ: Μήκος/Γωνία στο grip 0/1.
  const lockedDelta = resolveLineEndpointLockedDelta(entity, dp.gripIndex, lineKind, anchorPos, cursorWorld);
  if (lockedDelta) return { delta: lockedDelta, endpointPolar: null };

  // 3 — VERTEX/EDGE RESHAPE: displacement (Model A) σε τόξο/πολυγραμμή ή μέσο ευθείας πλευράς
  // (incl. προβεβλημένο ορθογώνιο) — κατεύθυνση ORTHO/POLAR + πληκτρολογούμενο «Μήκος».
  const vertexDelta = resolveVertexReshapeLockedDelta(
    entity,
    {
      gripIndex: dp.gripIndex,
      movesEntity: dp.movesEntity,
      polylineKind: gripKindOf(dp, 'polyline'),
      isEdge: dp.edgeVertexIndices != null,
    },
    anchorPos, cursorWorld,
  );
  if (vertexDelta) return { delta: vertexDelta, endpointPolar: null };

  // 4 — POLAR angle-snap του ΑΚΡΟΥ (γραμμή grip 0/1 ή ανοιχτό polyline endpoint) γύρω από τον
  // ΣΤΑΘΕΡΟ γείτονα, ΙΔΙΟ SSoT με τη σχεδίαση (`resolveOrthoPolarStep`). No-op όταν POLAR off,
  // ORTHO on, δεν είναι άκρο, ή ο κέρσορας δεν κούμπωσε σε polar ακτίνα.
  const endpointPolar = resolveEndpointReshapePolarLock(
    entity, dp.gripIndex, lineKind, anchorPos, cursorWorld, resolveActiveFootprintGripKind(dp),
  );
  if (endpointPolar) return { delta: endpointPolar.delta, endpointPolar };

  // 5 — ΜΕΤΑΚΙΝΗΣΗ ΟΛΟΚΛΗΡΗΣ ΟΝΤΟΤΗΤΑΣ (move-σταυρός / Alt-move): displacement (Model A) — κατεύθυνση
  // ORTHO/POLAR από το σημείο βάσης + πληκτρολογούμενο «Μήκος». ΤΕΛΕΥΤΑΙΟ σκαλί επίτηδες: τα 1-4
  // αφορούν λαβές που ΑΝΑΜΟΡΦΩΝΟΥΝ (κορυφή/άκρο/παρειά, όλα `movesEntity !== true`), οπότε είναι
  // αμοιβαία αποκλειόμενα με αυτό — η σειρά δεν μπορεί να «κλέψει» λαβή από τα προηγούμενα.
  const moveDelta = resolveMoveDisplacementLockedDelta(
    { movesEntity: dp.movesEntity, isRotation: dp.rotatePivot != null }, anchorPos, cursorWorld,
  );
  if (moveDelta) return { delta: moveDelta, endpointPolar: null };

  return null;
}
