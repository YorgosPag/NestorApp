/**
 * Furniture Factory (ADR-410).
 *
 * Mirror of `mep-fixture.factory.ts`. Pure factory for `FurnitureEntity` with
 * IfcEntityMixin auto-population.
 *
 * Auto-populated:
 *   - `id`      : enterprise furniture ID (`generateFurnitureId`, SOS N.6)
 *   - `ifcGuid` : 22-char IFC4 GlobalId, generated ONCE — never regenerate
 *   - `ifcType` : 'IfcFurniture'
 *   - `validation` : empty `BimValidation` shell unless supplied
 *
 * @see docs/centralized-systems/reference/adrs/ADR-410-cc0-mesh-furniture-import.md
 */

import {
  generateFurnitureId,
} from '@/services/enterprise-id-convenience';
import type {
  FurnitureEntity,
  FurnitureGeometry,
  FurnitureParams,
} from '@/subapps/dxf-viewer/bim/types/furniture-types';
import {
  type CreateBimEntityInputBase,
  assembleBimEntity,
} from '@/services/factories/bim-entity-factory-base';

export interface CreateFurnitureInput extends CreateBimEntityInputBase {
  /** Required: param block. */
  params: FurnitureParams;
  /** Required: pre-computed geometry cache (caller responsibility). */
  geometry: FurnitureGeometry;
}

/**
 * Produce a new `FurnitureEntity` with IFC mixin auto-fill.
 *
 * @example
 * createFurniture({ params: { kind:'chair', assetId:'chair_01', position,
 *   rotationDeg:0, widthMm:500, depthMm:520, heightMm:900,
 *   mountingElevationMm:0 }, geometry, layerId });
 */
export function createFurniture(input: CreateFurnitureInput): FurnitureEntity {
  return assembleBimEntity(
    {
      type: 'furniture',
      kind: input.params.kind,
      layerId: input.layerId,
      params: input.params,
      geometry: input.geometry,
      ifcType: 'IfcFurniture',
      generateId: generateFurnitureId,
    },
    input,
  );
}
