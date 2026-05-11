/**
 * ADR-344 Phase 6.A — Layer edit guard (Q8).
 *
 * Pre-execute hook used by every Update*Command and DeleteTextCommand
 * to block mutations on locked/frozen layers when the user lacks the
 * `canUnlockLayer` capability. Frozen layers are blocked unconditionally
 * (AutoCAD parity: frozen entities are not editable).
 */

import {
  CanEditLayerError,
  type ILayerAccessProvider,
} from './types';

export interface AssertCanEditLayerInput {
  readonly layerName: string;
  readonly provider: ILayerAccessProvider;
}

/**
 * Throw CanEditLayerError if the target layer is locked/frozen and the
 * current user lacks the capability to unlock it. Missing layers are
 * treated as editable (the command will fail downstream on the scene
 * manager if the layer truly does not exist).
 */
export function assertCanEditLayer(input: AssertCanEditLayerInput): void {
  const { layerName, provider } = input;
  const layer = provider.getLayer(layerName);
  if (!layer) return;
  if (layer.frozen) throw new CanEditLayerError(layerName);
  if (layer.locked && !provider.canUnlockLayer) throw new CanEditLayerError(layerName);
}
