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
import { resolveWallStartOpeningConflict } from '../../bim/walls/wall-opening-conflict';
import type { WallEntity } from '../../bim/types/wall-types';
import type { OpeningEntity } from '../../bim/types/opening-types';
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
  readonly walls: readonly WallEntity[];
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
): ExtendedSceneEntity | null {
  const built = buildWallEntity(params, defaultLayerId(), kind, sceneUnits);
  if (!built.ok) return null;
  // ADR-508 §opening-conflict — 🔴 + block όταν ο κάθετος τοίχος κόβει άνοιγμα του host τοίχου.
  const conflict = conflictCtx
    ? resolveWallStartOpeningConflict(
        conflictCtx.contactPt, built.entity, conflictCtx.thicknessMm,
        conflictCtx.walls, conflictCtx.openings, sceneUnits,
      )
    : null;
  const overlap = isOverlap || conflict !== null;
  const ghostStatusColor = overlap ? resolveGhostStatusColor('overlap') : null;
  // 🔴 → ποτέ listening dims (mirror short-end overlap).
  const dims = overlap ? null : faceDimensions;
  return toWysiwygPreviewEntity(
    built.entity, id, ghostStatusColor, dims,
    conflict ? { bandMm: conflict.bandMm } : null,
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
  // ADR-508 §opening-conflict — host τοίχοι + ανοίγματα για τον έλεγχο «ο κάθετος τοίχος κόβει άνοιγμα;».
  const walls = targets.wallEntities;
  const openings = targets.openings;

  if (tempPoints.length === 0) {
    // ADR-508 §smart wall ghost — πριν το 1ο κλικ: μικρό έξυπνο φάντασμα. Κοντά σε
    // κολόνα/μέλος → κουμπώνει σε παρειά/anchor· αλλιώς ακολουθεί ελεύθερα τον κέρσορα.
    return makeWallGhostBeforeClick(cursorPoint, overrides, sceneUnits, footprints, members, walls, openings);
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
      members, walls, openings, cursorPoint,
    );
  }

  const endPt = cursorPoint;
  const kind: WallKind = preview.curveControl ? 'curved' : 'straight';
  return makeWallWysiwygGhost(
    'preview_wall_footprint', startPt, endPt, overrides, kind, sceneUnits,
    preview.curveControl, preview.startAnchored, footprints, members, walls, openings,
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
  walls: readonly WallEntity[],
  openings: readonly OpeningEntity[],
): ExtendedSceneEntity | null {
  const effectiveCursor = resolveEffectivePreviewCursor(cursorPoint);
  const thicknessMm = resolveWallThicknessMm(overrides);
  // ADR-508 — ίδιο worldPerPixel με το click resolver (useWallTool) → ίδιο zoom-adaptive βήμα
  // ολίσθησης (preview === commit: το φάντασμα γλιστράει στα ίδια σημεία που θα κλειδώσει το κλικ).
  const wpp = worldPerPixel(getImmediateTransform().scale);
  const snap = resolveMemberGhostSnapFromStore(effectiveCursor, columnFootprints, memberTargets, thicknessMm, sceneUnits, wpp);
  const start: Point2D = snap ? snap.start : { x: effectiveCursor.x, y: effectiveCursor.y };
  const end: Point2D = snap
    ? snap.end
    : { x: effectiveCursor.x + MEMBER_GHOST_LEN_MM * mmToSceneUnits(sceneUnits), y: effectiveCursor.y };
  const params = buildDefaultWallParams(start, end, overrides, sceneUnits);
  // 🔴 `overlap` όταν: (α) short-end συγγραμμική συνέχεια (`snap.status`), Ή (β) το φάντασμα
  // κείτεται ομοαξονικά/πάνω σε υφιστάμενο μέλος (incl. face-anchored). SSoT decision.
  const isOverlap = isWallGhostOverlap(start, end, memberTargets, overrides, sceneUnits, 'straight', snap?.status === 'overlap');
  // ADR-508 §dim — listening dimensions: μόνο όταν το φάντασμα γλιστράει 🟢 πάνω σε παρειά μέλους
  // (`faceFrame` υπάρχει) ΚΑΙ δεν είναι 🔴 overlap. Πάντα 3 νούμερα (gap αριστερά/δεξιά + κέντρο).
  const faceDimensions = resolveGhostFaceDimensionsMeta(snap?.faceFrame, isOverlap, sceneUnits, wpp);
  // ADR-508 §opening-conflict — το σημείο επαφής (centerline start) ελέγχεται κατά των ανοιγμάτων host.
  const conflictCtx: WallGhostConflictCtx = { contactPt: start, thicknessMm, walls, openings };
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
  walls: readonly WallEntity[],
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
  // ADR-508 §opening-conflict — straight μόνο (κάθετο T-framing)· το startPt είναι το σημείο επαφής host.
  const conflictCtx: WallGhostConflictCtx | null = kind === 'curved'
    ? null
    : { contactPt: startPt, thicknessMm: resolveWallThicknessMm(overrides), walls, openings };
  return buildWallGhostEntity(id, params, kind, sceneUnits, isOverlap, null, conflictCtx);
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
  walls: readonly WallEntity[],
  openings: readonly OpeningEntity[],
  alignmentPoint: Point2D | null = null,
): ExtendedSceneEntity | null {
  const params = buildDefaultWallParams(startPt, endPt, overrides, sceneUnits, alignmentPoint);
  const finalParams = curveControl
    ? { ...params, curveControl: { x: curveControl.x, y: curveControl.y, z: 0 } as Point3D }
    : params;
  const isOverlap = isWallGhostOverlap(startPt, endPt, memberTargets, overrides, sceneUnits, kind);
  // ADR-508 §opening-conflict — straight μόνο· startPt = σημείο επαφής host.
  const conflictCtx: WallGhostConflictCtx | null = kind === 'curved'
    ? null
    : { contactPt: startPt, thicknessMm: resolveWallThicknessMm(overrides), walls, openings };
  return buildWallGhostEntity(id, finalParams, kind, sceneUnits, isOverlap, null, conflictCtx);
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
