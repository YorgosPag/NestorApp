/**
 * LEVEL SCENE MANAGER ADAPTER
 *
 * 🏢 ENTERPRISE (2026-01-30): Adapter implementing ISceneManager interface
 * Pattern: Autodesk/SAP - Adapter Pattern for decoupling command system from level management
 *
 * This adapter bridges the Command Pattern (CreateEntityCommand, DeleteEntityCommand, etc.)
 * with the Level System (useLevels hook's getLevelScene/setLevelScene).
 *
 * Architecture:
 * - Commands use ISceneManager interface (abstract)
 * - This adapter implements ISceneManager using concrete level functions
 * - Enables full undo/redo support for entity operations
 *
 * Usage (ADR-527 — construct ONLY through the cached factory, never `new` directly):
 * ```typescript
 * const adapter = createLevelSceneManagerAdapter(getLevelScene, setLevelScene, levelId);
 * const command = new CreateEntityCommand(entityData, adapter);
 * commandHistory.execute(command);
 * ```
 */

import type { ISceneManager, SceneEntity } from '../../core/commands/interfaces';
import type { Point2D } from '../../rendering/types/Types';
import type { SceneModel, AnySceneEntity, SceneBounds } from '../../types/scene';
// 🏢 ADR-130: Centralized Default Layer Name
import { DXF_DEFAULT_LAYER } from '../../config/layer-config';
// 🏢 ADR-XXX: Centralized Color Config
import { UI_COLORS } from '../../config/color-config';
// 🏢 ADR-102: Centralized Entity Type Guards
// 🏢 ADR-358 Phase 9C: createSceneLayer factory (SceneLayer.id required, auto-gen via enterprise-id)
import {
  isLineEntity,
  isCircleEntity,
  isRectangleEntity,
  isPolylineEntity,
  createSceneLayer,
  type Entity,
} from '../../types/entities';

/**
 * Type for getLevelScene function from useLevels hook
 */
type GetLevelSceneFunction = (levelId: string) => SceneModel | null;

/**
 * Type for setLevelScene function from useLevels hook
 */
type SetLevelSceneFunction = (levelId: string, scene: SceneModel) => void;

/**
 * 🏢 ENTERPRISE: Adapter that implements ISceneManager using Level System
 *
 * This adapter allows Commands (CreateEntityCommand, DeleteEntityCommand, etc.)
 * to interact with the Level-based scene storage without tight coupling.
 *
 * ADR-527 — STATELESS PASS-THROUGH (single source of truth). The adapter holds NO
 * scene state of its own: every read goes straight to `getLevelSceneFn` and every
 * write straight to `setLevelSceneFn`. The read-after-write guarantee that batch /
 * multi-command mutations rely on (e.g. `JoinEntityCommand` doing removeEntity +
 * removeEntity + addEntity, or a `CompoundCommand` applying N children) is owned by
 * the ONE live SSoT at the root — `useSceneManager.levelScenesRef`, which `setLevelScene`
 * updates SYNCHRONOUSLY (before the React `setState`) so the very next `getLevelScene`
 * in the same sync tick already reflects the write.
 *
 * Historical note: a per-instance `pendingScene` cache used to live here (2026-02-17) to
 * paper over a stale closure. Once the root `levelScenesRef` became the synchronous SSoT,
 * that cache was a DUPLICATE of the same read-after-write mechanism — and combined with
 * `new`-per-call it spawned N independent caches. ADR-527 removed it: one SSoT, one
 * singleton adapter (see `createLevelSceneManagerAdapter`).
 */
export class LevelSceneManagerAdapter implements ISceneManager {
  private readonly getLevelSceneFn: GetLevelSceneFunction;
  private readonly setLevelSceneFn: SetLevelSceneFunction;
  private readonly levelId: string;

  /**
   * Create a new adapter for a specific level
   *
   * @param getLevelScene - Function to get scene for a level (from useLevels)
   * @param setLevelScene - Function to set scene for a level (from useLevels)
   * @param levelId - The level ID this adapter operates on
   */
  constructor(
    getLevelScene: GetLevelSceneFunction,
    setLevelScene: SetLevelSceneFunction,
    levelId: string
  ) {
    this.getLevelSceneFn = getLevelScene;
    this.setLevelSceneFn = setLevelScene;
    this.levelId = levelId;
  }

  /**
   * ADR-527 — Read the current scene straight from the SSoT. The root
   * `levelScenesRef` is written synchronously by `setLevelScene`, so within a single
   * sync batch (CompoundCommand / JoinEntityCommand) each call already sees the prior
   * mutation — no per-instance cache needed.
   */
  private getLatestScene(): SceneModel | null {
    return this.getLevelSceneFn(this.levelId);
  }

  /**
   * ADR-527 — Commit a scene update straight to the SSoT. `setLevelSceneFn` updates the
   * root `levelScenesRef` synchronously (then mirrors React state), so the next
   * `getLatestScene()` in the same tick reflects this write.
   */
  private commitScene(scene: SceneModel): void {
    this.setLevelSceneFn(this.levelId, scene);
  }

  /**
   * Add an entity to the scene
   * Called by CreateEntityCommand.execute() and redo()
   */
  addEntity(entity: SceneEntity): void {
    const scene = this.getLatestScene();

    // 🏢 ENTERPRISE: Convert SceneEntity (command interface) to AnySceneEntity (scene type)
    // These types are structurally compatible but TypeScript needs explicit conversion
    const sceneEntity = entity as unknown as AnySceneEntity;

    if (scene) {
      // Add to existing scene
      const updatedScene: SceneModel = {
        ...scene,
        entities: [...scene.entities, sceneEntity],
      };
      this.commitScene(updatedScene);
    } else {
      // Create new scene with this entity
      // 🏢 ENTERPRISE: DXF Standard - Layer "0" is always present for entities without explicit layer
      // 🏢 ADR-358 Phase 9C: SceneLayer.id is now REQUIRED — factory auto-generates `lyr_<ULID>` via enterprise-id
      const defaultLayer = createSceneLayer({
        name: DXF_DEFAULT_LAYER,
        color: UI_COLORS.WHITE,
        visible: true,
        locked: false,
      });

      const defaultBounds: SceneBounds = {
        min: { x: 0, y: 0 },
        max: { x: 1000, y: 1000 },
      };

      const newScene: SceneModel = {
        entities: [sceneEntity],
        layersById: { [defaultLayer.id]: defaultLayer },
        bounds: defaultBounds,
        units: 'mm',
      };
      this.commitScene(newScene);
    }
  }

  /**
   * Remove an entity from the scene
   * Called by DeleteEntityCommand.execute() and CreateEntityCommand.undo()
   */
  removeEntity(entityId: string): void {
    const scene = this.getLatestScene();

    if (scene) {
      const updatedEntities = scene.entities.filter((e) => e.id !== entityId);
      const updatedScene: SceneModel = {
        ...scene,
        entities: updatedEntities,
      };
      this.commitScene(updatedScene);
    }
  }

  /**
   * Get an entity by ID
   * Used for validation and state inspection
   */
  getEntity(entityId: string): SceneEntity | undefined {
    const scene = this.getLatestScene();
    const entity = scene?.entities.find((e) => e.id === entityId);
    // 🏢 ENTERPRISE: Type conversion from AnySceneEntity to SceneEntity interface
    return entity ? (entity as unknown as SceneEntity) : undefined;
  }

  /**
   * Return all entities in the current scene (pending-cache aware).
   * Used by SSoT cascade helpers that scan relationships by foreign-key
   * (ADR-363 hosted-opening recompute scans openings by `params.wallId`).
   */
  getEntities(): readonly SceneEntity[] {
    const scene = this.getLatestScene();
    return (scene?.entities ?? []) as unknown as readonly SceneEntity[];
  }

  /**
   * Update an entity's properties
   * Called by MoveEntityCommand and other modification commands
   */
  updateEntity(entityId: string, updates: Partial<SceneEntity>): void {
    const scene = this.getLatestScene();

    if (scene) {
      const updatedEntities = scene.entities.map((e) =>
        e.id === entityId ? { ...e, ...updates } : e
      );
      const updatedScene: SceneModel = {
        ...scene,
        entities: updatedEntities as AnySceneEntity[],
      };
      this.commitScene(updatedScene);
    }
  }

  /**
   * Batch-update multiple entities in a single O(n_scene) pass and one commitScene.
   * Called by MoveMultipleEntitiesCommand to avoid N×O(n) individual updateEntity calls.
   */
  updateEntities(updates: ReadonlyMap<string, Partial<SceneEntity>>): void {
    if (updates.size === 0) return;
    const scene = this.getLatestScene();
    if (!scene) return;

    const updatedEntities = scene.entities.map((e) => {
      const u = updates.get(e.id);
      return u ? ({ ...e, ...u } as AnySceneEntity) : e;
    });

    this.commitScene({ ...scene, entities: updatedEntities });
  }

  /**
   * Update a specific vertex of an entity
   * Called by MoveVertexCommand
   */
  updateVertex(entityId: string, vertexIndex: number, position: Point2D): void {
    const scene = this.getLatestScene();

    if (scene) {
      const updatedEntities = scene.entities.map((entity) => {
        if (entity.id !== entityId) return entity;

        // Handle polyline vertices
        // 🏢 ADR-102: Use centralized type guard with Entity cast + property check for TS narrowing
        if (isPolylineEntity(entity as unknown as Entity) && 'vertices' in entity) {
          const vertices = [...entity.vertices];
          if (vertexIndex >= 0 && vertexIndex < vertices.length) {
            vertices[vertexIndex] = position;
            return { ...entity, vertices };
          }
        }

        // Handle line start/end
        // 🏢 ADR-102: Use centralized type guard with Entity cast
        if (isLineEntity(entity as unknown as Entity)) {
          if (vertexIndex === 0) {
            return { ...entity, start: position };
          } else if (vertexIndex === 1) {
            return { ...entity, end: position };
          }
        }

        // Handle circle center
        // 🏢 ADR-102: Use centralized type guard with Entity cast
        if (isCircleEntity(entity as unknown as Entity)) {
          if (vertexIndex === 0) {
            return { ...entity, center: position };
          }
        }

        return entity;
      });

      const updatedScene: SceneModel = {
        ...scene,
        entities: updatedEntities,
      };
      this.commitScene(updatedScene);
    }
  }

  /**
   * Insert a vertex into an entity (for polylines)
   * Called by AddVertexCommand
   */
  insertVertex(entityId: string, insertIndex: number, position: Point2D): void {
    const scene = this.getLatestScene();

    if (scene) {
      const updatedEntities = scene.entities.map((entity) => {
        if (entity.id !== entityId) return entity;

        // Only polylines support vertex insertion
        // 🏢 ADR-102: Use centralized type guard with Entity cast + property check for TS narrowing
        if (isPolylineEntity(entity as unknown as Entity) && 'vertices' in entity) {
          const vertices = [...entity.vertices];
          vertices.splice(insertIndex, 0, position);
          return { ...entity, vertices };
        }

        return entity;
      });

      const updatedScene: SceneModel = {
        ...scene,
        entities: updatedEntities,
      };
      this.commitScene(updatedScene);
    }
  }

  /**
   * Remove a vertex from an entity (for polylines)
   * Called by RemoveVertexCommand
   */
  removeVertex(entityId: string, vertexIndex: number): void {
    const scene = this.getLatestScene();

    if (scene) {
      const updatedEntities = scene.entities.map((entity) => {
        if (entity.id !== entityId) return entity;

        // Only polylines support vertex removal
        // 🏢 ADR-102: Use centralized type guard with Entity cast + property check for TS narrowing
        if (isPolylineEntity(entity as unknown as Entity) && 'vertices' in entity) {
          const vertices = [...entity.vertices];
          if (vertexIndex >= 0 && vertexIndex < vertices.length && vertices.length > 2) {
            vertices.splice(vertexIndex, 1);
            return { ...entity, vertices };
          }
        }

        return entity;
      });

      const updatedScene: SceneModel = {
        ...scene,
        entities: updatedEntities,
      };
      this.commitScene(updatedScene);
    }
  }

  /**
   * Get all vertices of an entity
   * Used for state inspection and validation
   */
  getVertices(entityId: string): Point2D[] | undefined {
    const scene = this.getLatestScene();
    const entity = scene?.entities.find((e) => e.id === entityId);

    if (!entity) return undefined;

    // Handle polyline vertices
    // 🏢 ADR-102: Use centralized type guard with Entity cast + property check for TS narrowing
    if (isPolylineEntity(entity as unknown as Entity) && 'vertices' in entity) {
      return entity.vertices;
    }

    // Handle line as 2 vertices
    // 🏢 ENTERPRISE: Type guard ensures start/end are defined for line entities
    // 🏢 ADR-102: Use centralized type guard with Entity cast
    if (isLineEntity(entity as unknown as Entity)) {
      const lineEntity = entity as { start?: Point2D; end?: Point2D };
      if (lineEntity.start && lineEntity.end) {
        return [lineEntity.start, lineEntity.end];
      }
    }

    // Handle circle as 1 vertex (center)
    // 🏢 ADR-102: Use centralized type guard with Entity cast
    if (isCircleEntity(entity as unknown as Entity)) {
      const circleEntity = entity as { center?: Point2D };
      if (circleEntity.center) {
        return [circleEntity.center];
      }
    }

    // Handle rectangle as 2 corners
    // 🏢 ADR-102: Use centralized type guard with Entity cast
    if (isRectangleEntity(entity as unknown as Entity) && 'corner1' in entity && 'corner2' in entity) {
      const rectEntity = entity as { corner1?: Point2D; corner2?: Point2D };
      if (rectEntity.corner1 && rectEntity.corner2) {
        return [rectEntity.corner1, rectEntity.corner2];
      }
    }

    return undefined;
  }

  /** Z-order: return current render-list index of an entity. -1 if not found. */
  getEntityIndex(entityId: string): number {
    const scene = this.getLatestScene();
    if (!scene) return -1;
    return scene.entities.findIndex((e) => e.id === entityId);
  }

  /** Z-order: move entity to front (end of list) or back (start). */
  reorderEntity(entityId: string, direction: 'front' | 'back'): void {
    const scene = this.getLatestScene();
    if (!scene) return;
    const idx = scene.entities.findIndex((e) => e.id === entityId);
    if (idx === -1) return;
    const entities = scene.entities.slice() as AnySceneEntity[];
    const [entity] = entities.splice(idx, 1);
    if (direction === 'front') entities.push(entity);
    else entities.unshift(entity);
    this.commitScene({ ...scene, entities });
  }

  /** Z-order: restore entity to an exact index — used by ReorderEntityCommand.undo(). */
  moveEntityToIndex(entityId: string, targetIndex: number): void {
    const scene = this.getLatestScene();
    if (!scene) return;
    const idx = scene.entities.findIndex((e) => e.id === entityId);
    if (idx === -1) return;
    const entities = scene.entities.slice() as AnySceneEntity[];
    const [entity] = entities.splice(idx, 1);
    const clamped = Math.min(Math.max(0, targetIndex), entities.length);
    entities.splice(clamped, 0, entity);
    this.commitScene({ ...scene, entities });
  }

  /**
   * Get the level ID this adapter operates on
   */
  getLevelId(): string {
    return this.levelId;
  }
}

/**
 * ADR-527 — Singleton cache: ONE long-lived adapter per (scene-accessor, levelId),
 * the «Revit Document» model. Before this, every call site did
 * `new LevelSceneManagerAdapter(...)`, so N× single appends (e.g. batch columns) minted
 * N adapters → N independent (now-removed) caches → each read a stale running scene.
 *
 * The live-scene SSoT exists at the root (`useSceneManager.levelScenesRef` is written
 * synchronously in `setLevelScene` and read by `getLevelScene`), so a shared singleton is
 * safe AND removes the per-call race: all commands on a level now mutate through ONE
 * stateless adapter that reads/writes that single root SSoT — one consistent view.
 *
 * Keyed by `getLevelScene` fn identity (WeakMap → GC-safe, no leak) + a `setLevelScene`
 * identity match + `levelId`. The accessor fns are stable (`useLevels` `useCallback`
 * empty-deps), so this yields exactly one adapter/level for the app lifetime; if the fns
 * change (HMR / tenant switch) a fresh adapter is minted — never a stale binding.
 */
const adapterCache = new WeakMap<
  GetLevelSceneFunction,
  Map<string, { adapter: LevelSceneManagerAdapter; setFn: SetLevelSceneFunction }>
>();

/**
 * Factory function to create adapter instances — the SINGLE canonical construction site
 * (SSoT). ADR-527: returns a cached singleton per (getLevelScene, setLevelScene, levelId)
 * instead of a fresh instance on every call. There is intentionally NO second entry point
 * (the old `levelSceneManagerFor(access, levelId)` wrapper was unified away) — every caller
 * uses this 3-arg signature directly.
 */
export function createLevelSceneManagerAdapter(
  getLevelScene: GetLevelSceneFunction,
  setLevelScene: SetLevelSceneFunction,
  levelId: string
): LevelSceneManagerAdapter {
  let byLevel = adapterCache.get(getLevelScene);
  if (!byLevel) {
    byLevel = new Map();
    adapterCache.set(getLevelScene, byLevel);
  }
  const cached = byLevel.get(levelId);
  // Reuse only when BOTH accessor fns still match — guards against a getLevelScene reused
  // with a different setLevelScene (defensive; the pair is stable in practice).
  if (cached && cached.setFn === setLevelScene) return cached.adapter;

  const adapter = new LevelSceneManagerAdapter(getLevelScene, setLevelScene, levelId);
  byLevel.set(levelId, { adapter, setFn: setLevelScene });
  return adapter;
}

/**
 * ADR-527 — explicit cache invalidation for tests / teardown. Clears the cached adapter
 * for one `levelId` (or every level of the given accessor when `levelId` is omitted).
 * Production never needs this: the WeakMap entries are GC'd when the accessor fns die.
 */
export function clearLevelSceneManagerCache(
  getLevelScene: GetLevelSceneFunction,
  levelId?: string
): void {
  const byLevel = adapterCache.get(getLevelScene);
  if (!byLevel) return;
  if (levelId) byLevel.delete(levelId);
  else byLevel.clear();
}

// ADR-527 — `levelSceneManagerFor(access, levelId)` was a convenience wrapper that
// merely destructured `access.getLevelScene/setLevelScene` into
// `createLevelSceneManagerAdapter`. Two public entry points for ONE construction = API
// duplication. Unified to the single canonical factory `createLevelSceneManagerAdapter`
// above (the cache + `new` live there); call-sites pass `x.getLevelScene, x.setLevelScene`
// explicitly. No `LevelSceneAccess` indirection — the 3-arg signature IS the SSoT.
