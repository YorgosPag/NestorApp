/**
 * SceneValidator
 * Handles scene validation logic
 */

import { dwarn } from '../debug';
import type { AnySceneEntity, SceneModel } from '../types/scene';

export class SceneValidator {
  validateScene(scene: SceneModel): boolean {
    if (!scene || typeof scene !== 'object') {
      return false;
    }

    if (!Array.isArray(scene.entities)) {
      dwarn('🎭 Scene missing valid entities array');
      return false;
    }

    // ADR-358 Phase 9E-6b: accept scenes where layersById is present even if layers is absent.
    if ((!scene.layers && !scene.layersById) || typeof (scene.layersById ?? scene.layers) !== 'object') {
      dwarn('🎭 Scene missing valid layers object');
      return false;
    }

    return true;
  }

  validateEntity(entity: AnySceneEntity): boolean {
    if (!entity || typeof entity !== 'object') {
      dwarn('🎭 Invalid entity object');
      return false;
    }

    if (!entity.id) {
      dwarn('🎭 Entity missing required id');
      return false;
    }

    return true;
  }

  validateEntityUpdate(updates: Partial<AnySceneEntity>): boolean {
    if (!updates || typeof updates !== 'object') {
      dwarn('🎭 Invalid entity updates object');
      return false;
    }

    return true;
  }
}
