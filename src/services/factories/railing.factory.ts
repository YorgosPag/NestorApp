/**
 * Railing Factory (ADR-407).
 *
 * Mirror of `mep-fixture.factory.ts`. Pure factory for `RailingEntity` with
 * IfcEntityMixin auto-population.
 *
 * Auto-populated:
 *   - `id`      : enterprise railing ID (`generateRailingId`, SOS N.6)
 *   - `ifcGuid` : 22-char IFC4 GlobalId, generated ONCE — never regenerate
 *   - `ifcType` : 'IfcRailing'
 *   - `kind`    : always 'railing' (PredefinedType lives on the Type)
 *   - `validation` : empty `BimValidation` shell unless supplied
 *
 * @see docs/centralized-systems/reference/adrs/ADR-407-bim-railings.md
 */

import {
  generateRailingId,
} from '@/services/enterprise-id-convenience';
import type {
  RailingEntity,
  RailingGeometry,
  RailingParams,
} from '@/subapps/dxf-viewer/bim/types/railing-types';
import {
  type CreateBimEntityInputBase,
  assembleBimEntity,
} from '@/services/factories/bim-entity-factory-base';

export interface CreateRailingInput extends CreateBimEntityInputBase {
  /** Required: param block (Type + path + heights). */
  params: RailingParams;
  /** Required: pre-computed geometry cache (caller responsibility). */
  geometry: RailingGeometry;
}

/**
 * Produce a new `RailingEntity` with IFC mixin auto-fill.
 *
 * @example
 * createRailing({ params: { type: DEFAULT_RAILING_TYPE,
 *   pathSource: { kind: 'sketch', path }, totalHeightMm: 1000,
 *   baseElevationMm: 0 }, geometry, layerId });
 */
export function createRailing(input: CreateRailingInput): RailingEntity {
  return assembleBimEntity(
    {
      type: 'railing',
      kind: 'railing',
      layerId: input.layerId,
      params: input.params,
      geometry: input.geometry,
      ifcType: 'IfcRailing',
      generateId: generateRailingId,
    },
    input,
  );
}
