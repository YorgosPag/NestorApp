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
  buildAnchoredWallParams,
  buildDefaultWallParams,
  buildWallEntity,
  resolveWallThicknessMm,
  type WallParamOverrides,
} from './wall-completion';
import { wallPreviewStore } from '../../bim/walls/wall-preview-store';
import { sceneSnapTargetsStore, selectGhostMembers } from '../../bim/framing/scene-snap-targets';
import type { WallKind, WallParams } from '../../bim/types/wall-types';
// ADR-513 — ελάχιστο μήκος για clamp του PREVIEW (το commit μένει αυστηρό μέσω validator).
import { MIN_WALL_LENGTH_MM } from '../../bim/types/wall-types';
import type { Point3D } from '../../bim/types/bim-base';
import { DXF_DEFAULT_LAYER } from '../../config/layer-config';
import { getLayer } from '../../stores/LayerStore';
import { mmToSceneUnits } from '../../utils/scene-units';
import { getImmediateTransform } from '../../systems/cursor/ImmediateTransformStore';
import { worldPerPixel } from '../../rendering/utils/viewport-scale';
import { resolveMemberGhostSnapFromStore } from '../../bim/framing/member-ghost-snap';
import { MEMBER_GHOST_LEN_MM } from '../../bim/framing/member-column-face-snap';
import {
  isMemberCollinearOverlap,
  type LinearMemberSnapTarget,
} from '../../bim/framing/linear-member-face-snap';
import type { GhostFaceDimensionsMeta } from '../../bim/framing/ghost-face-dim-references';
import { resolveGhostStatusColor } from '../../bim/ghosts/ghost-status-color';
import { resolveWallOpeningConflictForHost } from '../../bim/walls/wall-opening-conflict';
import type { WallEntity } from '../../bim/types/wall-types';
import type { OpeningEntity } from '../../bim/types/opening-types';
import type { WallHudMeta } from '../../canvas-v2/preview-canvas/wall-hud-paint';

const DEG_PER_RAD = 180 / Math.PI;

/**
 * ADR-508 §wall-hud — εξαγωγή των αριθμητικών HUD δεδομένων από τον ΧΤΙΣΜΕΝΟ τοίχο (μήκος/γωνία/
 * πάχος/ύψος). Καθαρά νούμερα (N.11-clean)· η μετάφραση/μορφοποίηση γίνεται στον renderer/handler.
 */
function buildWallHudMeta(entity: WallEntity, sceneUnits: SceneUnits): WallHudMeta {
  const p = entity.params;
  const start = { x: p.start.x, y: p.start.y };
  const end = { x: p.end.x, y: p.end.y };
  const lenScene = Math.hypot(end.x - start.x, end.y - start.y);
  const angle = Math.atan2(end.y - start.y, end.x - start.x) * DEG_PER_RAD;
  return {
    start,
    end,
    lengthMm: lenScene / mmToSceneUnits(sceneUnits),
    angleDeg: ((angle % 360) + 360) % 360,
    thicknessMm: p.thickness,
    heightMm: p.height,
    sceneUnits,
  };
}
import {
  resolveEffectivePreviewCursor,
  toWysiwygPreviewEntity,
  resolveGhostFaceDimensionsMeta,
} from './wysiwyg-preview-shared';
import type { SceneUnits } from './stair-completion';

// ADR-358 Phase 9D-5a: id-only WRITE — legacy `layer` field dropped.
const defaultLayerId = (): string => getLayer(DXF_DEFAULT_LAYER)?.id ?? '';

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
  const built = buildWallEntity(params, defaultLayerId(), kind, sceneUnits);
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
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.hypot(dx, dy);
  if (len >= minLen) return { x: end.x, y: end.y };
  const ux = len > 1e-9 ? dx / len : 1;
  const uy = len > 1e-9 ? dy / len : 0;
  return { x: start.x + ux * minLen, y: start.y + uy * minLen };
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
    return makeWallGhostBeforeClick(cursorPoint, overrides, sceneUnits, footprints, snapMembers, members, walls, openings);
  }

  if (tempPoints.length >= 2) {
    const allVerts = [...tempPoints, cursorPoint];
    return makeWallPolylineGhost('preview_wall_polyline', allVerts, overrides, 'polyline', sceneUnits);
  }

  const startPt = tempPoints[0];

  // Legacy `awaitingAlignment` (μη-straight modes που το θέτουν): endPoint fixed, cursor =
  // live side pick. Με το 2-κλικ straight flow (ADR-508) ΔΕΝ τίθεται για ευθύ τοίχο.
  if (preview.endPoint) {
    return makeWallFootprintGhost(
      'preview_wall_footprint', startPt, preview.endPoint, overrides, 'straight', sceneUnits, null,
      members, anchoredHost, openings, cursorPoint,
    );
  }

  const kind: WallKind = preview.curveControl ? 'curved' : 'straight';
  // ADR-513 — όταν ο χρήστης κάνει 1ο κλικ και πάει ΑΜΕΣΩΣ στο «Δαχτυλίδι Εντολών» (χωρίς να
  // τραβήξει τον τοίχο), ο κέρσορας είναι κοντά στην αρχή → ο τοίχος < MIN_WALL_LENGTH → ο validator
  // ακυρώνει το ghost → εξαφανίζεται. Clamp ΜΟΝΟ του PREVIEW στο ελάχιστο μήκος (το commit μένει
  // αυστηρό): ο χρήστης βλέπει πάντα τον τοίχο και μπορεί να τυπώσει μήκος/γωνία στο δαχτυλίδι.
  const endPt = kind === 'straight' ? clampPreviewMinLength(startPt, cursorPoint, sceneUnits) : cursorPoint;
  return makeWallWysiwygGhost(
    'preview_wall_footprint', startPt, endPt, overrides, kind, sceneUnits,
    preview.curveControl, preview.startAnchored, footprints, members, anchoredHost, openings,
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
  columnFootprints: readonly (readonly Point2D[])[],
  snapTargets: readonly LinearMemberSnapTarget[],
  collisionTargets: readonly LinearMemberSnapTarget[],
  walls: readonly WallEntity[],
  openings: readonly OpeningEntity[],
): ExtendedSceneEntity | null {
  const effectiveCursor = resolveEffectivePreviewCursor(cursorPoint);
  const thicknessMm = resolveWallThicknessMm(overrides);
  // ADR-508 — ίδιο worldPerPixel με το click resolver (useWallTool) → ίδιο zoom-adaptive βήμα
  // ολίσθησης (preview === commit: το φάντασμα γλιστράει στα ίδια σημεία που θα κλειδώσει το κλικ).
  const wpp = worldPerPixel(getImmediateTransform().scale);
  // ADR-398 §3.11 — snap ΚΑΙ σε σκέτες γραμμές (ακολουθεί τη γραμμή, ίδιος resolver με την κολώνα).
  const snap = resolveMemberGhostSnapFromStore(effectiveCursor, columnFootprints, snapTargets, thicknessMm, sceneUnits, wpp);
  const start: Point2D = snap ? snap.start : { x: effectiveCursor.x, y: effectiveCursor.y };
  const end: Point2D = snap
    ? snap.end
    : { x: effectiveCursor.x + MEMBER_GHOST_LEN_MM * mmToSceneUnits(sceneUnits), y: effectiveCursor.y };
  const params = buildDefaultWallParams(start, end, overrides, sceneUnits);
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
): ExtendedSceneEntity | null {
  let params: WallParams;
  if (kind === 'curved') {
    const base = buildDefaultWallParams(startPt, endPt, overrides, sceneUnits);
    params = curveControl
      ? { ...base, curveControl: { x: curveControl.x, y: curveControl.y, z: 0 } as Point3D }
      : base;
  } else if (startAnchored) {
    params = buildDefaultWallParams(startPt, endPt, overrides, sceneUnits);
  } else {
    params = buildAnchoredWallParams(startPt, endPt, overrides, sceneUnits, columnFootprints);
  }
  const isOverlap = isWallGhostOverlap(startPt, endPt, memberTargets, overrides, sceneUnits, kind);
  // ADR-508 §opening-conflict — straight μόνο (κάθετο T-framing)· host = locked snapped reference.
  const conflictCtx: WallGhostConflictCtx | null = kind === 'curved'
    ? null
    : { contactPt: startPt, thicknessMm: resolveWallThicknessMm(overrides), host, openings };
  // wantHud=true → ζωντανή ταυτότητα τοίχου (μήκος/γωνία/πάχος/ύψος) κατά το awaitingEnd drag.
  return buildWallGhostEntity(id, params, kind, sceneUnits, isOverlap, null, conflictCtx, true);
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
