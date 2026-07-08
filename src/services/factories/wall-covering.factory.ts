/**
 * Wall Covering Factory (ADR-511).
 *
 * Pure factory για δημιουργία `WallCoveringEntity` με IfcEntityMixin auto-population
 * (ifcGuid + ifcType='IfcCovering'). Δεν γράφει σε Firestore — caller κάνει persist.
 *
 * Auto-populated:
 *   - `id`         : enterprise wall-covering ID (prefix 'wcv', N.6)
 *   - `kind`       : παράγεται από το assembly (`resolveWallCoveringKind` — paint/plaster/knauf/tiles/mixed)
 *   - `ifcGuid`    : 22-char IFC4 GlobalId, generated ONCE — never regenerate
 *   - `ifcType`    : 'IfcCovering' (PredefinedType=CLADDING/INTERIOR from serializer)
 *   - `validation` : empty `BimValidation` shell (ή caller-supplied)
 *
 * @see src/subapps/dxf-viewer/bim/types/wall-covering-types.ts
 * @see src/services/factories/floor-finish.factory.ts — το πρότυπο
 */

import {
  generateWallCoveringId,
} from '@/services/enterprise-id-convenience';
import {
  resolveWallCoveringKind,
  type WallCoveringEntity,
  type WallCoveringGeometry,
  type WallCoveringParams,
} from '@/subapps/dxf-viewer/bim/types/wall-covering-types';
import {
  type CreateBimEntityInputBase,
  assembleBimEntity,
} from '@/services/factories/bim-entity-factory-base';

export interface CreateWallCoveringInput extends CreateBimEntityInputBase {
  /** Required: param block (hostWallId + faceSide + span + height + layers assembly). */
  params: WallCoveringParams;
  /** Required: pre-computed geometry cache (caller responsibility). */
  geometry: WallCoveringGeometry;
}

/**
 * Παράγει νέο `WallCoveringEntity` με IFC mixin auto-fill. Το `kind` derive-άρεται από το
 * assembly (το «βαρύτερο» υλικό ορίζει την κατηγορία για BOQ/filter).
 */
export function createWallCovering(input: CreateWallCoveringInput): WallCoveringEntity {
  return assembleBimEntity(
    {
      type: 'wall-covering',
      kind: resolveWallCoveringKind(input.params.layers),
      layerId: input.layerId,
      params: input.params,
      geometry: input.geometry,
      ifcType: 'IfcCovering',
      generateId: generateWallCoveringId,
    },
    input,
  );
}
