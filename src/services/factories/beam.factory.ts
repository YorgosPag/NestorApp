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

import {
  generateBeamId,
  generateIfcGuid,
} from '@/services/enterprise-id-convenience';
import {
  DEFAULT_BEAM_Z_OFFSET_MM,
  type BeamEntity,
  type BeamGeometry,
  type BeamKind,
  type BeamParams,
} from '@/subapps/dxf-viewer/bim/types/beam-types';
import { makeBimValidation } from '@/subapps/dxf-viewer/bim/types/bim-base';
import type { BimValidation, BimQuantityTakeoff } from '@/subapps/dxf-viewer/bim/types/bim-base';
import type { IfcPropertySet } from '@/subapps/dxf-viewer/bim/types/ifc-entity-mixin';

/**
 * BeamParams caller input — `zOffset` optional (factory defaults σε 0).
 * `topElevation` παραμένει required (caller per-floor responsibility).
 */
type BeamParamsCallerInput = Omit<BeamParams, 'zOffset'> & {
  zOffset?: number;
};

export interface CreateBeamInput {
  /** Required: param block (zOffset optional — factory defaults 0). */
  params: BeamParamsCallerInput;
  /** Required: pre-computed geometry cache (caller responsibility). */
  geometry: BeamGeometry;
  /** Required: BaseEntity stable layer id (ADR-358 Phase 9E-6e). */
  layerId: string;
  /** Optional `visible` flag (BaseEntity). Default unset. */
  visible?: boolean;
  /** Optional override (test-only). Default = enterprise beam ID. */
  id?: string;
  /** Optional override (test-only). Default = generateIfcGuid(). */
  ifcGuid?: string;
  /** Optional sparse IFC Property Sets payload. */
  pset?: IfcPropertySet;
  /** Optional validation block. Default = empty BimValidation. */
  validation?: BimValidation;
  /** Optional QTO block. */
  qto?: BimQuantityTakeoff;
  /** Optional tenant fields — pass-through. */
  companyId?: string;
  projectId?: string;
  buildingId?: string;
  floorplanId?: string;
  floorId?: string;
  createdBy?: string;
  updatedBy?: string;
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
  const entity: BeamEntity = {
    id: input.id ?? generateBeamId(),
    type: 'beam',
    kind: params.kind,
    layerId: input.layerId,
    params,
    geometry: input.geometry,
    validation: input.validation ?? makeBimValidation(),
    ifcGuid: input.ifcGuid ?? generateIfcGuid(),
    ifcType: 'IfcBeam',
    ...(input.visible !== undefined && { visible: input.visible }),
    ...(input.pset !== undefined && { pset: input.pset }),
    ...(input.qto !== undefined && { qto: input.qto }),
    ...(input.companyId !== undefined && { companyId: input.companyId }),
    ...(input.projectId !== undefined && { projectId: input.projectId }),
    ...(input.buildingId !== undefined && { buildingId: input.buildingId }),
    ...(input.floorplanId !== undefined && { floorplanId: input.floorplanId }),
    ...(input.floorId !== undefined && { floorId: input.floorId }),
    ...(input.createdBy !== undefined && { createdBy: input.createdBy }),
    ...(input.updatedBy !== undefined && { updatedBy: input.updatedBy }),
  };
  return entity;
}

// Re-export BeamKind for caller convenience (test ergonomics).
export type { BeamKind };
