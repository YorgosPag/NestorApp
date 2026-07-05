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
import type { ExtendedSceneEntity } from './drawing-types';
import { beamPreviewStore } from '../../bim/beams/beam-preview-store';
import {
  buildAnchoredBeamParams,
  buildBeamEntity,
  buildDefaultBeamParams,
  type BeamParamOverrides,
  type SceneUnits,
} from './beam-completion';
import { DEFAULT_BEAM_WIDTH_MM, DEFAULT_BEAM_DEPTH_MM, type BeamKind, type BeamParams } from '../../bim/types/beam-types';
// ADR-564 §linear-hud — το δοκάρι (γραμμικό μέλος) ξαναχρησιμοποιεί ΤΟΝ ΙΔΙΟ live HUD painter με τον
// τοίχο (μήκος + ∠ γωνία + διατομή)· η μόνη διαφορά είναι η ετικέτα διατομής («b·h» αντί «πάχος·ύψος»).
import { buildSegmentHudMeta, type WallHudMeta } from '../../canvas-v2/preview-canvas/wall-hud-paint';
import { buildBeamHudSpecLabel } from './beam-hud-spec-label';
import type { Point3D } from '../../bim/types/bim-base';
import { buildBeamCutbackDisplay } from '../canvas/dxf-scene-beam-cutback';
import { getDefaultLayerId } from '../../stores/LayerStore';
import { mmToSceneUnits } from '../../utils/scene-units';
import { BEAM_GHOST_LEN_MM } from '../../bim/beams/beam-column-face-snap';
import { resolveBimCursorSnap } from '../../bim/placement/bim-cursor-snap';
import { resolveMemberEndpointSnap, resolveMemberEndpointWithFineStep } from '../../bim/framing/member-endpoint-snap';
// ADR-513 — «Δαχτυλίδι Εντολών» precedence: ενεργό length/angle lock ΝΙΚΑ το endpoint face-snap
// (ίδιο SSoT με τον τοίχο). Ο cursor έρχεται ΗΔΗ locked από το `drawing-hover-handler` → μηδέν override.
import { isLengthAngleLockActive } from '../../systems/dynamic-input/length-angle-lock';
import { buildMemberMagnetOptions } from '../../bim/placement/member-magnet-opts';
import { buildPlacementGridMeta } from '../../bim/placement/placement-grid-meta';
import { findRectContaining, resolveRectCartesianDims } from '../../bim/columns/rect-cartesian-snap';
import { isBeamCollinearOverlap, type BeamSnapTarget } from '../../bim/beams/beam-beam-face-snap';
import type { GhostFaceFrame } from '../../bim/framing/linear-member-face-snap';
import { sceneSnapTargetsStore, selectGhostMembers, type SceneSnapTargets } from '../../bim/framing/scene-snap-targets';
import { resolveGhostStatusColor } from '../../bim/ghosts/ghost-status-color';
import {
  resolveEffectivePreviewCursor,
  toWysiwygPreviewEntity,
  resolveGhostFaceDimensionsMeta,
} from './wysiwyg-preview-shared';
import { getImmediateTransform } from '../../systems/cursor/ImmediateTransformStore';
import { worldPerPixel } from '../../rendering/utils/viewport-scale';


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
  // ADR-398 §3.10 — face-snap στόχοι από το ΚΟΙΝΟ scene store.
  const targets = sceneSnapTargetsStore.get();
  const footprints = targets.footprints;
  // SNAP target set (Giorgio 2026-06-24 «ίδια συμπεριφορά με κολόνα/τοίχο») — το ΑΚΡΟ/ghost κουμπώνει σε
  // τοίχους + δοκάρια + πλάκες + γραμμές (ΙΔΙΟ με τον τοίχο) → σιελ listening dims ΚΑΙ κοντά σε τοίχο.
  const snapMembers = selectGhostMembers(targets, ['wall', 'beam', 'slab', 'line']);
  // OVERLAP/collision set — ΜΟΝΟ δοκάρια+πλάκες: ένα δοκάρι κατά μήκος τοίχου είναι έγκυρο (όχι duplication).
  const beamTargets = selectGhostMembers(targets, ['beam', 'slab']);

  if (tempPoints.length === 0) {
    // ADR-398 §Smart beam ghost — πριν το 1ο κλικ: μικρό έξυπνο φάντασμα. Κοντά σε
    // κολόνα → κουμπώνει σε παρειά/anchor (centerline start/end)· αλλιώς ακολουθεί
    // ελεύθερα τον κέρσορα (ευθύ μικρό ghost). Pure — reuse του face-snap SSoT.
    return makeBeamGhostBeforeClick(cursorPoint, preview.kind, preview.overrides, sceneUnits, targets, beamTargets);
  }

  const startPt = tempPoints[0];

  if (tempPoints.length === 1) {
    // awaitingEnd: straight/cantilever rectangle (curved χωρίς control = ευθεία).
    // `startAnchored` (face-snapped start) → centerline mode (χωρίς location-line auto-flush).
    // ADR-508 — endpoint face-snap (ΙΔΙΟ SSoT με τον τοίχο, `resolveMemberEndpointSnap`): το ΑΚΡΟ
    // κουμπώνει/γλιστρά flush σε παρειά μέλους/κολώνας (συνεχής ολίσθηση, ΙΔΙΟΣ dispatcher με το start
    // → preview ≡ commit) + Shift 1cm βήμα στο ελεύθερο (face-snap νικά). Μόνο straight/cantilever
    // (curved → raw cursor· το άκρο ορίζεται από το control point).
    // ADR-513 — precedence: όταν το «Δαχτυλίδι Εντολών» έχει ενεργό length/angle lock, ο cursor έρχεται
    // ΗΔΗ locked (drawing-hover-handler:beam) → skip το face-snap ώστε το lock να ΝΙΚΑ (ίδιο με τον τοίχο).
    const widthMm = preview.overrides.width ?? DEFAULT_BEAM_WIDTH_MM;
    const depthMm = preview.overrides.depth ?? DEFAULT_BEAM_DEPTH_MM;
    let endPt = cursorPoint;
    let endFaceFrame: GhostFaceFrame | null = null;
    if (preview.kind !== 'curved' && !isLengthAngleLockActive()) {
      const endSnap = resolveMemberEndpointSnap(cursorPoint, footprints, snapMembers, widthMm, sceneUnits);
      endPt = resolveMemberEndpointWithFineStep(endSnap, startPt);
      endFaceFrame = endSnap.faceFrame ?? null;
    }
    // ADR-564 §linear-hud — ζωντανή ταυτότητα δοκαριού (μήκος + ∠ γωνία + διατομή «b·h»), ΚΟΙΝΟΣ
    // painter με τον τοίχο (`buildSegmentHudMeta`→`paintWallHud`). Μόνο ευθύ/πρόβολο (curved → χωρίς
    // aligned axis· το άκρο ορίζεται από το control point). Το τόξο φοράς το ζωγραφίζει ο handler.
    const hudMeta = preview.kind !== 'curved' ? buildSegmentHudMeta(startPt, endPt, sceneUnits, widthMm, depthMm) : null;
    const hudSpecLabel = hudMeta ? buildBeamHudSpecLabel(widthMm, depthMm) : null;
    return makeBeamWysiwygGhost('preview_beam_footprint', startPt, endPt, preview.kind, preview.overrides, sceneUnits, null, footprints, preview.startAnchored, beamTargets, endFaceFrame, hudMeta, hudSpecLabel);
  }

  // awaitingCurveControl (curved): cursor = quadratic Bezier control point.
  const endPt = tempPoints[1];
  return makeBeamWysiwygGhost('preview_beam_curve', startPt, endPt, 'curved', preview.overrides, sceneUnits, cursorPoint, footprints, false, beamTargets);
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
  targets: Readonly<SceneSnapTargets>,
  beamTargets: readonly BeamSnapTarget[],
): ExtendedSceneEntity | null {
  // ADR-398 §Smart beam ghost (2026-06-20 fix) — το crosshair ζωγραφίζεται στο
  // **snapped** σημείο (`ImmediateSnap`), ενώ ο preview hover περνά RAW cursor (το
  // `processDrawingHover` ΔΕΝ εφαρμόζει το βασικό OSNAP/grid πριν το 1ο κλικ). Κοινό
  // SSoT `resolveEffectivePreviewCursor` → ο άξονας του ghost ταυτίζεται με το σταυρόνημα.
  const effectiveCursor = resolveEffectivePreviewCursor(cursorPoint);
  const widthMm = overrides.width ?? DEFAULT_BEAM_WIDTH_MM;
  // ADR-398 §3.13/§3.15 (Giorgio 2026-06-24) — Polar/Rect Magnet opts (ΙΔΙΟ SSoT με κολόνα), ώστε το
  // φάντασμα δοκαριού να κουμπώνει σε πολικό/καρτεσιανό πλέγμα μέσα σε κύκλο/ορθογώνιο ΟΠΩΣ η κολόνα.
  const magnetOpts = buildMemberMagnetOptions(widthMm, sceneUnits);
  // ADR-514 Φ3 — «Ένας Εγκέφαλος Έλξης»: ΕΝΑ unified entry (toolKind:'beam'). Snap σε τοίχους+δοκάρια+
  // πλάκες+γραμμές (Giorgio 2026-06-24 «ίδια συμπεριφορά με κολόνα» → σιελ ενδείξεις ΚΑΙ κοντά σε τοίχο).
  // ⚠️ ADR-514 §2 — ο effectiveCursor είναι ήδη snapped → ΧΩΡΙΣ findSnapPoint (anti double-snap).
  // ΙΔΙΟ entry με το commit (`useBeamTool.resolveStartAnchor`) → preview ≡ commit by construction.
  // ADR-528 — auto-span μόνο για straight/cantilever (curved δοκάρι δεν γεφυρώνει· ορίζεται από control).
  const snapResult = resolveBimCursorSnap({ toolKind: 'beam', cursor: effectiveCursor, targets, sceneUnits, memberWidthMm: widthMm, memberKinds: ['wall', 'beam', 'slab', 'line'], magnetOpts, beamSpanGhost: kind !== 'curved' });
  const snap = snapResult.kind === 'member-placement' ? snapResult.placement : null;
  const start: Point2D = snap ? snap.start : { x: effectiveCursor.x, y: effectiveCursor.y };
  const end: Point2D = snap
    ? snap.end
    : { x: effectiveCursor.x + BEAM_GHOST_LEN_MM * mmToSceneUnits(sceneUnits), y: effectiveCursor.y };
  const params = buildDefaultBeamParams(start, end, kind, overrides, sceneUnits);
  const built = buildBeamEntity(params, getDefaultLayerId(), sceneUnits);
  if (!built.ok) return null;
  // ADR-398 §3.6 — 🔴 `overlap` όταν: (α) short-end συγγραμμική συνέχεια (`snap.status`), Ή
  // (β) το φάντασμα κείτεται ομοαξονικά/πάνω σε υφιστάμενο δοκάρι (`isBeamCollinearOverlap` —
  // πιάνει ΚΑΙ το εφεδρικό free-fallback ghost που έπεφτε ομοαξονικό σε οριζόντιο δοκάρι).
  // 🟢 `beam` (έγκυρο κάθετο Τ-framing) & `neutral` → WYSIWYG amber αυτούσιο (decision A).
  const isOverlap = snap?.status === 'overlap' || isBeamCollinearOverlap(start, end, beamTargets);
  const ghostStatusColor = isOverlap ? resolveGhostStatusColor('overlap') : null;
  // ADR-508 §dim — listening dimensions (ίδιος SSoT με τοίχο): μόνο όταν το ghost γλιστράει 🟢
  // πάνω σε παρειά μέλους (`snap.faceFrame` υπάρχει) και δεν είναι 🔴 overlap.
  const wpp = worldPerPixel(getImmediateTransform().scale);
  // ADR-398 §3.15 (ΙΔΙΟ SSoT με κολόνα) — cursor μέσα σε ορθογώνιο → 4 καρτεσιανά dx/dy dims (αντί του
  // faceFrame straight branch)· αλλιώς → R/θ ή straight listening dims από το faceFrame του snap.
  const rect = findRectContaining(effectiveCursor, targets.rectTargets);
  const faceDimensions = (rect && snap && !isOverlap)
    ? { sceneUnits, dims: resolveRectCartesianDims(rect, snap.start) }
    : resolveGhostFaceDimensionsMeta(snap?.faceFrame, isOverlap, sceneUnits, wpp);
  const ghost = toWysiwygPreviewEntity(built.entity, 'preview_beam_ghost', ghostStatusColor, faceDimensions);
  // ADR-398 §3.13/§3.15 (Giorgio 2026-06-24) — attach το πλέγμα (πολικό ή καρτεσιανό) ως ghost metadata
  // (ΚΟΙΝΟ SSoT helper με την κολόνα)· ο `drawing-hover-handler` το ζωγραφίζει ως overlay.
  const grid = buildPlacementGridMeta(effectiveCursor, targets, sceneUnits, magnetOpts);
  // ADR-528 — η νοητή ευθεία κέντρο→κέντρο του auto-span ως `alignmentGuide` (canonical SSoT· το ίδιο
  // paint pipeline με τους column οδηγούς ζωγραφίζει την πράσινη/dashed γραμμή· δείχνει ΠΟΙΟ φάτνωμα κούμπωσε).
  const extra = snap?.guide ? { ...grid, alignmentGuide: snap.guide } : grid;
  return Object.keys(extra).length ? ({ ...ghost, ...extra } as typeof ghost) : ghost;
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
  endFaceFrame: GhostFaceFrame | null = null,
  hudMeta: WallHudMeta | null = null,
  hudSpecLabel: string | null = null,
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
  const built = buildBeamEntity(params, getDefaultLayerId(), sceneUnits);
  if (!built.ok) return null;
  const entity = built.entity;

  // ADR-398 §3.6 — αν το rubber-band δοκάρι θα κείτεται ομοαξονικά/πάνω σε υφιστάμενο
  // (duplication) → 🔴 κόκκινο schematic + μπλοκάρισμα commit (στο `useBeamTool`). Κάθετο
  // Τ-framing αποκλείεται (μη παράλληλο). straight/cantilever μόνο.
  const isOverlap = kind !== 'curved' && isBeamCollinearOverlap(startPt, endPt, beamTargets);
  const ghostStatusColor = isOverlap ? resolveGhostStatusColor('overlap') : null;
  // ADR-508 §dim — listening dimensions στο ENDPOINT όταν το ΑΚΡΟ κούμπωσε flush σε παρειά (ΙΔΙΟ
  // SSoT με τον τοίχο, `resolveGhostFaceDimensionsMeta`· κρύβονται σε 🔴 overlap μέσα στο helper).
  const endDims = endFaceFrame
    ? resolveGhostFaceDimensionsMeta(endFaceFrame, isOverlap, sceneUnits, worldPerPixel(getImmediateTransform().scale))
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
      return toWysiwygPreviewEntity(displayEntity, id, ghostStatusColor, endDims, null, hudMeta, hudSpecLabel);
    }
  }
  return toWysiwygPreviewEntity(entity, id, ghostStatusColor, endDims, null, hudMeta, hudSpecLabel);
}
