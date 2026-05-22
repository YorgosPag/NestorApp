/**
 * Resolves top-5 alternative materials from the wall-material-catalog SSoT.
 * ADR-366 C.4.Q1. Phase 6+ Asset Manager will swap defaultWallMaterialCatalog
 * with a Firestore-backed provider via WallMaterialCatalogProvider interface.
 */

import {
  defaultWallMaterialCatalog,
  type WallMaterialOption,
} from '../../../bim/walls/wall-material-catalog';

const MAX_ALTERNATIVES = 5;

export function resolveTopAlternatives(
  currentMaterialId: string | undefined,
): readonly WallMaterialOption[] {
  return defaultWallMaterialCatalog
    .listMaterialIds()
    .filter((opt) => opt.id !== 'custom' && opt.id !== currentMaterialId)
    .slice(0, MAX_ALTERNATIVES);
}
