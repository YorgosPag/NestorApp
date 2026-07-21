/**
 * Generic Solid Factory (ADR-684 Φ2).
 *
 * Mirror του `furniture.factory.ts`. Καθαρό factory για `GenericSolidEntity` με αυτόματο
 * IfcEntityMixin.
 *
 * Auto-populated:
 *   - `id`      : enterprise generic-solid ID (`generateGenericSolidId`, SOS N.6)
 *   - `ifcGuid` : 22-char IFC4 GlobalId, generated ONCE — ποτέ regenerate
 *   - `ifcType` : 'IfcBuildingElementProxy' (γεωμετρία χωρίς δομική σημασιολογία, ίδιο με imported-mesh)
 *   - `validation` : κενό `BimValidation` shell εκτός αν δοθεί
 *
 * @see docs/centralized-systems/reference/adrs/ADR-684-generic-solid-primitive-entity.md
 */

import { generateGenericSolidId } from '@/services/enterprise-id-convenience';
import type {
  GenericSolidEntity,
  GenericSolidGeometry,
  GenericSolidParams,
} from '@/subapps/dxf-viewer/bim/entities/generic-solid/generic-solid-types';
import {
  type CreateBimEntityInputBase,
  assembleBimEntity,
} from '@/services/factories/bim-entity-factory-base';

export interface CreateGenericSolidInput extends CreateBimEntityInputBase {
  /** Required: param block (φέρει το `shape` discriminated union). */
  params: GenericSolidParams;
  /** Required: pre-computed geometry cache (ευθύνη του καλούντος). */
  geometry: GenericSolidGeometry;
}

/**
 * Παράγει νέο `GenericSolidEntity` με IFC mixin auto-fill.
 *
 * @example
 * createGenericSolid({ params: { kind:'generic', shape:{ kind:'box', widthMm:500,
 *   depthMm:500, heightMm:500 }, position, rotationDeg:0, mountingElevationMm:0 },
 *   geometry, layerId });
 */
export function createGenericSolid(input: CreateGenericSolidInput): GenericSolidEntity {
  return assembleBimEntity(
    {
      type: 'generic-solid',
      kind: input.params.kind,
      layerId: input.layerId,
      params: input.params,
      geometry: input.geometry,
      ifcType: 'IfcBuildingElementProxy',
      generateId: generateGenericSolidId,
    },
    input,
  );
}
