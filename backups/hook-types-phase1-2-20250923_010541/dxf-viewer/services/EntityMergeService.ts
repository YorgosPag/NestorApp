/**
 * Entity Merge Service
 * Handles merging of DXF entities with geometric joining and absorb mode fallback
 */

import { SceneModel } from '../types/scene';
import { entityToSegments, samePoint, Point2D } from '../utils/geometry/GeometryUtils';
import { chainSegments } from '../utils/geometry/SegmentChaining';
import { publishHighlight } from '../events/selection-bus';

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
    
    console.log('🔄 [EntityMergeService] Merging entities:', {
      target: targetEntityId,
      sources: sourceEntityIds,
      totalEntities: scene.entities.length
    });
    
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
    console.log(`📦 Target entity: ${targetEntity.type} "${targetEntity.name}" in layer ${targetEntity.layer}`);
    console.log(`🔗 Will merge ${sourceEntities.length} entities:`, sourceEntities.map(e => `${e.type} "${e.name}"`));
    
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
    targetEntity: any,
    sourceEntities: any[],
    scene: SceneModel
  ): MergeResult {
    const pool = [targetEntity, ...sourceEntities];
    const joinable = pool.every(e => e.type === 'line' || e.type === 'polyline' || e.type === 'arc');
    
    if (!joinable) {
      console.log('🔄 Non-joinable entities detected, skipping geometric join');
      return {
        updatedScene: scene,
        success: false,
        message: 'Entities are not geometrically joinable'
      };
    }
    
    console.log('🔧 Attempting geometric join for line/polyline/arc entities');
    console.log('📋 Entity types in pool:', pool.map(e => e.type).join(', '));
    
    const allSegs = pool.flatMap(entityToSegments);
    console.log(`🔗 Generated ${allSegs.length} segments from ${pool.length} entities`);
    
    const chain = chainSegments(allSegs, pool);
    
    if (!chain || chain.length < 2) {
      console.warn('⚠️ Entities are not connected — canceling join');
      return {
        updatedScene: scene,
        success: false,
        message: 'Selected entities are not geometrically connected'
      };
    }
    
    const newId = `polyline_${Date.now()}`;
    const mergedEntity = {
      id: newId,
      type: 'polyline',
      layer: targetEntity.layer,
      visible: true,
      vertices: chain,
      closed: samePoint(chain[0], chain[chain.length - 1]),
      name: targetEntity.name || `Merged_${pool.length}_entities`,
      color: targetEntity.color
    };
    
    console.log(`✅ Created polyline from ${pool.length} entities, vertices: ${chain.length}`);
    
    // Remove all old entities and add the new merged one
    const toDelete = new Set([targetEntity.id, ...sourceEntities.map(e => e.id)]);
    const updatedEntities = scene.entities
      .filter(e => !toDelete.has(e.id))
      .concat(mergedEntity);
    
    const updatedScene = {
      ...scene,
      entities: updatedEntities
    };
    
    // Keep selection/GRIPS on the new entity
    publishHighlight({ ids: [newId] });
    
    console.log('✅ Geometric join completed! New entity ID:', newId);
    
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
    targetEntity: any,
    sourceEntityIds: string[],
    scene: SceneModel
  ): MergeResult {
    console.log('🔄 Using absorb mode for non-joinable entities');
    
    // Create merged entity with characteristics from target entity
    const mergedEntity = {
      ...targetEntity,
      name: targetEntity.name || `Merged_${sourceEntityIds.length + 1}_entities`
    };
    
    console.log(`🔄 Merged entity: ${mergedEntity.type} "${mergedEntity.name}"`);
    
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
    
    console.log('✅ Absorb merge completed! New entity count:', updatedEntities.length);
    
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