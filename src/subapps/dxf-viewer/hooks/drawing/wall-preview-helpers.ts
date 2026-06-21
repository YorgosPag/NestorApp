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
import type { WallKind, WallParams } from '../../bim/types/wall-types';
import type { Point3D } from '../../bim/types/bim-base';
import { DXF_DEFAULT_LAYER } from '../../config/layer-config';
import { getLayer } from '../../stores/LayerStore';
import { mmToSceneUnits } from '../../utils/scene-units';
import { getImmediateTransform } from '../../systems/cursor/ImmediateTransformStore';
import { resolveMemberGhostSnapFromStore } from '../../bim/framing/member-ghost-snap';
import { MEMBER_GHOST_LEN_MM } from '../../bim/framing/member-column-face-snap';
import {
  isMemberCollinearOverlap,
  type LinearMemberSnapTarget,
} from '../../bim/framing/linear-member-face-snap';
import { resolveGhostStatusColor } from '../../bim/ghosts/ghost-status-color';
import { resolveEffectivePreviewCursor, toWysiwygPreviewEntity } from './wysiwyg-preview-shared';
import type { SceneUnits } from './stair-completion';

// ADR-358 Phase 9D-5a: id-only WRITE — legacy `layer` field dropped.
const defaultLayerId = (): string => getLayer(DXF_DEFAULT_LAYER)?.id ?? '';

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
export function generateWallPreview(
  tempPoints: readonly Point2D[],
  cursorPoint: Point2D,
  sceneUnits: SceneUnits = 'mm',
): ExtendedSceneEntity | null {
  const preview = wallPreviewStore.get();
  const overrides: WallParamOverrides = preview.overrides;

  if (tempPoints.length === 0) {
    // ADR-508 §smart wall ghost — πριν το 1ο κλικ: μικρό έξυπνο φάντασμα. Κοντά σε
    // κολόνα/μέλος → κουμπώνει σε παρειά/anchor· αλλιώς ακολουθεί ελεύθερα τον κέρσορα.
    return makeWallGhostBeforeClick(cursorPoint, overrides, sceneUnits, preview.columnFootprints, preview.memberTargets);
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
      'preview_wall_footprint', startPt, preview.endPoint, overrides, 'straight', sceneUnits, null, cursorPoint,
    );
  }

  const endPt = cursorPoint;
  const kind: WallKind = preview.curveControl ? 'curved' : 'straight';
  return makeWallWysiwygGhost(
    'preview_wall_footprint', startPt, endPt, overrides, kind, sceneUnits,
    preview.curveControl, preview.startAnchored, preview.columnFootprints, preview.memberTargets,
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
  memberTargets: readonly LinearMemberSnapTarget[],
): ExtendedSceneEntity | null {
  const effectiveCursor = resolveEffectivePreviewCursor(cursorPoint);
  const thicknessMm = resolveWallThicknessMm(overrides);
  // ADR-508 — ίδιο worldPerPixel με το click resolver (useWallTool) → ίδιο zoom-adaptive βήμα
  // ολίσθησης (preview === commit: το φάντασμα γλιστράει στα ίδια σημεία που θα κλειδώσει το κλικ).
  const worldPerPixel = 1 / Math.max(getImmediateTransform().scale, 0.001);
  const snap = resolveMemberGhostSnapFromStore(effectiveCursor, columnFootprints, memberTargets, thicknessMm, sceneUnits, worldPerPixel);
  const start: Point2D = snap ? snap.start : { x: effectiveCursor.x, y: effectiveCursor.y };
  const end: Point2D = snap
    ? snap.end
    : { x: effectiveCursor.x + MEMBER_GHOST_LEN_MM * mmToSceneUnits(sceneUnits), y: effectiveCursor.y };
  const params = buildDefaultWallParams(start, end, overrides, sceneUnits);
  const built = buildWallEntity(params, defaultLayerId(), 'straight', sceneUnits);
  if (!built.ok) return null;
  // 🔴 `overlap` όταν: (α) short-end συγγραμμική συνέχεια (`snap.status`), Ή (β) το φάντασμα
  // κείτεται ομοαξονικά/πάνω σε υφιστάμενο μέλος. 🟢/`neutral` → WYSIWYG αυτούσιο.
  const isOverlap = snap?.status === 'overlap' || isMemberCollinearOverlap(start, end, memberTargets);
  const ghostStatusColor = isOverlap ? resolveGhostStatusColor('overlap') : null;
  return toWysiwygPreviewEntity(built.entity, 'preview_wall_ghost', ghostStatusColor);
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
  const built = buildWallEntity(params, defaultLayerId(), kind, sceneUnits);
  if (!built.ok) return null;
  const ghostStatusColor =
    kind !== 'curved' && isMemberCollinearOverlap(startPt, endPt, memberTargets)
      ? resolveGhostStatusColor('overlap')
      : null;
  return toWysiwygPreviewEntity(built.entity, id, ghostStatusColor);
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
  alignmentPoint: Point2D | null = null,
): ExtendedSceneEntity | null {
  const params = buildDefaultWallParams(startPt, endPt, overrides, sceneUnits, alignmentPoint);
  const finalParams = curveControl
    ? { ...params, curveControl: { x: curveControl.x, y: curveControl.y, z: 0 } as Point3D }
    : params;
  const built = buildWallEntity(finalParams, defaultLayerId(), kind, sceneUnits);
  if (!built.ok) return null;
  return toWysiwygPreviewEntity(built.entity, id);
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
  const built = buildWallEntity(params, defaultLayerId(), kind, sceneUnits);
  if (!built.ok) return null;
  return toWysiwygPreviewEntity(built.entity, id);
}
