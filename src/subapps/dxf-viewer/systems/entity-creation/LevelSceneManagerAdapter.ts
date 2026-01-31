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
 * Usage:
 * ```typescript
 * const adapter = new LevelSceneManagerAdapter(getLevelScene, setLevelScene, levelId);
 * const command = new CreateEntityCommand(entityData, adapter);
 * commandHistory.execute(command);
 * ```
 */

import type { ISceneManager, SceneEntity } from '../../core/commands/interfaces';
import type { Point2D } from '../../rendering/types/Types';
import type { SceneModel, AnySceneEntity, SceneLayer, SceneBounds } from '../../types/scene';
// 🏢 ADR-102: Centralized Entity Type Guards
import {
  isLineEntity,
  isCircleEntity,
  isRectangleEntity,
  isPolylineEntity,
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
 */
export class LevelSceneManagerAdapter implements ISceneManager {
  private readonly getLevelScene: GetLevelSceneFunction;
  private readonly setLevelScene: SetLevelSceneFunction;
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
    this.getLevelScene = getLevelScene;
    this.setLevelScene = setLevelScene;
    this.levelId = levelId;
  }

  /**
   * Add an entity to the scene
   * Called by CreateEntityCommand.execute() and redo()
   */
  addEntity(entity: SceneEntity): void {
    const scene = this.getLevelScene(this.levelId);

    // 🏢 ENTERPRISE: Convert SceneEntity (command interface) to AnySceneEntity (scene type)
    // These types are structurally compatible but TypeScript needs explicit conversion
    const sceneEntity = entity as unknown as AnySceneEntity;

    if (scene) {
      // Add to existing scene
      const updatedScene: SceneModel = {
        ...scene,
        entities: [...scene.entities, sceneEntity],
      };
      this.setLevelScene(this.levelId, updatedScene);
    } else {
      // Create new scene with this entity
      // 🏢 ENTERPRISE: DXF Standard - Layer "0" is always present for entities without explicit layer
      // Create minimal SceneModel with default values for required properties
      const defaultLayer: SceneLayer = {
        name: '0',
        color: '#FFFFFF',
        visible: true,
        locked: false,
      };

      const defaultBounds: SceneBounds = {
        min: { x: 0, y: 0 },
        max: { x: 1000, y: 1000 },
      };

      const newScene: SceneModel = {
        entities: [sceneEntity],
        layers: { '0': defaultLayer },
        bounds: defaultBounds,
        units: 'mm',
      };
      this.setLevelScene(this.levelId, newScene);
    }
  }

  /**
   * Remove an entity from the scene
   * Called by DeleteEntityCommand.execute() and CreateEntityCommand.undo()
   */
  removeEntity(entityId: string): void {
    const scene = this.getLevelScene(this.levelId);

    if (scene) {
      const updatedEntities = scene.entities.filter((e) => e.id !== entityId);
      const updatedScene: SceneModel = {
        ...scene,
        entities: updatedEntities,
      };
      this.setLevelScene(this.levelId, updatedScene);
    }
  }

  /**
   * Get an entity by ID
   * Used for validation and state inspection
   */
  getEntity(entityId: string): SceneEntity | undefined {
    const scene = this.getLevelScene(this.levelId);
    const entity = scene?.entities.find((e) => e.id === entityId);
    // 🏢 ENTERPRISE: Type conversion from AnySceneEntity to SceneEntity interface
    return entity ? (entity as unknown as SceneEntity) : undefined;
  }

  /**
   * Update an entity's properties
   * Called by MoveEntityCommand and other modification commands
   */
  updateEntity(entityId: string, updates: Partial<SceneEntity>): void {
    const scene = this.getLevelScene(this.levelId);

    if (scene) {
      const updatedEntities = scene.entities.map((e) =>
        e.id === entityId ? { ...e, ...updates } : e
      );
      const updatedScene: SceneModel = {
        ...scene,
        entities: updatedEntities as AnySceneEntity[],
      };
      this.setLevelScene(this.levelId, updatedScene);
    }
  }

  /**
   * Update a specific vertex of an entity
   * Called by MoveVertexCommand
   */
  updateVertex(entityId: string, vertexIndex: number, position: Point2D): void {
    const scene = this.getLevelScene(this.levelId);

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
      this.setLevelScene(this.levelId, updatedScene);
    }
  }

  /**
   * Insert a vertex into an entity (for polylines)
   * Called by AddVertexCommand
   */
  insertVertex(entityId: string, insertIndex: number, position: Point2D): void {
    const scene = this.getLevelScene(this.levelId);

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
      this.setLevelScene(this.levelId, updatedScene);
    }
  }

  /**
   * Remove a vertex from an entity (for polylines)
   * Called by RemoveVertexCommand
   */
  removeVertex(entityId: string, vertexIndex: number): void {
    const scene = this.getLevelScene(this.levelId);

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
      this.setLevelScene(this.levelId, updatedScene);
    }
  }

  /**
   * Get all vertices of an entity
   * Used for state inspection and validation
   */
  getVertices(entityId: string): Point2D[] | undefined {
    const scene = this.getLevelScene(this.levelId);
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

  /**
   * Get the level ID this adapter operates on
   */
  getLevelId(): string {
    return this.levelId;
  }
}

/**
 * Factory function to create adapter instances
 * Useful when you need to create adapters dynamically
 */
export function createLevelSceneManagerAdapter(
  getLevelScene: GetLevelSceneFunction,
  setLevelScene: SetLevelSceneFunction,
  levelId: string
): LevelSceneManagerAdapter {
  return new LevelSceneManagerAdapter(getLevelScene, setLevelScene, levelId);
}
