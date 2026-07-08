/**
 * MEP Fixture Factory (ADR-406).
 *
 * Mirror of `column.factory.ts`. Pure factory for `MepFixtureEntity` with
 * IfcEntityMixin auto-population.
 *
 * Auto-populated:
 *   - `id`      : enterprise MEP fixture ID (`generateMepFixtureId`, SOS N.6)
 *   - `ifcGuid` : 22-char IFC4 GlobalId, generated ONCE — never regenerate
 *   - `ifcType` : derived from `params.kind` (light → IfcLightFixture, drain → IfcSanitaryTerminal)
 *   - `validation` : empty `BimValidation` shell unless supplied
 *
 * @see docs/centralized-systems/reference/adrs/ADR-406-point-based-mep-fixture.md
 */

import {
  generateMepFixtureId,
} from '@/services/enterprise-id-convenience';
import {
  resolveFixtureIfcType,
  type MepFixtureEntity,
  type MepFixtureGeometry,
  type MepFixtureParams,
} from '@/subapps/dxf-viewer/bim/types/mep-fixture-types';
import {
  type CreateBimEntityInputBase,
  assembleBimEntity,
} from '@/services/factories/bim-entity-factory-base';

export interface CreateMepFixtureInput extends CreateBimEntityInputBase {
  /** Required: param block. */
  params: MepFixtureParams;
  /** Required: pre-computed geometry cache (caller responsibility). */
  geometry: MepFixtureGeometry;
}

/**
 * Produce a new `MepFixtureEntity` with IFC mixin auto-fill.
 *
 * @example
 * createMepFixture({ params: { kind:'light-fixture', shape:'rectangular',
 *   position, rotation:0, width:600, length:600, bodyHeightMm:80,
 *   mountingElevationMm:2700 }, geometry, layerId });
 */
export function createMepFixture(input: CreateMepFixtureInput): MepFixtureEntity {
  return assembleBimEntity(
    {
      type: 'mep-fixture',
      kind: input.params.kind,
      layerId: input.layerId,
      params: input.params,
      geometry: input.geometry,
      ifcType: resolveFixtureIfcType(input.params.kind),
      generateId: generateMepFixtureId,
    },
    input,
  );
}
