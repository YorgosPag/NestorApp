/**
 * ADR-344 Phase 6.D — Jest manual mock for useCurrentSceneModel.
 *
 * Bypasses the heavy LevelsSystem → Firebase import chain so tests of
 * the panel selectors can drive scene state through a plain setter.
 */

import type { SceneModel } from '../../../../types/scene';

let _scene: SceneModel | null = null;

export function __setMockScene(scene: SceneModel | null): void {
  _scene = scene;
}

export function useCurrentSceneModel(): SceneModel | null {
  return _scene;
}
