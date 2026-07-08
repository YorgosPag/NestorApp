/**
 * Foundation Factory (ADR-436, Slice 0).
 *
 * Mirror του `column.factory.ts`. Pure factory function για `FoundationEntity`
 * με IfcEntityMixin auto-population. ΧΩΡΙΣ Firestore write (persistence = Slice 1).
 *
 * Auto-populated:
 *   - `id`              : enterprise foundation ID (prefix 'fnd', ADR-294)
 *   - `ifcGuid`         : 22-char IFC4 GlobalId, generated ONCE — never regenerate
 *   - `ifcType`         : 'IfcFooting' (πάντα — όλα τα 3 kinds map σε IfcFooting)
 *   - `predefinedType`  : από `FOUNDATION_IFC_MAP[kind]` (PAD/STRIP/FOOTING_BEAM)
 *   - `validation`      : empty `BimValidation` shell
 *
 * @see docs/centralized-systems/reference/adrs/ADR-436-bim-foundation-discipline.md
 */

import { generateFoundationId } from '@/services/enterprise-id-convenience';
import {
  FOUNDATION_IFC_MAP,
  type FoundationEntity,
  type FoundationGeometry,
  type FoundationParams,
} from '@/subapps/dxf-viewer/bim/types/foundation-types';
import {
  type CreateBimEntityInputBase,
  assembleBimEntity,
} from '@/services/factories/bim-entity-factory-base';

export interface CreateFoundationInput extends CreateBimEntityInputBase {
  /** Required: param block (discriminated union ανά kind). */
  params: FoundationParams;
  /** Required: pre-computed geometry cache (caller responsibility, Slice 1). */
  geometry: FoundationGeometry;
}

/**
 * Παράγει νέο `FoundationEntity` με IFC mixin auto-fill. `predefinedType`
 * προκύπτει ντετερμινιστικά από το `params.kind` (SSoT `FOUNDATION_IFC_MAP`).
 *
 * @example
 * createFoundation({ params: buildDefaultFoundationParams('pad'), geometry, layerId });
 * // → ifcType='IfcFooting', predefinedType='PAD_FOOTING'
 */
export function createFoundation(input: CreateFoundationInput): FoundationEntity {
  const { params } = input;
  return {
    ...assembleBimEntity(
      {
        type: 'foundation',
        kind: params.kind,
        layerId: input.layerId,
        params,
        geometry: input.geometry,
        ifcType: 'IfcFooting',
        generateId: generateFoundationId,
      },
      input,
    ),
    predefinedType: FOUNDATION_IFC_MAP[params.kind],
  };
}
