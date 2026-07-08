/**
 * Floorplan Symbol Factory (ADR-415 Φ1).
 *
 * Mirror of `furniture.factory.ts`. Pure factory for `FloorplanSymbolEntity` with
 * IfcEntityMixin auto-population. The `ifcType` is **category-driven** (Revit-
 * faithful): resolved from `params.category` via the category engine — a sanitary
 * symbol is `IfcSanitaryTerminal`, never `IfcFurniture`.
 *
 * Auto-populated:
 *   - `id`      : enterprise floorplan-symbol ID (`generateFloorplanSymbolId`, SOS N.6)
 *   - `ifcGuid` : 22-char IFC4 GlobalId, generated ONCE — never regenerate
 *   - `ifcType` : category-driven IFC4 class
 *   - `validation` : empty `BimValidation` shell unless supplied
 *
 * @see docs/centralized-systems/reference/adrs/ADR-415-2d-floorplan-symbol-library.md
 */

import {
  generateFloorplanSymbolId,
} from '@/services/enterprise-id-convenience';
import { resolveSymbolCategoryConfig } from '@/subapps/dxf-viewer/bim/floorplan-symbols/floorplan-symbol-categories';
import type {
  FloorplanSymbolEntity,
  FloorplanSymbolGeometry,
  FloorplanSymbolParams,
} from '@/subapps/dxf-viewer/bim/types/floorplan-symbol-types';
import {
  type CreateBimEntityInputBase,
  assembleBimEntity,
} from '@/services/factories/bim-entity-factory-base';

export interface CreateFloorplanSymbolInput extends CreateBimEntityInputBase {
  /** Required: param block. */
  params: FloorplanSymbolParams;
  /** Required: pre-computed geometry cache (caller responsibility). */
  geometry: FloorplanSymbolGeometry;
}

/**
 * Produce a new `FloorplanSymbolEntity` with IFC mixin auto-fill. `ifcType`
 * derives from `params.category` (category engine).
 */
export function createFloorplanSymbol(input: CreateFloorplanSymbolInput): FloorplanSymbolEntity {
  const { ifcType } = resolveSymbolCategoryConfig(input.params.category);
  return assembleBimEntity(
    {
      type: 'floorplan-symbol',
      kind: input.params.kind,
      layerId: input.layerId,
      params: input.params,
      geometry: input.geometry,
      ifcType: ifcType,
      generateId: generateFloorplanSymbolId,
    },
    input,
  );
}
