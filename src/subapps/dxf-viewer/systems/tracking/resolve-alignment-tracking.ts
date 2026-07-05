/**
 * @module resolve-alignment-tracking
 * @description **THE** canonical «Object Snap Tracking» resolver (πορτοκαλί polar συμμετέχει μέσα
 * στο resolver, λευκή/AutoAlign alignment). ΕΝΑ brain — per-context anchors, ακριβώς όπως ο ΕΝΑΣ
 * OTRACK solver του Revit/AutoCAD/C4D/Figma. Consumers:
 *   1) σχεδίαση (`drawing-hover-handler.processDrawingHover`) — ref = lastRefPt / BIM anchor + `segmentBase`,
 *   2) περιστροφή (`rotation-tracking-overlay`) — ref = pivot,
 *   3) διάσταση / interactive ACTION drags (MOVE, body-drag, grip, cut-line) — `refPoints` = τα ήδη-picked
 *      σημεία της ενέργειας, μέσω του thin adapter `resolveDimAlignmentTracking` (hooks/dimensions).
 *
 * Το assembly (acquired ⊕ ambient ⊕ polar → `composeTrackingSnap`) ζει ΕΔΩ ΜΙΑ φορά· κάθε context
 * περνά τα δικά του inputs (`refPoints` / `matchTolerancePx` / `segmentBase`). Μηδέν παράλληλη μηχανή.
 *
 * @see ADR-357 Phase 4 — Object Snap Tracking
 * @see ADR-397 — rotation hot-grip
 * @see ADR-562 Φ9 — dimension / action alignment (thin adapter πάνω σε αυτόν τον resolver)
 */
import type { Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import { TrackingPointStore, type AcquiredTrackingPoint } from './TrackingPointStore';
import { composeTrackingSnap, type ComposedTracking } from './ambient-tracking-compose';
import { collectAmbientAlignmentAnchors } from './ambient-alignment-source';
import { ambientAlignmentConfigStore } from './ambient-alignment-config-store';
import { polarTrackingStore } from '../constraints/polar-tracking-store';
import { worldPerPixel, pixelsToWorld } from '../../rendering/utils/viewport-scale';

/**
 * Default match aperture (px) — η OSNAP hover ανοχή που κρατά η δημιουργία (σχεδίαση/διάσταση).
 * Οι interactive ACTION drags περνούν ευρύτερο pull (βλ. `ACTION_ALIGN_TOLERANCE_PX` στον adapter).
 */
export const DEFAULT_ALIGN_TOLERANCE_PX = 3;

/**
 * `sourceSnapType` tag για τα ρητά reference points ενός context (τα ήδη-picked σημεία μιας
 * διάστασης/ενέργειας). Καθαρά label — το `resolveTrackingSnap` δεν κάνει branch πάνω του.
 */
const REF_POINT_SOURCE = 'ref-point';

export interface AlignmentTrackingInput {
  /** Live transform scale (world units per... → worldPerPixel = 1/scale). */
  readonly scale: number;
  /** F10 polar increments participate in the alignment paths (true ⇔ POLAR on && !ORTHO). */
  readonly polarEnabled: boolean;
  /**
   * Scene entities for the Revit-style ambient anchors, OR null to skip the ambient
   * source (acquired-only). The CALLER gates the (perf-sensitive) scene read behind
   * `ambientAlignmentConfigStore.getSnapshot().enabled` so it stays lazy.
   */
  readonly sceneEntities: readonly Entity[] | null;
  /**
   * The current segment's start (rubber-band base / last placed point), or null for
   * the free first point. Threads to the OTRACK clean-corner intersection so the
   * ghost locks onto `base × anchor-trace` (e.g. the rectangle corner). (2026-07-04)
   */
  readonly segmentBase?: Point2D | null;
  /**
   * Explicit transient anchors — τα ήδη-picked σημεία της τρέχουσας ενέργειας/διάστασης
   * (clicks δημιουργίας, defPoints, MOVE base). Prepended στα acquired store points ως
   * transient (`acquiredAt:0`, δεν μπαίνουν στο FIFO), ακριβώς όπως η περιστροφή περνά το
   * pivot. Default `[]` (σχεδίαση/περιστροφή: store-only).
   */
  readonly refPoints?: readonly Point2D[];
  /**
   * Match aperture σε screen px (default {@link DEFAULT_ALIGN_TOLERANCE_PX} = 3). Οι interactive
   * action drags περνούν ευρύτερο pull· εδώ γίνεται `pixelsToWorld` ώστε το feel να μένει
   * σταθερό σε κάθε zoom.
   */
  readonly matchTolerancePx?: number;
}

/**
 * Resolve the best alignment-path snap from (refPoints ⊕ acquired ⊕ ambient) anchors toward
 * `cursor`. Returns null when there are no anchors / no path within tolerance (caller keeps the
 * raw cursor). The "magic" adaptive-distance quantize lives inside `composeTrackingSnap`.
 *
 * SSoT — ΕΝΑΣ resolver, per-context anchors: drawing rubber-band, rotation sweep, dimension &
 * interactive ACTION drags. Το `refPoints`/`matchTolerancePx`/`segmentBase` είναι per-context.
 */
export function resolveAlignmentTracking(
  cursor: Point2D,
  input: AlignmentTrackingInput,
): ComposedTracking | null {
  const { scale, polarEnabled, sceneEntities, segmentBase, refPoints, matchTolerancePx } = input;
  const worldTolerance = pixelsToWorld(matchTolerancePx ?? DEFAULT_ALIGN_TOLERANCE_PX, scale);
  // Τα ρητά reference points ως transient anchors (acquiredAt:0, εκτός FIFO), ΠΡΩΤΑ, μαζί με τα
  // AutoCAD hover-acquired store points. Κενό refPoints ⇒ store-only (parity σχεδίασης/περιστροφής).
  const refAnchors: AcquiredTrackingPoint[] = (refPoints ?? []).map((p) => ({
    x: p.x, y: p.y, acquiredAt: 0, sourceSnapType: REF_POINT_SOURCE,
  }));
  const acquired: readonly AcquiredTrackingPoint[] = refAnchors.length > 0
    ? [...refAnchors, ...TrackingPointStore.getPoints()]
    : TrackingPointStore.getPoints();
  // Ambient (Revit-style auto-anchors): only when the caller supplied a scene snapshot
  // (already gated on the AutoAlign toggle). radius/maxMembers read live from the SSoT.
  const ambientCfg = ambientAlignmentConfigStore.getSnapshot();
  const ambient = sceneEntities
    ? collectAmbientAlignmentAnchors(cursor, sceneEntities, {
        radiusWorld: pixelsToWorld(ambientCfg.radiusPx, scale),
        maxMembers: ambientCfg.maxMembers,
        axisToleranceWorld: worldTolerance,
      })
    : [];
  return composeTrackingSnap(cursor, acquired, ambient, {
    polar: {
      incrementAngle: polarTrackingStore.incrementAngle,
      additionalAngles: polarTrackingStore.additionalAngles,
      polarEnabled,
    },
    worldTolerance,
    worldPerPixel: worldPerPixel(scale),
    segmentBase: segmentBase ?? null,
  });
}
