/**
 * Underfloor (radiant floor) Heating Loop Factory (ADR-408 Εύρος Β #3).
 *
 * Mirror of `mep-boiler.factory.ts` for the AREA-based `MepUnderfloorEntity`. Pure
 * factory with IfcEntityMixin auto-population. Unlike the point-based hosts the
 * underfloor entity has NO `position`/`rotation`; its footprint polygon IS the entity.
 *
 * Auto-populated:
 *   - `id`      : enterprise underfloor ID (`generateMepUnderfloorId`, prefix `uhf`, SOS N.6)
 *   - `ifcGuid` : 22-char IFC4 GlobalId, generated ONCE — never regenerate
 *   - `ifcType` : 'IfcSpaceHeater'
 *   - `validation` : empty `BimValidation` shell unless supplied
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import {
  generateMepUnderfloorId,
} from '@/services/enterprise-id-convenience';
import type {
  MepUnderfloorEntity,
  MepUnderfloorGeometry,
  MepUnderfloorParams,
} from '@/subapps/dxf-viewer/bim/types/mep-underfloor-types';
import {
  type CreateBimEntityInputBase,
  assembleBimEntity,
} from '@/services/factories/bim-entity-factory-base';

export interface CreateMepUnderfloorInput extends CreateBimEntityInputBase {
  /** Required: param block (footprint + serpentine params + connectors). */
  params: MepUnderfloorParams;
  /** Required: pre-computed geometry cache (caller responsibility). */
  geometry: MepUnderfloorGeometry;
}

/**
 * Produce a new `MepUnderfloorEntity` with IFC mixin auto-fill.
 */
export function createMepUnderfloor(input: CreateMepUnderfloorInput): MepUnderfloorEntity {
  return assembleBimEntity(
    {
      type: 'mep-underfloor',
      kind: input.params.kind,
      layerId: input.layerId,
      params: input.params,
      geometry: input.geometry,
      ifcType: 'IfcSpaceHeater',
      generateId: generateMepUnderfloorId,
    },
    input,
  );
}
