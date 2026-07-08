/**
 * Roof Factory (ADR-417, Φ1).
 *
 * Pure factory για δημιουργία `RoofEntity` με IfcEntityMixin auto-population
 * (ifcGuid + ifcType='IfcRoof'). Δεν γράφει σε Firestore — caller κάνει persist.
 *
 * Auto-populated:
 *   - `id`         : enterprise roof ID (prefix 'roof', N.6)
 *   - `ifcGuid`    : 22-char IFC4 GlobalId, generated ONCE — never regenerate
 *   - `ifcType`    : 'IfcRoof' (πάντα — PredefinedType = derived geometry.shape)
 *   - `validation` : empty `BimValidation` shell (ή caller-supplied)
 *
 * @see bim/types/roof-types.ts
 * @see src/services/factories/slab.factory.ts — το πρότυπο
 */

import {
  generateRoofId,
} from '@/services/enterprise-id-convenience';
import type {
  RoofEntity,
  RoofGeometry,
  RoofParams,
} from '@/subapps/dxf-viewer/bim/types/roof-types';
import {
  type CreateBimEntityInputBase,
  assembleBimEntity,
} from '@/services/factories/bim-entity-factory-base';
import type { RoofTypeParams } from '@/subapps/dxf-viewer/bim/types/bim-family-type';

export interface CreateRoofInput extends CreateBimEntityInputBase {
  /** Required: param block (footprint + per-edge slopes + slopeUnit + basePivotZ). */
  params: RoofParams;
  /** Required: pre-computed geometry cache (caller responsibility). */
  geometry: RoofGeometry;
  /** ADR-412 — FK → BimFamilyType.id (RoofType). */
  typeId?: string;
  /** ADR-412 — per-instance overrides of type-level params. */
  typeOverrides?: Partial<RoofTypeParams>;
}

/**
 * Παράγει νέο `RoofEntity` με IFC mixin auto-fill.
 *
 * @example
 * createRoof({ params: { outline, edges, slopeUnit:'deg', basePivotZ:3000,
 *   thickness:434 }, geometry, layerId:'lyr_x' }); // → ifcType='IfcRoof'
 */
export function createRoof(input: CreateRoofInput): RoofEntity {
  return {
    ...assembleBimEntity(
      {
        type: 'roof',
        kind: 'roof',
        layerId: input.layerId,
        params: input.params,
        geometry: input.geometry,
        ifcType: 'IfcRoof',
        generateId: generateRoofId,
      },
      input,
    ),
    ...(input.typeId !== undefined && { typeId: input.typeId }),
    ...(input.typeOverrides !== undefined && { typeOverrides: input.typeOverrides }),
  };
}
