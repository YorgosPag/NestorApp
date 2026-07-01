/**
 * ADR-363 §wall-joint-miter-preview — LIVE Revit-grade miter preview while drawing.
 *
 * Ζητούμενο (Giorgio): μετά το 1ο κλικ του εργαλείου «τοίχος», καθώς ορίζεις τη γωνία/
 * κλίση του δεύτερου τοίχου κοντά σε υφιστάμενο τοίχο, να βλέπεις σε ΠΡΑΓΜΑΤΙΚΟ ΧΡΟΝΟ πώς
 * θα ενωθούν (miter) — και του νέου φαντάσματος ΚΑΙ του υφιστάμενου τοίχου («Επίπεδο 2»).
 *
 * SSoT reuse (μηδέν νέος μηχανισμός): οι ΙΔΙΕΣ `computeWallTrims` + `applyTrimPatches` που
 * τρέχει το commit (`addWallToScene`) → **preview === commit** εξ ορισμού. Το φάντασμα είναι
 * ήδη πλήρες `WallEntity` (WYSIWYG), οπότε το τροφοδοτούμε μαζί με τους ΚΟΝΤΙΝΟΥΣ υφιστάμενους
 * τοίχους στον trim-solver:
 *   - το φάντασμα παίρνει το δικό του miter (ενημερώνεται params+geometry),
 *   - κάθε επηρεαζόμενος γείτονας επιστρέφεται ως WYSIWYG ghost (`jointNeighbors`) ώστε ο
 *     PreviewRenderer να ζωγραφίσει τη ΝΕΑ του παρειά live (overlay πάνω από το committed).
 *
 * Perf: φιλτράρουμε πρώτα τους τοίχους σε ακτίνα `JOIN_THRESHOLD_MM` γύρω από τα άκρα του
 * φαντάσματος → ο O(k²) solver τρέχει σε ελάχιστα (0-3) μέλη ανά frame, όχι σε όλη τη σκηνή.
 *
 * @see bim/walls/wall-trims.ts — computeWallTrims / applyTrimPatches / JOIN_THRESHOLD_MM (SSoT)
 * @see bim/walls/add-wall-to-scene.ts — το commit που καλεί την ΙΔΙΑ μηχανή
 */

import type { ExtendedSceneEntity } from '../../hooks/drawing/drawing-types';
import type { WallEntity, WallParams } from '../types/wall-types';
import { isWallEntity } from '../../types/entities';
import { mmToSceneUnits, type SceneUnits } from '../../utils/scene-units';
import { toWysiwygPreviewEntity } from '../../hooks/drawing/wysiwyg-preview-shared';
import { computeWallGeometry } from '../geometry/wall-geometry';
import { computeWallTrims, applyTrimPatches, JOIN_THRESHOLD_MM } from './wall-trims';

/** Extra metadata carried on the wall ghost so the PreviewRenderer paints the
 *  affected neighbours' updated miter live (read via cast, mirror `wallHud`). */
export interface JointMiterPreviewFields {
  /** Επηρεαζόμενοι υφιστάμενοι τοίχοι με ΝΕΟ miter, ως WYSIWYG ghosts. */
  readonly jointNeighbors?: readonly ExtendedSceneEntity[];
}

/** Squared distance between two endpoints (avoids sqrt in the proximity filter). */
function dist2(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx, dy = ay - by;
  return dx * dx + dy * dy;
}

/**
 * Strip a neighbour's STALE stored trim (miter/bevel from the joined wall's OLD position)
 * before the fresh recompute — mirror of the commit-side `recomputeWallTrims`
 * (add-wall-to-scene.ts). Without this the preview keeps the neighbour's old join while the
 * rotating wall has already moved (the L/R miter asymmetry). Geometry is recomputed clean.
 */
function stripWallTrims(w: WallEntity): WallEntity {
  const { startMiter: _sm, endMiter: _em, startBevel: _sb, endBevel: _eb, ...rest } = w.params;
  const cleanParams = rest as WallParams;
  return { ...w, params: cleanParams, geometry: computeWallGeometry(cleanParams, w.kind) };
}

/** Signature of a wall's four trim fields — for detecting a trim change vs the committed state. */
function trimSignature(p: WallParams): string {
  return JSON.stringify([p.startMiter ?? null, p.endMiter ?? null, p.startBevel ?? null, p.endBevel ?? null]);
}

/**
 * Existing walls with an endpoint within the join threshold of EITHER ghost endpoint —
 * the only walls that can miter with the ghost. Reuses the same 200mm SSoT threshold as
 * the trim solver, so a wall the commit would join is a wall we preview-join.
 */
function selectNearWalls(
  ghost: WallEntity,
  walls: readonly WallEntity[],
  sceneUnits: SceneUnits,
): WallEntity[] {
  const thr = JOIN_THRESHOLD_MM * mmToSceneUnits(sceneUnits);
  const thr2 = thr * thr;
  const gs = ghost.params.start, ge = ghost.params.end;
  const near: WallEntity[] = [];
  for (const w of walls) {
    if (w.id === ghost.id || w.kind !== 'straight') continue;
    const s = w.params.start, e = w.params.end;
    if (
      dist2(s.x, s.y, gs.x, gs.y) <= thr2 || dist2(s.x, s.y, ge.x, ge.y) <= thr2 ||
      dist2(e.x, e.y, gs.x, gs.y) <= thr2 || dist2(e.x, e.y, ge.x, ge.y) <= thr2
    ) {
      near.push(w);
    }
  }
  return near;
}

/**
 * Augment a straight wall ghost with its live join: applies the ghost's own miter
 * (params+geometry) and attaches `jointNeighbors` (affected existing walls, mitered).
 *
 * No-op (returns the input unchanged) when: ghost is null / not a straight wall / is a
 * 🔴 overlap ghost (no valid join) / no near walls / the solver produced no trim. So a
 * free-floating wall or a curved/polyline ghost renders exactly as before.
 */
export function applyJointMiterPreview(
  ghost: ExtendedSceneEntity | null,
  walls: readonly WallEntity[],
  sceneUnits: SceneUnits,
): ExtendedSceneEntity | null {
  if (!ghost) return ghost;
  // 🔴 overlap ghost renders as red schematic → no join to show.
  if ((ghost as { ghostStatusColor?: unknown }).ghostStatusColor) return ghost;
  if ((ghost as { type?: string }).type !== 'wall') return ghost;
  const g = ghost as unknown as WallEntity;
  if (g.kind !== 'straight') return ghost;

  const near = selectNearWalls(g, walls, sceneUnits);
  if (near.length === 0) return ghost;

  // STRIP each neighbour's stale committed miter BEFORE the recompute (preview === commit,
  // mirror `recomputeWallTrims`). computeWallTrims ignores stored miters, so this does NOT
  // change the ghost's own join — it only lets a neighbour that no longer mitres be shown
  // CLEAN instead of carrying the join from the rotating wall's OLD position.
  const strippedNear = near.map(stripWallTrims);
  const all: WallEntity[] = [...strippedNear, g];
  const trims = computeWallTrims(all);
  const patched = applyTrimPatches(all, trims);
  const patchedById = new Map(
    patched.filter(isWallEntity).map((e) => [e.id, e as WallEntity] as const),
  );
  const patchedGhost = patchedById.get(g.id);
  const ghostGainedTrim = !!patchedGhost && trimSignature(patchedGhost.params) !== trimSignature(g.params);

  // A neighbour is redrawn when its trim CHANGED vs its COMMITTED state — gained, lost, or
  // different. Redrawing a neighbour that LOST its miter (now clean) is what covers the stale
  // committed neighbour on the main canvas (the L/R «different join shape» bug). Identical
  // trims are skipped (the committed neighbour already looks right → no redundant overlay).
  const jointNeighbors = near
    .filter((committed) => {
      const now = patchedById.get(committed.id);
      return !!now && trimSignature(committed.params) !== trimSignature(now.params);
    })
    .map((committed) => toWysiwygPreviewEntity(patchedById.get(committed.id)!, committed.id));

  // Nothing changed for the ghost AND no neighbour trims → keep the input ref.
  if (!ghostGainedTrim && jointNeighbors.length === 0) return ghost;

  return {
    ...ghost,
    // Apply the ghost's own miter (params + recomputed geometry from the SSoT solver).
    ...(ghostGainedTrim && patchedGhost ? { params: patchedGhost.params, geometry: patchedGhost.geometry } : {}),
    ...(jointNeighbors.length > 0 ? { jointNeighbors } : {}),
  } as ExtendedSceneEntity;
}
