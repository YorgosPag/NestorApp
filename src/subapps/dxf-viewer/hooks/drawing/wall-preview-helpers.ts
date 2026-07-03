/**
 * @module wall-preview-helpers
 * @description Pure helper functions for wall tool real-time preview rendering.
 * Extracted from drawing-preview-generator.ts (ADR-363 Phase 1C).
 *
 * Exported: generateWallPreview()
 *
 * WYSIWYG placement (2026-06-11): the rubber-band returns a FULL `WallEntity`
 * (via the SSoT `buildWallEntity` — same builder as commit) flagged
 * `wysiwygPreview`, so PreviewCanvas renders it through the real `WallRenderer`
 * (category fill / material hatch / lineweight / axis) instead of a green
 * outline. The ghost IS the final wall.
 */

import type { Point2D } from '../../rendering/types/Types';
import type { ExtendedSceneEntity } from './drawing-types';
import {
  alignmentPointForWallJustification,
  buildAnchoredWallParams,
  buildDefaultWallParams,
  buildWallEntity,
  resolveWallThicknessMm,
  type WallParamOverrides,
} from './wall-completion';
import type { StripJustification } from '../../bim/types/foundation-types';
import { wallPreviewStore } from '../../bim/walls/wall-preview-store';
import { sceneSnapTargetsStore, selectGhostMembers, type SceneSnapTargets } from '../../bim/framing/scene-snap-targets';
import type { WallKind, WallParams } from '../../bim/types/wall-types';
// ADR-513 — ελάχιστο μήκος για clamp του PREVIEW (το commit μένει αυστηρό μέσω validator).
import { MIN_WALL_LENGTH_MM } from '../../bim/types/wall-types';
import type { Point3D } from '../../bim/types/bim-base';
import { getDefaultLayerId } from '../../stores/LayerStore';
import { mmToSceneUnits } from '../../utils/scene-units';
import { getImmediateTransform } from '../../systems/cursor/ImmediateTransformStore';
import { worldPerPixel } from '../../rendering/utils/viewport-scale';
import { resizeSegmentToLength } from '../../rendering/entities/shared/geometry-vector-utils';
import { resolveBimCursorSnap } from '../../bim/placement/bim-cursor-snap';
import { MEMBER_GHOST_LEN_MM } from '../../bim/framing/member-column-face-snap';
import {
  isMemberCollinearOverlap,
  type LinearMemberSnapTarget,
  type GhostFaceFrame,
} from '../../bim/framing/linear-member-face-snap';
// ADR-508 — endpoint face-snap (point snap, reuse dispatcher) + lock precedence (Δαχτυλίδι νικά).
import { resolveWallEndpointSnap, resolveWallEndpointWithFineStep } from '../../bim/walls/wall-endpoint-snap';
import { isLengthAngleLockActive } from '../../systems/dynamic-input/length-angle-lock';
import type { GhostFaceDimensionsMeta } from '../../bim/framing/ghost-face-dim-references';
import { resolveGhostStatusColor } from '../../bim/ghosts/ghost-status-color';
import { resolveWallOpeningConflictForHost } from '../../bim/walls/wall-opening-conflict';
// ADR-363 §wall-joint-miter-preview — LIVE Revit-grade miter (ghost + affected neighbours),
// reusing the SAME computeWallTrims/applyTrimPatches SSoT as commit (preview === commit).
import { applyJointMiterPreview } from '../../bim/walls/wall-joint-miter-preview';
import { bulgeFrom3Points } from '../../bim/walls/wall-arc-descriptor';
// ADR-565 §12 Φ1.x — per-variant arc preview via the SAME resolver as commit (preview ≡ commit).
import { resolveCurvedArcParams, wallEndTangentAt } from '../../bim/walls/wall-curved-draw';
import { axisHostTolScene } from '../../bim/hosting/resolve-axis-bindings';
import type { WallEntity } from '../../bim/types/wall-types';
import type { OpeningEntity } from '../../bim/types/opening-types';
import { buildSegmentHudMeta, type WallHudMeta } from '../../canvas-v2/preview-canvas/wall-hud-paint';

/**
 * ADR-508 §wall-hud — εξαγωγή των αριθμητικών HUD δεδομένων από τον ΧΤΙΣΜΕΝΟ τοίχο (μήκος/γωνία/
 * πάχος/ύψος). Καθαρά νούμερα (N.11-clean)· η μετάφραση/μορφοποίηση γίνεται στον renderer/handler.
 */
function buildWallHudMeta(entity: WallEntity, sceneUnits: SceneUnits): WallHudMeta {
  const p = entity.params;
  // SSoT: ίδια length/angle μηχανή με τη γραμμή — ο τοίχος προσθέτει μόνο πάχος/ύψος.
  return buildSegmentHudMeta(p.start, p.end, sceneUnits, p.thickness, p.height);
}
import {
  resolveEffectivePreviewCursor,
  toWysiwygPreviewEntity,
  resolveGhostFaceDimensionsMeta,
} from './wysiwyg-preview-shared';
import { applyBimDrawingConstraint } from './bim-ortho-reference';
import type { SceneUnits } from './stair-completion';

// ADR-358 Phase 9D-5a: id-only WRITE — legacy `layer` field dropped.

/**
 * ADR-508 — SSoT overlap decision for EVERY wall-ghost path: 🔴 when the ghost lies
 * collinearly / on-top of (or whose body overlaps, incl. face-anchored) an existing member.
 * `extra` short-circuits to true (e.g. snap short-end `status==='overlap'`). Curved → never.
 * One owner so no path can forget the check (the bug it fixes: it was missing from the
 * footprint path).
 */
function isWallGhostOverlap(
  start: Readonly<Point2D>,
  end: Readonly<Point2D>,
  memberTargets: readonly LinearMemberSnapTarget[],
  overrides: WallParamOverrides,
  sceneUnits: SceneUnits,
  kind: WallKind,
  extra = false,
): boolean {
  if (extra) return true;
  if (kind === 'curved') return false;
  const newHalfScene = (resolveWallThicknessMm(overrides) / 2) * mmToSceneUnits(sceneUnits);
  return isMemberCollinearOverlap(start, end, memberTargets, newHalfScene);
}

/**
 * ADR-508 §opening-conflict — context για τον έλεγχο «κόβει άνοιγμα host;». Όταν δοθεί, ο builder
 * τρέχει το `resolveWallStartOpeningConflict` πάνω στην ΧΤΙΣΜΕΝΗ οντότητα (reuse `getEntityZExtents`)
 * και, σε conflict, κάνει το ghost 🔴 + κρύβει τις listening dims + επισυνάπτει το `openingConflict`
 * meta (κατακόρυφο εύρος σύγκρουσης → tooltip). `null` → η συμπεριφορά μένει αμετάβλητη.
 */
interface WallGhostConflictCtx {
  /** Σημείο επαφής του ghost στην παρειά host (centerline start). */
  readonly contactPt: Readonly<Point2D>;
  readonly thicknessMm: number;
  /** Ο host τοίχος που ΗΔΗ επέλεξε το snap (`targetId`) — μηδέν re-derive. `null` = free placement. */
  readonly host: WallEntity | null;
  readonly openings: readonly OpeningEntity[];
}

/**
 * ADR-508 — SSoT build for EVERY wall-ghost path: build the WYSIWYG entity (same `buildWallEntity`
 * as commit), apply the 🔴 overlap status colour, attach optional listening dimensions. Returns
 * null on a degenerate frame. The ONE place that owns build + status, so the overlap→red look
 * stays identical everywhere (mirror του κόκκινου φαντάσματος κολώνας).
 */
function buildWallGhostEntity(
  id: string,
  params: WallParams,
  kind: WallKind,
  sceneUnits: SceneUnits,
  isOverlap: boolean,
  faceDimensions: GhostFaceDimensionsMeta | null = null,
  conflictCtx: WallGhostConflictCtx | null = null,
  wantHud = false,
): ExtendedSceneEntity | null {
  const built = buildWallEntity(params, getDefaultLayerId(), kind, sceneUnits);
  if (!built.ok) return null;
  // ADR-508 §opening-conflict — 🔴 + block όταν ο κάθετος τοίχος κόβει άνοιγμα του host τοίχου.
  const conflict = conflictCtx
    ? resolveWallOpeningConflictForHost(
        conflictCtx.contactPt, built.entity, conflictCtx.thicknessMm,
        conflictCtx.host, conflictCtx.openings,
      )
    : null;
  const overlap = isOverlap || conflict !== null;
  const ghostStatusColor = overlap ? resolveGhostStatusColor('overlap') : null;
  // 🔴 → ποτέ listening dims (mirror short-end overlap).
  const dims = overlap ? null : faceDimensions;
  // ADR-508 §wall-hud — ζωντανή ταυτότητα (μήκος/γωνία/πάχος/ύψος) μόνο σε ευθύ τοίχο που σχεδιάζεται.
  const wallHud = wantHud && kind === 'straight' ? buildWallHudMeta(built.entity, sceneUnits) : null;
  return toWysiwygPreviewEntity(
    built.entity, id, ghostStatusColor, dims,
    conflict ? { bandMm: conflict.bandMm } : null,
    wallHud,
  );
}

// ─── ADR-363 Phase 1C — Wall preview helpers ────────────────────────────────

/**
 * Build a wall preview entity from `tempPoints` + cursor. State machine map
 * (ADR-508 unified με το δοκάρι — smart ghost-before-click + 2-κλικ):
 *   - [] (awaitingStart) → smart wall ghost στο σταυρόνημα (κουμπώνει σε κολόνα/μέλος)
 *   - [start] → WYSIWYG wall ghost start→cursor (auto-flush / centerline αν anchored)
 *   - [start, end] → curve-control ghost ή (legacy) awaitingAlignment-side ghost
 *   - [v1, v2, …] → polyline wall ghost με cursor ως επόμενη κορυφή
 *
 * The wall kind + overrides + snap targets are read from `wallPreviewStore`
 * (single-writer). Returns a full `WallEntity` (WYSIWYG) — preview == commit.
 */
/**
 * ADR-513 — επέκτεινε το PREVIEW endpoint ώστε το μήκος να είναι ≥ `MIN_WALL_LENGTH_MM` (στην
 * κατεύθυνση αρχή→cursor), μόνο όταν είναι πιο κοντό. Εκφυλισμένο (cursor≡start) → +X. ΜΟΝΟ για το
 * φάντασμα — το commit δεν περνά από εδώ, οπότε ο validator παραμένει αυστηρός (preview ≈ commit,
 * εκτός του ακραίου «πολύ κοντού» όπου το ghost παραμένει ορατό αντί να εξαφανίζεται).
 */
function clampPreviewMinLength(start: Readonly<Point2D>, end: Readonly<Point2D>, sceneUnits: SceneUnits): Point2D {
  const minLen = MIN_WALL_LENGTH_MM * mmToSceneUnits(sceneUnits);
  const len = Math.hypot(end.x - start.x, end.y - start.y);
  if (len >= minLen) return { x: end.x, y: end.y };
  // Reuse του geometry SSoT (ίδιο με το line stub max-clamp)· εδώ μόνο η συνθήκη min-clamp.
  return resizeSegmentToLength(start, end, minLen);
}

export function generateWallPreview(
  tempPoints: readonly Point2D[],
  cursorPoint: Point2D,
  sceneUnits: SceneUnits = 'mm',
): ExtendedSceneEntity | null {
  const preview = wallPreviewStore.get();
  const overrides: WallParamOverrides = preview.overrides;
  // ADR-398 §3.10 — face-snap στόχοι από το ΚΟΙΝΟ scene store· τοίχος = wall+beam+slab μέλη.
  const targets = sceneSnapTargetsStore.get();
  const footprints = targets.footprints;
  const members = selectGhostMembers(targets, ['wall', 'beam', 'slab']);
  // ADR-398 §3.11 — το before-click smart ghost ακολουθεί ΚΑΙ σκέτες ΓΡΑΜΜΕΣ (ίδια συμπεριφορά με
  // την κολώνα, ίδιος resolver). ΟΧΙ στον overlap-check του awaitingEnd (ώστε τοίχος κατά μήκος
  // γραμμής-αναφοράς να μη «κοκκινίζει»). Reuse-only, μηδέν διπλότυπο.
  const snapMembers = selectGhostMembers(targets, ['wall', 'beam', 'slab', 'line']);
  // ADR-508 §opening-conflict — host τοίχοι + ανοίγματα για τον έλεγχο «ο κάθετος τοίχος κόβει άνοιγμα;».
  const walls = targets.wallEntities;
  const openings = targets.openings;
  // awaitingEnd/footprint: ο host είναι ο LOCKED snapped reference (μηδέν re-derive). before-click
  // τον βρίσκει live από `snap.targetId` μέσα στον helper.
  const anchoredHost = preview.anchoredHostId ? walls.find((w) => w.id === preview.anchoredHostId) ?? null : null;

  if (tempPoints.length === 0) {
    // ADR-508 §smart wall ghost — πριν το 1ο κλικ: μικρό έξυπνο φάντασμα. Κοντά σε
    // κολόνα/μέλος → κουμπώνει σε παρειά/anchor· αλλιώς ακολουθεί ελεύθερα τον κέρσορα.
    return makeWallGhostBeforeClick(cursorPoint, overrides, sceneUnits, targets, members, walls, openings);
  }

  if (tempPoints.length >= 2) {
    const allVerts = [...tempPoints, cursorPoint];
    return makeWallPolylineGhost('preview_wall_polyline', allVerts, overrides, 'polyline', sceneUnits);
  }

  const startPt = tempPoints[0];

  // ADR-565 — curved (circular-arc) live preview: both endpoints fixed, cursor =
  // live on-arc "through" point. The bulge is normalized from the 3 points; a
  // collinear cursor (no unique circle) falls back to a straight ghost. `curved`
  // ghosts never overlap/miter, so no joint-miter/conflict pass is needed.
  if (preview.arcEndPoint) {
    return makeWallArcGhost('preview_wall_arc', startPt, preview.arcEndPoint, cursorPoint, overrides, sceneUnits);
  }

  // ADR-565 §12 Φ1.x — «κέντρο-άκρα»: κέντρο + αρχή γνωστά, cursor = γωνία τέλους. Το ίδιο
  // `resolveCurvedArcParams` με το commit → preview ≡ commit.
  if (preview.arcVariant === 'center-ends' && preview.arcCenter) {
    return makeWallArcGhostVariant(
      'preview_wall_arc_center',
      { arcVariant: 'center-ends', startPoint: startPt, endPoint: null, arcCenter: preview.arcCenter },
      cursorPoint, overrides, sceneUnits, null,
    );
  }

  // ADR-565 §12 Φ1.x — «εφαπτομενικό»: αρχή γνωστή, cursor = τέλος· η εφαπτομένη προκύπτει από το
  // άκρο υπάρχοντος τοίχου στο start (ίδιος lookup + tol με το commit).
  if (preview.arcVariant === 'tangent') {
    const tangentDir = wallEndTangentAt(walls, startPt, axisHostTolScene(sceneUnits));
    return makeWallArcGhostVariant(
      'preview_wall_arc_tangent',
      { arcVariant: 'tangent', startPoint: startPt, endPoint: null, arcCenter: null },
      cursorPoint, overrides, sceneUnits, tangentDir,
    );
  }

  // Legacy `awaitingAlignment` (μη-straight modes που το θέτουν): endPoint fixed, cursor =
  // live side pick. Με το 2-κλικ straight flow (ADR-508) ΔΕΝ τίθεται για ευθύ τοίχο.
  if (preview.endPoint) {
    // Επίπεδο 2 — live joint miter (ghost + affected neighbours), SSoT με το commit.
    return applyJointMiterPreview(
      makeWallFootprintGhost(
        'preview_wall_footprint', startPt, preview.endPoint, overrides, 'straight', sceneUnits, null,
        members, anchoredHost, openings, cursorPoint,
      ),
      walls, footprints, sceneUnits,
    );
  }

  const kind: WallKind = preview.curveControl ? 'curved' : 'straight';
  // ADR-508 — endpoint face-snap: το ΑΚΡΟ κουμπώνει/γλιστρά flush σε παρειά μέλους/κολώνας (συνεχής
  // ολίσθηση, ΙΔΙΟΣ dispatcher με το start → preview ≡ commit). Precedence (Giorgio): face-snap νικά
  // το ortho· length/angle lock (Δαχτυλίδι) νικά το face-snap → skip. Curved → raw cursor (αμετάβλητο).
  let endFaceFrame: GhostFaceFrame | null = null;
  let rawEnd = cursorPoint;
  if (kind === 'straight' && !isLengthAngleLockActive()) {
    // ΧΩΡΙΣ worldPerPixel → πλήρως συνεχής ολίσθηση του ΑΚΡΟΥ (Giorgio «ΠΛΗΡΩΣ»). preview ≡ commit.
    const snap = resolveWallEndpointSnap(
      cursorPoint, footprints, snapMembers, resolveWallThicknessMm(overrides), sceneUnits,
    );
    // ADR-049 — Shift fine 1cm βήμα στο ΑΚΡΟ ΜΟΝΟ στο ελεύθερο (face-snap νικά). preview ≡ commit.
    rawEnd = resolveWallEndpointWithFineStep(snap, startPt);
    endFaceFrame = snap.faceFrame ?? null;
  }
  // ADR-513 — clamp ΜΟΝΟ του PREVIEW στο ελάχιστο μήκος (το commit μένει αυστηρός validator): ο χρήστης
  // βλέπει πάντα τον τοίχο ακόμη κι όταν πάει ΑΜΕΣΩΣ στο «Δαχτυλίδι Εντολών» χωρίς να τον τραβήξει.
  const endPt = kind === 'straight' ? clampPreviewMinLength(startPt, rawEnd, sceneUnits) : cursorPoint;
  // Επίπεδο 2 — live joint miter (ghost + affected neighbours). No-op for curved / free /
  // overlap ghosts, so behaviour is unchanged except when a real join forms.
  return applyJointMiterPreview(
    makeWallWysiwygGhost(
      'preview_wall_footprint', startPt, endPt, overrides, kind, sceneUnits,
      preview.curveControl, preview.startAnchored, footprints, members, anchoredHost, openings,
      endFaceFrame, preview.startJustification,
    ),
    walls, footprints, sceneUnits,
  );
}

/**
 * ADR-508 §smart wall ghost — το φάντασμα πριν το 1ο κλικ (`awaitingStart`).
 *
 * Κοντά σε κολόνα/μέλος: ο `resolveMemberGhostSnapFromStore` επιστρέφει το centerline start/end.
 * Μακριά: ευθύ μικρό ghost από τον (snapped) κέρσορα προς +X. Πάντα centerline mode ώστε το
 * φάντασμα να δείχνει ΑΚΡΙΒΩΣ το σημείο που θα κλειδώσει το 1ο κλικ (preview === commit).
 * Διαβάζει `getImmediateSnap()` (snapped σημείο, mirror δοκαριού). `null` σε degenerate frame.
 */
function makeWallGhostBeforeClick(
  cursorPoint: Readonly<Point2D>,
  overrides: WallParamOverrides,
  sceneUnits: SceneUnits,
  targets: Readonly<SceneSnapTargets>,
  collisionTargets: readonly LinearMemberSnapTarget[],
  walls: readonly WallEntity[],
  openings: readonly OpeningEntity[],
): ExtendedSceneEntity | null {
  const thicknessMm = resolveWallThicknessMm(overrides);
  // ADR-508 (2026-06-24, Giorgio «να ολισθαίνει ΠΛΗΡΩΣ») — το `wpp` μένει ΜΟΝΟ για τα listening dims
  // (screen-relative offset)· ΔΕΝ περνά πια στο snap → πλήρως συνεχής ολίσθηση (μηδέν quantize/magnet,
  // ίδιο με την κολώνα). preview === commit (το click resolver επίσης χωρίς wpp).
  const wpp = worldPerPixel(getImmediateTransform().scale);
  // ADR-363 §wall-ortho-tracking — ΟΡΘΟ(F8)/POLAR(F10)/Q(F9+Q) ΜΕΤΑ το OSNAP (ίδιο pattern με την
  // κολόνα) → το ghost της αρχής κλειδώνει στο directional σημείο ως προς το hover-acquired anchor,
  // όχι στην απλή έλξη/πλέγμα. No-op χωρίς tracking anchor → ίδια συμπεριφορά με πριν.
  const effectiveCursor = applyBimDrawingConstraint('wall', resolveEffectivePreviewCursor(cursorPoint), wpp);
  // ADR-514 Φ3 — «Ένας Εγκέφαλος Έλξης»: ΕΝΑ unified entry (toolKind:'wall', default kinds
  // wall+beam+slab+line — snap ΚΑΙ σε σκέτες γραμμές, ίδιος resolver με την κολώνα). ⚠️ ADR-514 §2 —
  // ο effectiveCursor είναι ήδη snapped → ΧΩΡΙΣ findSnapPoint (anti double-snap). ΙΔΙΟ entry με το
  // commit (`useWallTool.resolveWallStartAnchor`) → preview ≡ commit by construction.
  const snapResult = resolveBimCursorSnap({ toolKind: 'wall', cursor: effectiveCursor, targets, sceneUnits, memberWidthMm: thicknessMm });
  const snap = snapResult.kind === 'member-placement' ? snapResult.placement : null;
  const start: Point2D = snap ? snap.start : { x: effectiveCursor.x, y: effectiveCursor.y };
  const end: Point2D = snap
    ? snap.end
    : { x: effectiveCursor.x + MEMBER_GHOST_LEN_MM * mmToSceneUnits(sceneUnits), y: effectiveCursor.y };
  // ADR-508 §end-reference — όταν το snap κούμπωσε στην κορυφή (3-tier), το `start`/`end` είναι η
  // **location line** πάνω στην κορυφή· το σώμα «κρέμεται» στη σωστή παρειά μέσω του justification
  // (ίδιο alignmentPoint με το commit → preview ≡ commit). `null` (κοινό face-snap) → κεντραρισμένο.
  const alignmentPoint = alignmentPointForWallJustification(start, end, snap?.justification);
  const params = buildDefaultWallParams(start, end, overrides, sceneUnits, alignmentPoint);
  // 🔴 `overlap` ΜΟΝΟ για ΔΟΜΙΚΑ μέλη (collisionTargets), ΟΧΙ για reference γραμμές: η γραμμή είναι
  // οδηγός στοίχισης, ΟΧΙ εμπόδιο. (α) short-end συγγραμμική συνέχεια ΜΟΝΟ αν snap-άρισε σε μέλος·
  // (β) ομοαξονικά/πάνω σε υφιστάμενο μέλος. Έτσι ο τοίχος κατά μήκος γραμμής μένει 🟢 (commit-able).
  const snappedToMember = snap?.targetId != null && collisionTargets.some((m) => m.id === snap.targetId);
  const isOverlap = isWallGhostOverlap(start, end, collisionTargets, overrides, sceneUnits, 'straight', snappedToMember && snap?.status === 'overlap');
  // ADR-508 §dim — listening dimensions: μόνο όταν το φάντασμα γλιστράει 🟢 πάνω σε παρειά μέλους
  // (`faceFrame` υπάρχει) ΚΑΙ δεν είναι 🔴 overlap. Πάντα 3 νούμερα (gap αριστερά/δεξιά + κέντρο).
  const faceDimensions = resolveGhostFaceDimensionsMeta(snap?.faceFrame, isOverlap, sceneUnits, wpp);
  // ADR-508 §opening-conflict — host = ο reference που ΗΔΗ επέλεξε το snap (`snap.targetId`), live.
  const host = snap?.targetId ? walls.find((w) => w.id === snap.targetId) ?? null : null;
  const conflictCtx: WallGhostConflictCtx = { contactPt: start, thicknessMm, host, openings };
  return buildWallGhostEntity('preview_wall_ghost', params, 'straight', sceneUnits, isOverlap, faceDimensions, conflictCtx);
}

/**
 * ADR-508 — WYSIWYG ghost στο `awaitingEnd`. `startAnchored` (face-snapped start) → centerline
 * mode· free → auto-flush σε κολόνα (`buildAnchoredWallParams`)· curved → centerline + control.
 * 🔴 schematic + (commit block στο useWallTool) όταν ομοαξονικό/πάνω σε υφιστάμενο μέλος.
 */
function makeWallWysiwygGhost(
  id: string,
  startPt: Readonly<Point2D>,
  endPt: Readonly<Point2D>,
  overrides: WallParamOverrides,
  kind: WallKind,
  sceneUnits: SceneUnits,
  curveControl: Point2D | null,
  startAnchored: boolean,
  columnFootprints: readonly (readonly Point2D[])[],
  memberTargets: readonly LinearMemberSnapTarget[],
  host: WallEntity | null,
  openings: readonly OpeningEntity[],
  endFaceFrame: GhostFaceFrame | null = null,
  startJustification: StripJustification | null = null,
): ExtendedSceneEntity | null {
  let params: WallParams;
  if (kind === 'curved') {
    const base = buildDefaultWallParams(startPt, endPt, overrides, sceneUnits);
    params = curveControl
      ? { ...base, curveControl: { x: curveControl.x, y: curveControl.y, z: 0 } as Point3D }
      : base;
  } else if (startAnchored) {
    // ADR-508 §end-reference — κορυφή 3-tier: το σώμα «κρέμεται» στη σωστή παρειά (justification →
    // alignmentPoint) ώστε το pivot να μένει στην κορυφή· `null` → κεντραρισμένος (κοινό face-snap).
    const alignmentPoint = alignmentPointForWallJustification(startPt, endPt, startJustification);
    params = buildDefaultWallParams(startPt, endPt, overrides, sceneUnits, alignmentPoint);
  } else {
    params = buildAnchoredWallParams(startPt, endPt, overrides, sceneUnits, columnFootprints);
  }
  const isOverlap = isWallGhostOverlap(startPt, endPt, memberTargets, overrides, sceneUnits, kind);
  // ADR-508 §opening-conflict — straight μόνο (κάθετο T-framing)· host = locked snapped reference.
  const conflictCtx: WallGhostConflictCtx | null = kind === 'curved'
    ? null
    : { contactPt: startPt, thicknessMm: resolveWallThicknessMm(overrides), host, openings };
  // ADR-508 §dim — listening dimensions στο ENDPOINT όταν κούμπωσε flush σε παρειά (reuse ΙΔΙΟ SSoT
  // με το start· κρύβονται σε 🔴 overlap μέσα στο resolveGhostFaceDimensionsMeta).
  const endDims = endFaceFrame
    ? resolveGhostFaceDimensionsMeta(endFaceFrame, isOverlap, sceneUnits, worldPerPixel(getImmediateTransform().scale))
    : null;
  // wantHud=true → ζωντανή ταυτότητα τοίχου (μήκος/γωνία/πάχος/ύψος) κατά το awaitingEnd drag.
  return buildWallGhostEntity(id, params, kind, sceneUnits, isOverlap, endDims, conflictCtx, true);
}

/**
 * Build a full `WallEntity` for a single straight/curved wall segment via the
 * SSoT `buildWallEntity` (same builder as commit). Returns `null` on a
 * degenerate/invalid frame (e.g. zero-length at the first pixel) so the preview
 * simply clears that frame.
 */
function makeWallFootprintGhost(
  id: string,
  startPt: Readonly<Point2D>,
  endPt: Readonly<Point2D>,
  overrides: WallParamOverrides,
  kind: WallKind,
  sceneUnits: SceneUnits,
  curveControl: Point2D | null,
  memberTargets: readonly LinearMemberSnapTarget[],
  host: WallEntity | null,
  openings: readonly OpeningEntity[],
  alignmentPoint: Point2D | null = null,
): ExtendedSceneEntity | null {
  const params = buildDefaultWallParams(startPt, endPt, overrides, sceneUnits, alignmentPoint);
  const finalParams = curveControl
    ? { ...params, curveControl: { x: curveControl.x, y: curveControl.y, z: 0 } as Point3D }
    : params;
  const isOverlap = isWallGhostOverlap(startPt, endPt, memberTargets, overrides, sceneUnits, kind);
  // ADR-508 §opening-conflict — straight μόνο· host = locked snapped reference.
  const conflictCtx: WallGhostConflictCtx | null = kind === 'curved'
    ? null
    : { contactPt: startPt, thicknessMm: resolveWallThicknessMm(overrides), host, openings };
  return buildWallGhostEntity(id, finalParams, kind, sceneUnits, isOverlap, null, conflictCtx, true);
}

/**
 * ADR-565 — WYSIWYG ghost for a curved (circular-arc) wall during
 * `awaitingCurveControl`: the arc passes through `startPt → throughPt → endPt`.
 * The through-point normalizes to the canonical `arc` bulge (SSoT
 * `bulgeFrom3Points`); a collinear through-point yields no unique circle and
 * falls back to the legacy Bézier `curveControl` so the ghost never disappears.
 * Preview ≡ commit (same `buildWallEntity` via `buildWallGhostEntity`).
 */
function makeWallArcGhost(
  id: string,
  startPt: Readonly<Point2D>,
  endPt: Readonly<Point2D>,
  throughPt: Readonly<Point2D>,
  overrides: WallParamOverrides,
  sceneUnits: SceneUnits,
): ExtendedSceneEntity | null {
  const base = buildDefaultWallParams(startPt, endPt, overrides, sceneUnits);
  const bulge = bulgeFrom3Points(startPt, throughPt, endPt);
  const params: WallParams =
    bulge != null
      ? { ...base, arc: bulge }
      : { ...base, curveControl: { x: throughPt.x, y: throughPt.y, z: 0 } as Point3D };
  return buildWallGhostEntity(id, params, 'curved', sceneUnits, false);
}

/**
 * ADR-565 §12 Φ1.x — WYSIWYG ghost for the «κέντρο-άκρα» / «εφαπτομενικό» arc variants via the
 * SHARED `resolveCurvedArcParams` (ΙΔΙΑ geometry με το commit → preview ≡ commit). `bulge===null`
 * (εκφυλισμένο / χωρίς εφαπτομένη αναφορά) → ευθύ-άξονα «curved» ghost (η χειρονομία δεν εξαφανίζεται).
 */
function makeWallArcGhostVariant(
  id: string,
  drawState: Parameters<typeof resolveCurvedArcParams>[0],
  cursorPt: Readonly<Point2D>,
  overrides: WallParamOverrides,
  sceneUnits: SceneUnits,
  tangentDirRad: number | null,
): ExtendedSceneEntity | null {
  const resolved = resolveCurvedArcParams(drawState, cursorPt, tangentDirRad);
  if (!resolved) return null;
  const base = buildDefaultWallParams(resolved.start, resolved.end, overrides, sceneUnits);
  const params: WallParams = resolved.bulge != null ? { ...base, arc: resolved.bulge } : { ...base };
  return buildWallGhostEntity(id, params, 'curved', sceneUnits, false);
}

/**
 * Build a full polyline-kind `WallEntity` preview. The N-vertex spine is offset
 * by thickness inside `computeWallGeometry()` (via `buildWallEntity`).
 */
function makeWallPolylineGhost(
  id: string,
  vertices: readonly Point2D[],
  overrides: WallParamOverrides,
  kind: WallKind,
  sceneUnits: SceneUnits,
): ExtendedSceneEntity | null {
  const startPt = vertices[0];
  const endPt = vertices[vertices.length - 1];
  const base = buildDefaultWallParams(startPt, endPt, overrides, sceneUnits);
  const polylineVertices: Point3D[] = vertices.map((v) => ({ x: v.x, y: v.y, z: 0 }));
  const params = { ...base, polylineVertices };
  // Polyline: multi-segment → no single-segment overlap check (isOverlap=false). Same SSoT build.
  return buildWallGhostEntity(id, params, kind, sceneUnits, false);
}
