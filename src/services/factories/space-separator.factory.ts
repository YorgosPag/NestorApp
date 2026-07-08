/**
 * Space Separator Factory (ADR-437).
 *
 * Pure factory για δημιουργία `SpaceSeparatorEntity` με IfcEntityMixin auto-population
 * (ifcGuid + ifcType='IfcVirtualElement'). Δεν γράφει σε Firestore — caller κάνει persist.
 *
 * Auto-populated:
 *   - `id`         : enterprise space-separator ID (prefix 'ssp', N.6)
 *   - `kind`       : SpaceSeparatorKind ('room-bounding')
 *   - `ifcGuid`    : 22-char IFC4 GlobalId, generated ONCE — never regenerate
 *   - `ifcType`    : 'IfcVirtualElement' (πάντα — virtual boundary)
 *   - `validation` : empty `BimValidation` shell (ή caller-supplied)
 *
 * @see bim/types/space-separator-types.ts
 * @see src/services/factories/thermal-space.factory.ts — το πρότυπο (L0 entity)
 */

import {
  generateSpaceSeparatorId,
} from '@/services/enterprise-id-convenience';
import type {
  SpaceSeparatorEntity,
  SpaceSeparatorGeometry,
  SpaceSeparatorKind,
  SpaceSeparatorParams,
} from '@/subapps/dxf-viewer/bim/types/space-separator-types';
import { DEFAULT_SPACE_SEPARATOR_KIND } from '@/subapps/dxf-viewer/bim/types/space-separator-types';
import {
  type CreateBimEntityInputBase,
  assembleBimEntity,
} from '@/services/factories/bim-entity-factory-base';

export interface CreateSpaceSeparatorInput extends CreateBimEntityInputBase {
  /** Required: param block (start + end + optional name). */
  params: SpaceSeparatorParams;
  /** Required: pre-computed geometry cache (caller responsibility). */
  geometry: SpaceSeparatorGeometry;
  /** Optional discriminator. Default = 'room-bounding'. */
  kind?: SpaceSeparatorKind;
}

/**
 * Παράγει νέο `SpaceSeparatorEntity` με IFC mixin auto-fill.
 *
 * @example
 * createSpaceSeparator({ params: { start, end }, geometry, layerId:'lyr_x' });
 *   // → ifcType='IfcVirtualElement', kind='room-bounding'
 */
export function createSpaceSeparator(input: CreateSpaceSeparatorInput): SpaceSeparatorEntity {
  return assembleBimEntity(
    {
      type: 'space-separator',
      kind: input.kind ?? DEFAULT_SPACE_SEPARATOR_KIND,
      layerId: input.layerId,
      params: input.params,
      geometry: input.geometry,
      ifcType: 'IfcVirtualElement',
      generateId: generateSpaceSeparatorId,
    },
    input,
  );
}
