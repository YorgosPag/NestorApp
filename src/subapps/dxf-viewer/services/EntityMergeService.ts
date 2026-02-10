/**
 * Entity Merge Service
 * Handles merging of DXF entities with geometric joining and absorb mode fallback
 */

import { SceneModel, AnySceneEntity } from '../types/scene';
import { entityToSegments, samePoint } from '../utils/geometry/GeometryUtils';
import { chainSegments } from '../utils/geometry/SegmentChaining';
import { publishHighlight } from '../events/selection-bus';
// 🏢 ADR-065: Centralized ID Generation (crypto-secure, collision-resistant)
import { generateEntityId } from '../systems/entity-creation/utils';

export interface MergeResult {
  updatedScene: SceneModel;
  newEntityId?: string;
  success: boolean;
  message?: string;
}

export interface MergeOptions {
  targetEntityId: string;
  sourceEntityIds: string[];
  scene: SceneModel;
  currentLevelId: string;
}

export class EntityMergeService {
  /**
   * Merge multiple entities into one
   */
  public async mergeEntities(options: MergeOptions): Promise<MergeResult> {
    const { targetEntityId, sourceEntityIds, scene } = options;

    // Find target entity
    const targetEntity = scene.entities.find(e => e.id === targetEntityId);
    if (!targetEntity) {
      console.error('Target entity not found:', targetEntityId);
      return {
        updatedScene: scene,
        success: false,
        message: 'Target entity not found'
      };
    }
    
    // Find source entities for merging
    const sourceEntities = scene.entities.filter(e => sourceEntityIds.includes(e.id));

    // Try geometric join first
    const geometricResult = this.tryGeometricJoin(targetEntity, sourceEntities, scene);
    if (geometricResult.success) {
      return geometricResult;
    }
    
    // Fallback to absorb mode
    return this.absorbMerge(targetEntity, sourceEntityIds, scene);
  }
  
  /**
   * Try to geometrically join entities (for lines, polylines, arcs)
   */
  private tryGeometricJoin(
    targetEntity: AnySceneEntity,
    sourceEntities: AnySceneEntity[],
    scene: SceneModel
  ): MergeResult {
    const pool = [targetEntity, ...sourceEntities];
    const joinable = pool.every(e => e.type === 'line' || e.type === 'polyline' || e.type === 'arc');
    
    if (!joinable) {

      return {
        updatedScene: scene,
        success: false,
        message: 'Entities are not geometrically joinable'
      };
    }

    const allSegs = pool.flatMap(entityToSegments);

    const chain = chainSegments(allSegs, pool);
    
    if (!chain || chain.length < 2) {
      console.warn('⚠️ Entities are not connected — canceling join');
      return {
        updatedScene: scene,
        success: false,
        message: 'Selected entities are not geometrically connected'
      };
    }
    
    // 🏢 ADR-065: Crypto-secure ID generation (collision-resistant)
    const newId = generateEntityId();
    // 🏢 ENTERPRISE: Type-safe entity creation using LWPolylineEntity structure
    const mergedEntity: AnySceneEntity = {
      id: newId,
      type: 'lwpolyline' as const,
      layer: targetEntity.layer,
      visible: true,
      vertices: chain,
      closed: samePoint(chain[0], chain[chain.length - 1]),
      name: targetEntity.name || `Merged_${pool.length}_entities`,
      color: targetEntity.color
    };

    // Remove all old entities and add the new merged one
    const toDelete = new Set([targetEntity.id, ...sourceEntities.map(e => e.id)]);
    const updatedEntities = scene.entities
      .filter(e => !toDelete.has(e.id))
      .concat([mergedEntity]);
    
    const updatedScene = {
      ...scene,
      entities: updatedEntities
    };
    
    // Keep selection/GRIPS on the new entity
    publishHighlight({ ids: [newId] });

    return {
      updatedScene,
      newEntityId: newId,
      success: true,
      message: 'Entities successfully joined geometrically'
    };
  }
  
  /**
   * Absorb merge mode for non-joinable entities
   */
  private absorbMerge(
    targetEntity: AnySceneEntity,
    sourceEntityIds: string[],
    scene: SceneModel
  ): MergeResult {

    // Create merged entity with characteristics from target entity
    const mergedEntity = {
      ...targetEntity,
      name: targetEntity.name || `Merged_${sourceEntityIds.length + 1}_entities`
    };

    // Remove source entities and update target
    const updatedEntities = scene.entities
      .map(entity => entity.id === targetEntity.id ? mergedEntity : entity)
      .filter(e => !sourceEntityIds.includes(e.id));
    
    const updatedScene = {
      ...scene,
      entities: updatedEntities
    };
    
    // Keep selection on target entity
    publishHighlight({ ids: [targetEntity.id] });

    return {
      updatedScene,
      success: true,
      message: 'Entities successfully merged'
    };
  }
  
  /**
   * Check if entities can be geometrically joined
   */
  public canGeometricallyJoin(entityIds: string[], scene: SceneModel): boolean {
    const entities = scene.entities.filter(e => entityIds.includes(e.id));
    return entities.every(e => e.type === 'line' || e.type === 'polyline' || e.type === 'arc');
  }
  
  /**
   * Get merge preview information
   */
  public getMergePreview(
    targetEntityId: string,
    sourceEntityIds: string[],
    scene: SceneModel
  ): {
    canJoin: boolean;
    resultType: 'polyline' | 'absorb';
    entityCount: number;
  } {
    const allIds = [targetEntityId, ...sourceEntityIds];
    const canJoin = this.canGeometricallyJoin(allIds, scene);
    
    return {
      canJoin,
      resultType: canJoin ? 'polyline' : 'absorb',
      entityCount: allIds.length
    };
  }
}