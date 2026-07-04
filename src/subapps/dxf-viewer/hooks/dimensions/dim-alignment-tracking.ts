/**
 * ADR-562 Φ9 / ADR-357 — Alignment-tracking SSoT wrapper για τις διαστάσεις.
 *
 * Οι ροές της διάστασης (δημιουργία / λαβές / μετακίνηση) χρειάζονται τα ΙΔΙΑ ίχνη
 * ευθυγράμμισης με κάθε άλλο εργαλείο, αλλά με έναν επιπλέον τύπο anchor: τα **ήδη
 * picked σημεία** της τρέχουσας ενέργειας (clicks δημιουργίας ή τα υπόλοιπα defPoints
 * της διάστασης). Το `resolveAlignmentTracking` διαβάζει μόνο store+ambient, οπότε εδώ
 * περνάμε ΡΗΤΑ τα reference points ως extra anchors — ακριβώς όπως το
 * `rotation-tracking-overlay` περνά το pivot.
 *
 * Ίδια μηχανή (`composeTrackingSnap`), ίδιο ambient gate, ίδιο adaptive-distance quantize
 * — μηδέν παράλληλο σύστημα. ΕΝΑ brain, τώρα τρεις ακόμη consumers (dim create/grip/move).
 *
 * @see systems/tracking/resolve-alignment-tracking.ts — ο generic wrapper (store+ambient)
 * @see hooks/tools/rotation-tracking-overlay.ts — το πρότυπο grip-drag consumer
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import { TrackingPointStore, type AcquiredTrackingPoint } from '../../systems/tracking/TrackingPointStore';
import { composeTrackingSnap, type ComposedTracking } from '../../systems/tracking/ambient-tracking-compose';
import { collectAmbientAlignmentAnchors } from '../../systems/tracking/ambient-alignment-source';
import { ambientAlignmentConfigStore } from '../../systems/tracking/ambient-alignment-config-store';
import { polarTrackingStore } from '../../systems/constraints/polar-tracking-store';
import { worldPerPixel, pixelsToWorld } from '../../rendering/utils/viewport-scale';

/** `sourceSnapType` tag για τα explicit reference points της τρέχουσας διάστασης. */
const DIM_REF_SOURCE = 'dim-refpoint';

export interface DimAlignmentInput {
  /** Live transform scale (viewport). */
  readonly scale: number;
  /** F10 polar increments συμμετέχουν (true ⇔ POLAR on && !ORTHO). */
  readonly polarEnabled: boolean;
  /**
   * Scene entities για τα ambient (Revit-style) anchors, Ή null για παράλειψη
   * (acquired/ref-only). Ο CALLER κάνει το gate πίσω από το AutoAlign toggle
   * (`ambientAlignmentConfigStore.enabled`) ώστε το scene read να μένει lazy.
   */
  readonly sceneEntities: readonly Entity[] | null;
}

/**
 * Resolve το καλύτερο alignment-path snap από (refPoints ⊕ acquired ⊕ ambient) προς τον
 * `cursor`. Επιστρέφει null όταν δεν υπάρχει anchor / path εντός tolerance (ο caller κρατά
 * τον raw cursor). Τα `refPoints` είναι τα ήδη-picked σημεία της τρέχουσας διάστασης.
 */
export function resolveDimAlignmentTracking(
  cursor: Point2D,
  refPoints: readonly Point2D[],
  input: DimAlignmentInput,
): ComposedTracking | null {
  const { scale, polarEnabled, sceneEntities } = input;
  const worldTolerance = pixelsToWorld(3, scale);

  // Τα ήδη-picked σημεία ως ρητά anchors (transient — acquiredAt:0, δεν μπαίνουν στο FIFO),
  // μαζί με τα AutoCAD hover-acquired points.
  const refAnchors: AcquiredTrackingPoint[] = refPoints.map((p) => ({
    x: p.x, y: p.y, acquiredAt: 0, sourceSnapType: DIM_REF_SOURCE,
  }));
  const acquired: readonly AcquiredTrackingPoint[] = [...refAnchors, ...TrackingPointStore.getPoints()];

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
