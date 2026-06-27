/**
 * Beam persistence — pure helpers.
 * Extracted from `useBeamPersistence.ts` for file-size compliance (<500 lines);
 * behavior-preserving.
 *
 * @module hooks/data/beam-persistence-helpers
 * @see ./useBeamPersistence.ts
 */

import type { BeamEntity } from '../../bim/types/beam-types';
import { computeBeamGeometry } from '../../bim/geometry/beam-geometry';
import { validateBeamParams } from '../../bim/validators/beam-validator';
import type { BeamDoc } from '../../bim/beams/beam-firestore-service';

/**
 * Build scene-side `BeamEntity` από persisted `BeamDoc`. Geometry +
 * validation recomputed via SSoT pure functions.
 */
export function beamDocToEntity(doc: BeamDoc): BeamEntity {
  const validation = doc.validation ?? validateBeamParams(doc.params).bimValidation;
  return {
    id: doc.id,
    type: 'beam',
    kind: doc.kind,
    layerId: doc.layerId ?? '0',
    params: doc.params,
    geometry: doc.geometry ?? computeBeamGeometry(doc.params),
    validation,
    visible: true,
    // ADR-441 Slice GEN-BEAM — restore grid hosting bindings ώστε ο born-bound
    // δοκός να ξανα-ακολουθεί τον άξονα μετά reload (αλλιώς χάνει το hosting).
    ...(doc.guideBindings !== undefined && { guideBindings: doc.guideBindings }),
    // ADR-539 Φ3d — restore per-face appearance ώστε η βαφή όψεων να επιβιώνει του reload.
    ...(doc.faceAppearance !== undefined && { faceAppearance: doc.faceAppearance }),
  } as BeamEntity;
}
