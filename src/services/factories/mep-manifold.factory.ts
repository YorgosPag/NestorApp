/**
 * Plumbing Manifold Factory (ADR-408 Φ12).
 *
 * Mirror of `electrical-panel.factory.ts`. Pure factory for `MepManifoldEntity`
 * with IfcEntityMixin auto-population.
 *
 * Auto-populated:
 *   - `id`      : enterprise manifold ID (`generateMepManifoldId`, SOS N.6)
 *   - `ifcGuid` : 22-char IFC4 GlobalId, generated ONCE — never regenerate
 *   - `ifcType` : kind-dependent — IfcPipeFitting (water) / IfcFlowStorageDevice (drainage, Φ14)
 *   - `validation` : empty `BimValidation` shell unless supplied
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import {
  generateMepManifoldId,
} from '@/services/enterprise-id-convenience';
import {
  resolveManifoldIfcType,
  type MepManifoldEntity,
  type MepManifoldGeometry,
  type MepManifoldParams,
} from '@/subapps/dxf-viewer/bim/types/mep-manifold-types';
import {
  type CreateBimEntityInputBase,
  assembleBimEntity,
} from '@/services/factories/bim-entity-factory-base';

export interface CreateMepManifoldInput extends CreateBimEntityInputBase {
  /** Required: param block. */
  params: MepManifoldParams;
  /** Required: pre-computed geometry cache (caller responsibility). */
  geometry: MepManifoldGeometry;
}

/**
 * Produce a new `MepManifoldEntity` with IFC mixin auto-fill.
 */
export function createMepManifold(input: CreateMepManifoldInput): MepManifoldEntity {
  return {
    ...assembleBimEntity(
      {
        type: 'mep-manifold',
        kind: input.params.kind,
        layerId: input.layerId,
        params: input.params,
        geometry: input.geometry,
        ifcType: resolveManifoldIfcType(input.params.kind),
        generateId: generateMepManifoldId,
      },
      input,
    ),
    // ADR-408 Φ14 — kind-dependent IFC class (SSoT resolveManifoldIfcType):
    // water manifold → IfcPipeFitting, drainage collector → IfcFlowStorageDevice.
  };
}
