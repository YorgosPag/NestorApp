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
// 🏢 ADR-358 Phase 9C: createSceneLayer factory (SceneLayer.id required, auto-gen via enterprise-id)
import { createSceneLayer, isBlockEntity, type Entity } from '../../types/entities';
// ADR-641 Φ4 — BLOCK-member awareness. While a Block Editor session is open, an id the command
// system passes is a MEMBER of the active block (in block-local coords inside `block.entities`),
// NOT a top-level entity. `getActiveBlockEditId()` is an event-time getter (ADR-040-safe; no React
// snapshot), and the member-scene-access SSoT resolves + writes back the member (or descends nowhere
// when `null` → identical top-level behaviour). Edits land on the LIVE `block.entities`.
import { getActiveBlockEditId, getBlockEditViewTransform } from '../block/ActiveBlockEditStore';
import {
  findEntityOrBlockMember,
  updateEntityOrBlockMember,
  updateEntitiesOrBlockMembers,
  addBlockMember,
  removeEntityOrBlockMember,
} from '../block/block-member-scene-access';
// ADR-641 — the real-size/recenter VIEW transform, so `getEntities()` inside BEDIT returns members in
// the same VIEW space as `getEntity()` (a cascade scan that reads member geometry stays consistent).
import { viewFromDef } from '../block/block-edit-view-transform';
// ADR-641 Φ4 — per-type vertex transforms extracted from this adapter (was at the N.7.1 500-line
// ceiling); reused by both the top-level and block-member writeback paths.
import {
  applyVertexUpdate,
  insertEntityVertex,
  removeEntityVertex,
  getEntityVertices,
} from './level-scene-vertex-ops';
// Z-order render-list reordering SSoT (shared with the grip adapter — no per-adapter twin).
import { moveEntityInList, moveEntitiesInList, entityIdOrder, reorderEntitiesToIdList, frontBackTargetIndex } from './entity-zorder-ops';

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
   * ADR-641 Φ4 — commit a member-aware single-entity update: route `updater` through the block-member
   * writeback SSoT (a top-level entity OR a member of the active block) and commit. Shared by
   * `updateEntity` + the three vertex methods so the writeback shape lives in ONE place.
   */
  private commitMemberUpdate(scene: SceneModel, entityId: string, updater: (e: Entity) => Entity): void {
    this.commitScene({
      ...scene,
      // ADR-641 — inside BEDIT the updater runs in VIEW space; the result is inverse-transformed back
      // to the canonical definition before it is stored (transform null → identity top-level path).
      entities: updateEntityOrBlockMember(
        scene.entities as readonly Entity[],
        entityId,
        getActiveBlockEditId(),
        updater,
        getBlockEditViewTransform(),
      ) as unknown as AnySceneEntity[],
    });
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
      // ADR-641 Φ4 — inside a Block Editor session the new entity is a MEMBER of the active block
      // (appended to its `block.entities`); at the top level it is a plain scene append. `null`
      // activeBlockId → identical top-level append.
      const updatedScene: SceneModel = {
        ...scene,
        entities: addBlockMember(
          scene.entities as readonly Entity[],
          getActiveBlockEditId(),
          sceneEntity as unknown as Entity,
          getBlockEditViewTransform(),
        ) as unknown as AnySceneEntity[],
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
      // ADR-641 Φ4 — member-aware delete (top-level OR a member of the active block).
      const updatedScene: SceneModel = {
        ...scene,
        entities: removeEntityOrBlockMember(
          scene.entities as readonly Entity[],
          entityId,
          getActiveBlockEditId(),
        ) as unknown as AnySceneEntity[],
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
    // ADR-641 Φ4 — member-aware read: also resolves an id INSIDE the active block's `.entities`.
    const entity = findEntityOrBlockMember(
      scene?.entities as readonly Entity[] | undefined,
      entityId,
      getActiveBlockEditId(),
      getBlockEditViewTransform(),
    );
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
    if (!scene) return [];
    // ADR-641 Φ4 — inside a Block Editor session the operative entity set is the active block's
    // members (block-local), not the world top level; a cascade scan (e.g. ADR-363 hosted-opening)
    // then sees the correct in-editor scope.
    const activeBlockId = getActiveBlockEditId();
    if (activeBlockId) {
      const block = scene.entities.find(
        (e) => e.id === activeBlockId && isBlockEntity(e as unknown as Entity),
      );
      if (block && 'entities' in block) {
        const members = (block as unknown as { entities: readonly Entity[] }).entities;
        // ADR-641 — present members in VIEW space (matching `getEntity`) so a cascade scan reading
        // member geometry is consistent with the editor. Transform null → members returned verbatim.
        const t = getBlockEditViewTransform();
        return (t
          ? members.map((m) => viewFromDef(m as AnySceneEntity, t))
          : members) as unknown as readonly SceneEntity[];
      }
    }
    return scene.entities as unknown as readonly SceneEntity[];
  }

  /**
   * Update an entity's properties
   * Called by MoveEntityCommand and other modification commands
   */
  updateEntity(entityId: string, updates: Partial<SceneEntity>): void {
    const scene = this.getLatestScene();

    if (scene) {
      // ADR-641 Φ4 — member-aware writeback (top-level OR inside the active block).
      this.commitMemberUpdate(scene, entityId, (e) => ({ ...e, ...updates } as unknown as Entity));
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

    // ADR-641 Φ4 — member-aware batch writeback: patches also reach members inside the active
    // block. Build a per-id patch-fn map once; the SSoT descends into the active block container.
    const patchFns = new Map<string, (e: Entity) => Entity>();
    updates.forEach((u, id) => patchFns.set(id, (e) => ({ ...e, ...u } as unknown as Entity)));

    this.commitScene({
      ...scene,
      entities: updateEntitiesOrBlockMembers(
        scene.entities as readonly Entity[],
        patchFns,
        getActiveBlockEditId(),
        getBlockEditViewTransform(),
      ) as unknown as AnySceneEntity[],
    });
  }

  /**
   * Update a specific vertex of an entity
   * Called by MoveVertexCommand
   */
  updateVertex(entityId: string, vertexIndex: number, position: Point2D): void {
    const scene = this.getLatestScene();

    if (scene) {
      // ADR-641 Φ4 — per-type transform (`applyVertexUpdate`, extracted SSoT) via the member-aware
      // writeback: works on a top-level entity OR a member of the active block.
      this.commitMemberUpdate(scene, entityId, (e) => applyVertexUpdate(e, vertexIndex, position));
    }
  }

  /**
   * Insert a vertex into an entity (for polylines)
   * Called by AddVertexCommand
   */
  insertVertex(entityId: string, insertIndex: number, position: Point2D): void {
    const scene = this.getLatestScene();

    if (scene) {
      // ADR-641 Φ4 — member-aware; `insertEntityVertex` (extracted SSoT) handles the polyline-only rule.
      this.commitMemberUpdate(scene, entityId, (e) => insertEntityVertex(e, insertIndex, position));
    }
  }

  /**
   * Remove a vertex from an entity (for polylines)
   * Called by RemoveVertexCommand
   */
  removeVertex(entityId: string, vertexIndex: number): void {
    const scene = this.getLatestScene();

    if (scene) {
      // ADR-641 Φ4 — member-aware; `removeEntityVertex` (extracted SSoT) enforces polyline + >2 rule.
      this.commitMemberUpdate(scene, entityId, (e) => removeEntityVertex(e, vertexIndex));
    }
  }

  /**
   * Get all vertices of an entity
   * Used for state inspection and validation
   */
  getVertices(entityId: string): Point2D[] | undefined {
    const scene = this.getLatestScene();
    // ADR-641 Φ4 — member-aware read; `getEntityVertices` (extracted SSoT) does the per-type mapping.
    const entity = findEntityOrBlockMember(
      scene?.entities as readonly Entity[] | undefined,
      entityId,
      getActiveBlockEditId(),
      getBlockEditViewTransform(),
    );
    return entity ? getEntityVertices(entity) : undefined;
  }

  /**
   * Z-order: current render-list index of an entity. -1 if not found.
   * ADR-641 Φ4 — TOP-LEVEL scope only: block-member reorder inside BEDIT is not yet supported, so a
   * member id returns -1 and `reorderEntity`/`moveEntityToIndex` no-op (graceful degradation, not
   * corruption). Deferred to a later phase.
   */
  getEntityIndex(entityId: string): number {
    const scene = this.getLatestScene();
    if (!scene) return -1;
    return scene.entities.findIndex((e) => e.id === entityId);
  }

  /** Z-order: move entity to front (end of list) or back (start). Shared SSoT (N.0.2). */
  reorderEntity(entityId: string, direction: 'front' | 'back'): void {
    const scene = this.getLatestScene();
    if (!scene) return;
    const entities = moveEntityInList(
      scene.entities,
      entityId,
      frontBackTargetIndex(direction, scene.entities.length),
    );
    if (entities) this.commitScene({ ...scene, entities });
  }

  /** Z-order: restore entity to an exact index — used by ReorderEntityCommand.undo(). */
  moveEntityToIndex(entityId: string, targetIndex: number): void {
    const scene = this.getLatestScene();
    if (!scene) return;
    const entities = moveEntityInList(scene.entities, entityId, targetIndex);
    if (entities) this.commitScene({ ...scene, entities });
  }

  /** ADR-661 — atomic batch send-to-back / bring-to-front (ONE commit). Shared SSoT (N.0.2). */
  reorderEntities(ids: readonly string[], direction: 'front' | 'back'): void {
    const scene = this.getLatestScene();
    if (!scene) return;
    const entities = moveEntitiesInList(scene.entities, new Set(ids), direction);
    if (entities) this.commitScene({ ...scene, entities });
  }

  /** ADR-661 — current render order as an id list (undo snapshot for BatchReorderEntityCommand). */
  getEntityOrder(): readonly string[] {
    const scene = this.getLatestScene();
    return scene ? entityIdOrder(scene.entities) : [];
  }

  /** ADR-661 — restore render order to an exact id list (BatchReorderEntityCommand.undo). */
  setEntityOrder(orderedIds: readonly string[]): void {
    const scene = this.getLatestScene();
    if (!scene) return;
    // full-coverage guard lives in the SSoT helper (null → no-op on a stale snapshot).
    const entities = reorderEntitiesToIdList(scene.entities, orderedIds);
    if (entities) this.commitScene({ ...scene, entities });
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
