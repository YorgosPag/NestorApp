/**
 * SceneUpdateManager  
 * Handles scene update coordination and state management
 */

import { dlog, dwarn, derr } from '../debug';
import { SceneValidator } from './SceneValidator';
import { SceneStatistics } from './SceneStatistics';
import type { SceneModel, AnySceneEntity } from '../types/scene';

interface SceneUpdateOptions {
  skipRendererUpdate?: boolean;
  source?: string;
  reason?: string;
}

// 🏢 ENTERPRISE: Type-safe renderer interface
interface SceneRenderer {
  setScene: (scene: SceneModel | null) => void;
  render?: () => void;
  clear?: () => void;
}

export class SceneUpdateManager {
  private currentScene: SceneModel | null = null;
  private renderer: SceneRenderer | null = null;
  private reactSetScene: ((scene: SceneModel | null) => void) | null = null;
  private sceneVersion = 0;
  private updateInProgress = false;
  private validator: SceneValidator;
  private statistics: SceneStatistics;
  /** O(1) entity lookup — entityId → index in currentScene.entities */
  private entityIndex = new Map<string, number>();

  constructor() {
    this.validator = new SceneValidator();
    this.statistics = new SceneStatistics();
  }

  // ═══ INITIALIZATION ═══

  setRenderer(renderer: SceneRenderer): void {
    this.renderer = renderer;
    dlog('🎬 Renderer registered');
  }

  setReactSetScene(setScene: (scene: SceneModel | null) => void): void {
    this.reactSetScene = setScene;
    dlog('🎭 React setScene registered');
  }

  // ═══ SCENE UPDATE ═══

  updateScene(
    newScene: SceneModel | null,
    options: SceneUpdateOptions = {}
  ): void {
    const { 
      skipRendererUpdate = false, 
      source = 'unknown',
      reason = 'manual'
    } = options;

    // Prevent concurrent updates
    if (this.updateInProgress) {
      this.statistics.incrementSkippedUpdates();
      dwarn('⏸️ Scene update skipped - update in progress');
      return;
    }

    this.updateInProgress = true;
    this.statistics.incrementTotalUpdates();
    this.statistics.setLastUpdateSource(source);

    try {
      // Validate scene
      if (newScene && !this.validator.validateScene(newScene)) {
        derr('🎭 Invalid scene provided');
        return;
      }

      // Update version
      if (newScene) {
        // SceneModel.version is optional string
        newScene.version = String(++this.sceneVersion);
      }

      const oldScene = this.currentScene;
      this.currentScene = newScene;
      this.rebuildEntityIndex(newScene?.entities ?? []);

      dlog('🎭 Scene updated:', {
        version: newScene?.version || 'null',
        entities: newScene?.entities?.length || 0,
        source,
        reason
      });

      // ═══ REACT UPDATE (Primary) ═══
      if (this.reactSetScene) {
        this.reactSetScene(newScene);
        this.statistics.incrementReactUpdates();
        dlog('🎭 React state updated');
      } else {
        dwarn('🎭 No React setScene callback registered');
      }

      // ═══ RENDERER UPDATE (Secondary) ═══
      const renderer = this.renderer;
      if (!skipRendererUpdate && renderer) {
        // Use requestAnimationFrame να μην clash με React rendering
        requestAnimationFrame(() => {
          try {
            if (renderer.setScene) {
              renderer.setScene(newScene);
              this.statistics.incrementRendererUpdates();
              dlog('🎭 Renderer updated');
            }
          } catch (error) {
            derr('🎭 Renderer update error:', error);
          }
        });
      }

    } catch (error) {
      derr('🎭 Scene update error:', error);
    } finally {
      this.updateInProgress = false;
    }
  }

  // ═══ ENTITY OPERATIONS ═══

  /** Rebuild entityId→index map after any scene replacement. O(n) once vs O(n) per lookup. */
  private rebuildEntityIndex(entities: readonly AnySceneEntity[]): void {
    this.entityIndex.clear();
    for (let i = 0; i < entities.length; i++) {
      this.entityIndex.set(entities[i].id, i);
    }
  }

  updateEntity(entityId: string, updates: Partial<AnySceneEntity>, source = 'entity-update'): void {
    if (!this.currentScene) {
      dwarn('🎭 Cannot update entity - no current scene');
      return;
    }

    if (!this.validator.validateEntityUpdate(updates)) {
      return;
    }

    const idx = this.entityIndex.get(entityId);
    if (idx === undefined) {
      dwarn(`🎭 updateEntity: entity not found: ${entityId}`);
      return;
    }

    // O(1) lookup + native slice (no per-element JS callbacks) instead of .map()
    const entities = this.currentScene.entities.slice() as AnySceneEntity[];
    entities[idx] = { ...entities[idx], ...updates } as AnySceneEntity;

    const updatedScene = { ...this.currentScene, entities };
    this.updateScene(updatedScene, { source, reason: `entity-${entityId}` });
  }

  /** Batch-update multiple entities in a single O(n_scene) pass and one scene commit. */
  updateEntities(updates: ReadonlyMap<string, Partial<AnySceneEntity>>, source = 'batch-entity-update'): void {
    if (!this.currentScene || updates.size === 0) return;

    const entities = this.currentScene.entities.slice() as AnySceneEntity[];
    let changed = false;

    for (const [entityId, entityUpdates] of updates) {
      if (!this.validator.validateEntityUpdate(entityUpdates)) continue;
      const idx = this.entityIndex.get(entityId);
      if (idx === undefined) {
        dwarn(`🎭 updateEntities: entity not found: ${entityId}`);
        continue;
      }
      entities[idx] = { ...entities[idx], ...entityUpdates } as AnySceneEntity;
      changed = true;
    }

    if (!changed) return;

    const updatedScene = { ...this.currentScene, entities };
    this.updateScene(updatedScene, { source, reason: `batch-${updates.size}-entities` });
  }

  addEntity(entity: AnySceneEntity, source = 'add-entity'): void {
    if (!this.currentScene) {
      dwarn('🎭 Cannot add entity - no current scene');
      return;
    }

    if (!this.validator.validateEntity(entity)) {
      return;
    }

    const updatedScene = {
      ...this.currentScene,
      entities: [...this.currentScene.entities, entity]
    };

    this.updateScene(updatedScene, { source, reason: `add-${entity.id}` });
  }

  removeEntity(entityId: string, source = 'remove-entity'): void {
    if (!this.currentScene) {
      dwarn('🎭 Cannot remove entity - no current scene');
      return;
    }

    const idx = this.entityIndex.get(entityId);
    if (idx === undefined) {
      dwarn(`🎭 removeEntity: entity not found: ${entityId}`);
      return;
    }

    // O(1) lookup + splice instead of .filter()
    const entities = this.currentScene.entities.slice() as AnySceneEntity[];
    entities.splice(idx, 1);
    const updatedScene = {
      ...this.currentScene,
      entities
    };

    this.updateScene(updatedScene, { source, reason: `remove-${entityId}` });
  }

  // ═══ GETTERS ═══

  getCurrentScene(): SceneModel | null {
    return this.currentScene;
  }

  getCurrentVersion(): number {
    return this.sceneVersion;
  }

  getStats() {
    return this.statistics.getStats(
      this.sceneVersion,
      this.currentScene,
      !!this.renderer,
      !!this.reactSetScene,
      this.updateInProgress
    );
  }

  // ═══ EMERGENCY METHODS ═══

  forceRendererSync(): void {
    if (this.renderer && this.currentScene) {
      this.renderer.setScene(this.currentScene);
      dlog('🎭 Forced renderer sync');
    }
  }

  resetScene(source = 'reset'): void {
    this.updateScene(null, { source, reason: 'reset' });
  }

  // ═══ CLEANUP ═══

  dispose(): void {
    this.currentScene = null;
    this.renderer = null;
    this.reactSetScene = null;
    this.updateInProgress = false;
    this.statistics.reset();
    dlog('🎭 SceneUpdateManager disposed');
  }

  // ═══ Z-ORDER METHODS ═══

  getEntityIndex(entityId: string): number {
    return this.entityIndex.get(entityId) ?? -1;
  }

  reorderEntity(entityId: string, direction: 'front' | 'back', source = 'reorder-entity'): void {
    if (!this.currentScene) return;
    const idx = this.entityIndex.get(entityId);
    if (idx === undefined) return;
    const entities = this.currentScene.entities.slice() as AnySceneEntity[];
    const [entity] = entities.splice(idx, 1);
    if (direction === 'front') entities.push(entity);
    else entities.unshift(entity);
    this.updateScene({ ...this.currentScene, entities }, { source, reason: `reorder-${direction}-${entityId}` });
  }

  moveEntityToIndex(entityId: string, targetIndex: number, source = 'move-entity-to-index'): void {
    if (!this.currentScene) return;
    const idx = this.entityIndex.get(entityId);
    if (idx === undefined) return;
    const entities = this.currentScene.entities.slice() as AnySceneEntity[];
    const [entity] = entities.splice(idx, 1);
    const clamped = Math.min(Math.max(0, targetIndex), entities.length);
    entities.splice(clamped, 0, entity);
    this.updateScene({ ...this.currentScene, entities }, { source, reason: `move-to-index-${targetIndex}-${entityId}` });
  }

  // ═══ DEBUG METHODS ═══

  debugCurrentScene() {
    if (this.currentScene) {

    } else {

    }
  }
}

// ═══ SINGLETON INSTANCE ═══
export const unifiedSceneManager = new SceneUpdateManager();

// ═══ CONVENIENCE FUNCTIONS (previously from UnifiedSceneManager) ═══

export function setScene(scene: SceneModel | null, options?: SceneUpdateOptions): void {
  unifiedSceneManager.updateScene(scene, options);
}

export function getCurrentScene(): SceneModel | null {
  return unifiedSceneManager.getCurrentScene();
}

export function updateEntity(entityId: string, updates: Partial<AnySceneEntity>): void {
  unifiedSceneManager.updateEntity(entityId, updates);
}

export function getSceneStats() {
  return unifiedSceneManager.getStats();
}

// Debug helpers
if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
  (window as Window & { debugScene?: unknown }).debugScene = {
    manager: unifiedSceneManager,
    stats: getSceneStats,
    current: getCurrentScene,
    debug: () => unifiedSceneManager.debugCurrentScene()
  };
}
