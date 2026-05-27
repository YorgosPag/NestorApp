/**
 * Stair doc → entity hydration + legacy param normalization.
 * Extracted from `use-stair-persistence` to keep the hook under the 500-line
 * cap (CLAUDE.md N.7.1). Pure functions, no React state.
 */

import { nowTimestamp } from '@/lib/firestore-now';
import { computeStairGeometry } from '../geometry/stairs/StairGeometryService';
import type {
  StairDoc,
  StairEntity,
  StairParams,
  StairValidationState,
} from '../types/stair-types';

/**
 * ADR-358 Phase 3f + 3g — back-compat hydration για legacy `StairDoc.params`:
 *
 *   - Phase 3f: l-shape variant χωρίς `cornerStyle` → defaults to `'landing'`.
 *   - Phase 3g: `nokSubType: 'secondary'` → rewritten σε `'low-rise'` (ίδιο
 *     legal width minimum 0.90 m· clearer semantic match στο ΝΟΚ scope table).
 */
export function hydrateLegacyStairParams(params: StairParams): StairParams {
  let out: StairParams = params;
  const v = out.variant;
  if (v.kind === 'l-shape' && (v as { cornerStyle?: string }).cornerStyle === undefined) {
    out = { ...out, variant: { ...v, cornerStyle: 'landing' } as typeof v };
  }
  if (out.nokSubType === 'secondary') {
    out = { ...out, nokSubType: 'low-rise' };
  }
  return out;
}

/**
 * Build a scene-side `StairEntity` from a persisted `StairDoc`. Geometry is
 * recomputed via the SSoT `computeStairGeometry` — ADR §G6: geometry is NOT
 * persisted (re-derivable from params).
 */
export function stairDocToEntity(doc: StairDoc): StairEntity {
  const validation: StairValidationState = doc.validation ?? {
    hasCodeViolations: false,
    violationKeys: [],
    lastValidatedAt: nowTimestamp(),
  };
  const params = hydrateLegacyStairParams(doc.params);
  return {
    id: doc.id,
    type: 'stair',
    kind: doc.kind,
    params,
    geometry: computeStairGeometry(params),
    validation,
    layerId: doc.layer ?? 'STAIRS',
    levelId: doc.levelId,
    floorId: doc.floorId,
    buildingId: doc.buildingId,
    visible: true,
    editingBy: doc.editingBy,
    qto: doc.qto,
  } as StairEntity;
}
