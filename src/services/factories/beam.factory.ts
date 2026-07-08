/**
 * Beam Factory (ADR-369 §2.2 + §9 Q5 + Q8) — Phase A4
 *
 * Pure factory function για δημιουργία `BeamEntity` με ADR-369 top-face
 * semantic + IfcEntityMixin auto-population (ifcGuid + ifcType='IfcBeam').
 * Δεν γράφει σε Firestore — caller κάνει persist.
 *
 * Auto-populated:
 *   - `id`            : enterprise beam ID (prefix 'beam')
 *   - `ifcGuid`       : 22-char IFC4 GlobalId, generated ONCE — never regenerate
 *   - `ifcType`       : 'IfcBeam' (πάντα — όλα τα 3 BeamKinds map σε IfcBeam)
 *   - `validation`    : empty `BimValidation` shell
 *   - `zOffset`       : 0 (DEFAULT_BEAM_Z_OFFSET_MM) όταν απουσιάζει από input
 *
 * `topElevation` είναι required στο input — caller το ορίζει per floor (Hybrid A
 * FFL: default = floor.elevation σε mm). Δεν υπάρχει factory-level default.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-369-bim-elevation-convention-revit-alignment.md §2.2, §9 Q5, §9 Q8
 */

import { generateBeamId } from '@/services/enterprise-id-convenience';
import {
  DEFAULT_BEAM_Z_OFFSET_MM,
  type BeamEntity,
  type BeamGeometry,
  type BeamKind,
  type BeamParams,
} from '@/subapps/dxf-viewer/bim/types/beam-types';
import {
  type CreateBimEntityInputBase,
  assembleBimEntity,
} from '@/services/factories/bim-entity-factory-base';

/**
 * BeamParams caller input — `zOffset` optional (factory defaults σε 0).
 * `topElevation` παραμένει required (caller per-floor responsibility).
 */
type BeamParamsCallerInput = Omit<BeamParams, 'zOffset'> & {
  zOffset?: number;
};

export interface CreateBeamInput extends CreateBimEntityInputBase {
  /** Required: param block (zOffset optional — factory defaults 0). */
  params: BeamParamsCallerInput;
  /** Required: pre-computed geometry cache (caller responsibility). */
  geometry: BeamGeometry;
}

function resolveBeamParams(input: BeamParamsCallerInput): BeamParams {
  return {
    ...input,
    zOffset: input.zOffset ?? DEFAULT_BEAM_Z_OFFSET_MM,
    offsetFromStorey: input.offsetFromStorey ?? 0,
  };
}

/**
 * Παράγει νέο `BeamEntity` με ADR-369 zOffset default + IFC mixin auto-fill.
 *
 * @example
 * createBeam({ params: { kind:'straight', startPoint, endPoint, width:250,
 *   depth:500, topElevation:3000 }, geometry, layerId:'lyr_x' });
 * // → ifcType='IfcBeam', zOffset=0
 */
export function createBeam(input: CreateBeamInput): BeamEntity {
  const params = resolveBeamParams(input.params);
  return assembleBimEntity(
    {
      type: 'beam',
      kind: params.kind,
      layerId: input.layerId,
      params,
      geometry: input.geometry,
      ifcType: 'IfcBeam',
      generateId: generateBeamId,
    },
    input,
  );
}

// Re-export BeamKind for caller convenience (test ergonomics).
export type { BeamKind };
