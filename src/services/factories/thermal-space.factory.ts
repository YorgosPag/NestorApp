/**
 * Thermal Space Factory (ADR-422 L0).
 *
 * Pure factory για δημιουργία `ThermalSpaceEntity` με IfcEntityMixin auto-population
 * (ifcGuid + ifcType='IfcSpace'). Δεν γράφει σε Firestore — caller κάνει persist.
 *
 * Auto-populated:
 *   - `id`         : enterprise thermal-space ID (prefix 'tsp', N.6)
 *   - `kind`       : useType (η χρήση χώρου — ΤΟΤΕΕ· 'bedroom'/'kitchen'/… κ.ά.)
 *   - `ifcGuid`    : 22-char IFC4 GlobalId, generated ONCE — never regenerate
 *   - `ifcType`    : 'IfcSpace' (πάντα — αναλυτικός χώρος HVAC)
 *   - `validation` : empty `BimValidation` shell (ή caller-supplied)
 *
 * @see bim/types/thermal-space-types.ts
 * @see src/services/factories/floor-finish.factory.ts — το πρότυπο (area entity)
 */

import {
  generateThermalSpaceId,
} from '@/services/enterprise-id-convenience';
import type {
  ThermalSpaceEntity,
  ThermalSpaceGeometry,
  ThermalSpaceParams,
} from '@/subapps/dxf-viewer/bim/types/thermal-space-types';
import {
  type CreateBimEntityInputBase,
  assembleBimEntity,
} from '@/services/factories/bim-entity-factory-base';

export interface CreateThermalSpaceInput extends CreateBimEntityInputBase {
  /** Required: param block (footprint polygon + useType + ceilingHeightMm + overrides). */
  params: ThermalSpaceParams;
  /** Required: pre-computed geometry cache (caller responsibility). */
  geometry: ThermalSpaceGeometry;
}

/**
 * Παράγει νέο `ThermalSpaceEntity` με IFC mixin auto-fill.
 *
 * @example
 * createThermalSpace({ params: { footprint, useType:'bedroom',
 *   ceilingHeightMm:3000 }, geometry, layerId:'lyr_x' });
 *   // → ifcType='IfcSpace', kind='bedroom'
 */
export function createThermalSpace(input: CreateThermalSpaceInput): ThermalSpaceEntity {
  return assembleBimEntity(
    {
      type: 'thermal-space',
      kind: input.params.useType,
      layerId: input.layerId,
      params: input.params,
      geometry: input.geometry,
      ifcType: 'IfcSpace',
      generateId: generateThermalSpaceId,
    },
    input,
  );
}
