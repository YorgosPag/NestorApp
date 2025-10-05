/**
 * SceneValidator
 * Handles scene validation logic
 */

import { dwarn } from '../debug';
import type { AnySceneEntity, SceneLayer } from '../types/scene';

interface Scene {
  entities: AnySceneEntity[];
  layers: Record<string, SceneLayer>;
  version: number;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export class SceneValidator {
  validateScene(scene: Scene): boolean {
    if (!scene || typeof scene !== 'object') {
      return false;
    }

    if (!Array.isArray(scene.entities)) {
      dwarn('🎭 Scene missing valid entities array');
      return false;
    }

    if (!scene.layers || typeof scene.layers !== 'object') {
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