/**
 * Floor Finish Factory (ADR-419).
 *
 * Pure factory για δημιουργία `FloorFinishEntity` με IfcEntityMixin auto-population
 * (ifcGuid + ifcType='IfcCovering'). Δεν γράφει σε Firestore — caller κάνει persist.
 *
 * Auto-populated:
 *   - `id`         : enterprise floor-finish ID (prefix 'ffl', N.6)
 *   - `kind`       : materialId (stable catalog slug — 'floor-wood-oak' κ.ά.)
 *   - `ifcGuid`    : 22-char IFC4 GlobalId, generated ONCE — never regenerate
 *   - `ifcType`    : 'IfcCovering' (πάντα — PredefinedType=FLOORING from serializer)
 *   - `validation` : empty `BimValidation` shell (ή caller-supplied)
 *
 * @see bim/types/floor-finish-types.ts
 * @see src/services/factories/roof.factory.ts — το πρότυπο
 */

import {
  generateFloorFinishId,
} from '@/services/enterprise-id-convenience';
import type {
  FloorFinishEntity,
  FloorFinishGeometry,
  FloorFinishParams,
} from '@/subapps/dxf-viewer/bim/types/floor-finish-types';
import {
  type CreateBimEntityInputBase,
  assembleBimEntity,
} from '@/services/factories/bim-entity-factory-base';

export interface CreateFloorFinishInput extends CreateBimEntityInputBase {
  /** Required: param block (footprint polygon + materialId + thicknessMm + finishLevel). */
  params: FloorFinishParams;
  /** Required: pre-computed geometry cache (caller responsibility). */
  geometry: FloorFinishGeometry;
}

/**
 * Παράγει νέο `FloorFinishEntity` με IFC mixin auto-fill.
 *
 * @example
 * createFloorFinish({ params: { footprint, materialId:'floor-wood-oak',
 *   thicknessMm:15, finishLevel:0 }, geometry, layerId:'lyr_x' });
 *   // → ifcType='IfcCovering'
 */
export function createFloorFinish(input: CreateFloorFinishInput): FloorFinishEntity {
  return assembleBimEntity(
    {
      type: 'floor-finish',
      kind: input.params.materialId,
      layerId: input.layerId,
      params: input.params,
      geometry: input.geometry,
      ifcType: 'IfcCovering',
      generateId: generateFloorFinishId,
    },
    input,
  );
}
