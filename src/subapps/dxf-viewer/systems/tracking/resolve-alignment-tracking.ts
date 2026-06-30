/**
 * @module resolve-alignment-tracking
 * @description SSoT για το «Object Snap Tracking» resolve (πορτοκαλί polar συμμετέχει μέσα στο
 * resolver, λευκή/AutoAlign alignment). ΕΝΑ brain — δύο consumers:
 *   1) σχεδίαση (`drawing-hover-handler.processDrawingHover`) — ref = lastRefPt / BIM anchor,
 *   2) περιστροφή (`rotation-tracking-overlay`) — ref = pivot.
 *
 * Πριν την εξαγωγή, το block ζούσε inline ΜΟΝΟ στο `drawing-hover-handler` (γι' αυτό η περιστροφή
 * δεν έδειχνε ίχνη ευθυγράμμισης). Τώρα είναι κοινό — μηδέν παράλληλη μηχανή.
 *
 * @see ADR-357 Phase 4 — Object Snap Tracking
 * @see ADR-397 — rotation hot-grip (νέος consumer)
 */
import type { Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import { TrackingPointStore } from './TrackingPointStore';
import { composeTrackingSnap, type ComposedTracking } from './ambient-tracking-compose';
import { collectAmbientAlignmentAnchors } from './ambient-alignment-source';
import { ambientAlignmentConfigStore } from './ambient-alignment-config-store';
import { polarTrackingStore } from '../constraints/polar-tracking-store';
import { worldPerPixel, pixelsToWorld } from '../../rendering/utils/viewport-scale';

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
}

/**
 * Resolve the best alignment-path snap from (acquired ⊕ ambient) anchors toward `cursor`.
 * Returns null when there are no anchors / no path within tolerance (caller keeps the raw
 * cursor). The "magic" adaptive-distance quantize lives inside `composeTrackingSnap`.
 *
 * SSoT — identical resolve for the drawing rubber-band AND the rotation sweep (parity).
 */
export function resolveAlignmentTracking(
  cursor: Point2D,
  input: AlignmentTrackingInput,
): ComposedTracking | null {
  const { scale, polarEnabled, sceneEntities } = input;
  const worldTolerance = pixelsToWorld(3, scale);
  const acquired = TrackingPointStore.getPoints();
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
  });
}
