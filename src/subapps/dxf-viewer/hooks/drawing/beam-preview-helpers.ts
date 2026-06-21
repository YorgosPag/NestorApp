/**
 * @module beam-preview-helpers
 * @description Pure helper for beam tool real-time preview rendering.
 * Mirror of `wall-preview-helpers.ts` (ADR-363 Phase 1C).
 *
 * Exported: generateBeamPreview()
 *
 * WYSIWYG placement (2026-06-17): η rubber-band επιστρέφει ΠΛΗΡΕΣ `BeamEntity`
 * (μέσω του SSoT `buildBeamEntity` — ίδιος builder με το commit) flagged
 * `wysiwygPreview`, οπότε ο PreviewCanvas το ζωγραφίζει μέσω του πραγματικού
 * `BeamRenderer` (amber fill / material hatch / lineweight / axis) αντί για
 * πράσινο outline με δυναμικές αποστάσεις + εμβαδόν. Το ghost ΕΙΝΑΙ το τελικό
 * δοκάρι. Επιπλέον το placement είναι edge-anchored (location line = παρειά)
 * μέσω του `buildAnchoredBeamParams` (straight/cantilever· curved → centerline).
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import type { ExtendedSceneEntity } from './drawing-types';
import { beamPreviewStore } from '../../bim/beams/beam-preview-store';
import {
  buildAnchoredBeamParams,
  buildBeamEntity,
  buildDefaultBeamParams,
  type BeamParamOverrides,
  type SceneUnits,
} from './beam-completion';
import { DEFAULT_BEAM_WIDTH_MM, type BeamKind, type BeamParams } from '../../bim/types/beam-types';
import type { Point3D } from '../../bim/types/bim-base';
import { buildBeamCutbackDisplay } from '../canvas/dxf-scene-beam-cutback';
import { DXF_DEFAULT_LAYER } from '../../config/layer-config';
import { getLayer } from '../../stores/LayerStore';
import { mmToSceneUnits } from '../../utils/scene-units';
import {
  resolveBeamGhostSnapFromStore,
  BEAM_GHOST_LEN_MM,
} from '../../bim/beams/beam-column-face-snap';
import { isBeamCollinearOverlap, type BeamSnapTarget } from '../../bim/beams/beam-beam-face-snap';
import { collectMemberSnapTargets } from '../../bim/framing/member-snap-targets';
import { resolveGhostStatusColor } from '../../bim/ghosts/ghost-status-color';
import { resolveEffectivePreviewCursor, toWysiwygPreviewEntity } from './wysiwyg-preview-shared';

const defaultLayerId = (): string => getLayer(DXF_DEFAULT_LAYER)?.id ?? '';

/** Face-snap targets collected from the live scene for the beam tool's ghost/preview. */
export interface BeamSnapTargets {
  readonly footprints: Point2D[][];
  readonly beamTargets: BeamSnapTarget[];
}

/**
 * ADR-398 §3.6 / ADR-508 — μάζεψε τους face-snap στόχους από τη σκηνή για το beam ghost/preview.
 * Κολόνες → footprint πολύγωνα (cutback + ghost flush)· υφιστάμενα δοκάρια → axis+outline
 * (beam-to-beam Τ-framing). Delegate στο generic SSoT `collectMemberSnapTargets` (κοινό με τον
 * τοίχο)· `memberKinds: ['beam']` → η συμπεριφορά δοκαριού μένει αμετάβλητη (δοκάρια+κολόνες,
 * ΟΧΙ τοίχοι). Pure: ΙΔΙΑ δεδομένα που διαβάζει το commit path (preview === commit).
 */
export function collectBeamSnapTargets(entities: readonly Entity[]): BeamSnapTargets {
  const { footprints, memberTargets } = collectMemberSnapTargets(entities, { memberKinds: ['beam'] });
  return { footprints, beamTargets: memberTargets };
}

/**
 * Build a beam preview entity from `tempPoints` + cursor. State machine map:
 *   - [] (awaitingStart) → cursor start marker
 *   - [start] → WYSIWYG beam ghost start→cursor (real `BeamRenderer`)
 *   - [start, end] → WYSIWYG curved beam ghost (cursor = Bezier control)
 *
 * WYSIWYG: returns a full `BeamEntity` (flagged `wysiwygPreview`) so the ghost
 * matches the committed entity byte-for-byte. Returns `null` on a degenerate /
 * invalid frame so the preview simply clears that frame.
 */
export function generateBeamPreview(
  tempPoints: readonly Point2D[],
  cursorPoint: Point2D,
  sceneUnits: SceneUnits = 'mm',
): ExtendedSceneEntity | null {
  const preview = beamPreviewStore.get();

  if (tempPoints.length === 0) {
    // ADR-398 §Smart beam ghost — πριν το 1ο κλικ: μικρό έξυπνο φάντασμα. Κοντά σε
    // κολόνα → κουμπώνει σε παρειά/anchor (centerline start/end)· αλλιώς ακολουθεί
    // ελεύθερα τον κέρσορα (ευθύ μικρό ghost). Pure — reuse του face-snap SSoT.
    return makeBeamGhostBeforeClick(cursorPoint, preview.kind, preview.overrides, sceneUnits, preview.columnFootprints, preview.beamTargets);
  }

  const startPt = tempPoints[0];

  if (tempPoints.length === 1) {
    // awaitingEnd: straight/cantilever rectangle (curved χωρίς control = ευθεία).
    // `startAnchored` (face-snapped start) → centerline mode (χωρίς location-line auto-flush).
    return makeBeamWysiwygGhost('preview_beam_footprint', startPt, cursorPoint, preview.kind, preview.overrides, sceneUnits, null, preview.columnFootprints, preview.startAnchored, preview.beamTargets);
  }

  // awaitingCurveControl (curved): cursor = quadratic Bezier control point.
  const endPt = tempPoints[1];
  return makeBeamWysiwygGhost('preview_beam_curve', startPt, endPt, 'curved', preview.overrides, sceneUnits, cursorPoint, preview.columnFootprints, false, preview.beamTargets);
}

/**
 * ADR-398 §Smart beam ghost — το φάντασμα πριν το 1ο κλικ (`awaitingStart`).
 *
 * Κοντά σε κολόνα: ο `resolveBeamGhostSnapFromStore` επιστρέφει το centerline start/end
 * (παρειά + anchor third). Μακριά: ευθύ μικρό ghost από τον κέρσορα προς +X (ακολουθεί
 * ελεύθερα). Πάντα **centerline mode** (`buildDefaultBeamParams`) ώστε το φάντασμα να
 * δείχνει ΑΚΡΙΒΩΣ το σημείο που θα κλειδώσει το 1ο κλικ (preview === commit). Επιστρέφει
 * `null` σε degenerate frame → ο preview απλώς καθαρίζει.
 */
function makeBeamGhostBeforeClick(
  cursorPoint: Readonly<Point2D>,
  kind: BeamKind,
  overrides: BeamParamOverrides,
  sceneUnits: SceneUnits,
  columnFootprints: readonly (readonly Point2D[])[],
  beamTargets: readonly BeamSnapTarget[],
): ExtendedSceneEntity | null {
  // ADR-398 §Smart beam ghost (2026-06-20 fix) — το crosshair ζωγραφίζεται στο
  // **snapped** σημείο (`ImmediateSnap`), ενώ ο preview hover περνά RAW cursor (το
  // `processDrawingHover` ΔΕΝ εφαρμόζει το βασικό OSNAP/grid πριν το 1ο κλικ). Κοινό
  // SSoT `resolveEffectivePreviewCursor` → ο άξονας του ghost ταυτίζεται με το σταυρόνημα.
  const effectiveCursor = resolveEffectivePreviewCursor(cursorPoint);
  const widthMm = overrides.width ?? DEFAULT_BEAM_WIDTH_MM;
  const snap = resolveBeamGhostSnapFromStore(effectiveCursor, columnFootprints, beamTargets, widthMm, sceneUnits);
  const start: Point2D = snap ? snap.start : { x: effectiveCursor.x, y: effectiveCursor.y };
  const end: Point2D = snap
    ? snap.end
    : { x: effectiveCursor.x + BEAM_GHOST_LEN_MM * mmToSceneUnits(sceneUnits), y: effectiveCursor.y };
  const params = buildDefaultBeamParams(start, end, kind, overrides, sceneUnits);
  const built = buildBeamEntity(params, defaultLayerId(), sceneUnits);
  if (!built.ok) return null;
  // ADR-398 §3.6 — 🔴 `overlap` όταν: (α) short-end συγγραμμική συνέχεια (`snap.status`), Ή
  // (β) το φάντασμα κείτεται ομοαξονικά/πάνω σε υφιστάμενο δοκάρι (`isBeamCollinearOverlap` —
  // πιάνει ΚΑΙ το εφεδρικό free-fallback ghost που έπεφτε ομοαξονικό σε οριζόντιο δοκάρι).
  // 🟢 `beam` (έγκυρο κάθετο Τ-framing) & `neutral` → WYSIWYG amber αυτούσιο (decision A).
  const isOverlap = snap?.status === 'overlap' || isBeamCollinearOverlap(start, end, beamTargets);
  const ghostStatusColor = isOverlap ? resolveGhostStatusColor('overlap') : null;
  return toWysiwygPreviewEntity(built.entity, 'preview_beam_ghost', ghostStatusColor);
}

/**
 * Build a full `BeamEntity` preview via the SSoT `buildBeamEntity` (same builder
 * as commit). Straight/cantilever → edge-anchored params (Revit location-line,
 * `buildAnchoredBeamParams`)· curved → centerline params (anchor ambiguous on a
 * curve). Returns `null` on a degenerate/invalid frame.
 */
function makeBeamWysiwygGhost(
  id: string,
  startPt: Readonly<Point2D>,
  endPt: Readonly<Point2D>,
  kind: BeamKind,
  overrides: BeamParamOverrides,
  sceneUnits: SceneUnits,
  curveControl: Point2D | null,
  columnFootprints: readonly (readonly Point2D[])[],
  startAnchored: boolean,
  beamTargets: readonly BeamSnapTarget[],
): ExtendedSceneEntity | null {
  let params: BeamParams;
  if (kind === 'curved') {
    const base = buildDefaultBeamParams(startPt, endPt, 'curved', overrides, sceneUnits);
    params = curveControl
      ? { ...base, kind: 'curved', curveControl: { x: curveControl.x, y: curveControl.y, z: 0 } as Point3D }
      : base;
  } else if (startAnchored) {
    // ADR-398 §Smart beam ghost — το start κλειδώθηκε από face-snap (ΗΔΗ centerline) →
    // centerline mode (ΟΧΙ location-line auto-flush, που θα ξανα-μετατόπιζε το start).
    params = buildDefaultBeamParams(startPt, endPt, kind, overrides, sceneUnits);
  } else {
    // ADR-363 §5.7 — ίδια column footprints με το commit (store SSoT) → side-face
    // auto-flush identical σε preview & committed (preview === commit).
    params = buildAnchoredBeamParams(startPt, endPt, kind, overrides, sceneUnits, columnFootprints);
  }
  const built = buildBeamEntity(params, defaultLayerId(), sceneUnits);
  if (!built.ok) return null;
  const entity = built.entity;

  // ADR-398 §3.6 — αν το rubber-band δοκάρι θα κείτεται ομοαξονικά/πάνω σε υφιστάμενο
  // (duplication) → 🔴 κόκκινο schematic + μπλοκάρισμα commit (στο `useBeamTool`). Κάθετο
  // Τ-framing αποκλείεται (μη παράλληλο). straight/cantilever μόνο.
  const ghostStatusColor =
    kind !== 'curved' && isBeamCollinearOverlap(startPt, endPt, beamTargets)
      ? resolveGhostStatusColor('overlap')
      : null;

  // ADR-458 — εφάρμοσε το ΙΔΙΟ beam-to-column cutback (frame-into) με το committed
  // δοκάρι (κοινό SSoT `buildBeamCutbackDisplay`), ώστε το preview να δείχνει την
  // οντότητα να «μπαίνει» στις κολόνες αντί να τις υπερκαλύπτει. straight/cantilever
  // μόνο (το displayAxisPolyline προσαρμόζεται σε 2-σημείων άξονα).
  if (kind !== 'curved' && columnFootprints.length > 0) {
    const display = buildBeamCutbackDisplay(
      entity.geometry.outline.vertices,
      entity.geometry.axisPolyline.points,
      columnFootprints,
    );
    if (display) {
      const displayEntity = {
        ...entity,
        geometry: {
          ...entity.geometry,
          displayOutline: display.displayOutline,
          ...(display.displayAxisPolyline ? { displayAxisPolyline: display.displayAxisPolyline } : {}),
        },
      };
      return toWysiwygPreviewEntity(displayEntity, id, ghostStatusColor);
    }
  }
  return toWysiwygPreviewEntity(entity, id, ghostStatusColor);
}
