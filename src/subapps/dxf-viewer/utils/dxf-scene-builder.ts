import type { SceneModel, AnySceneEntity, SceneLayer } from '../types/scene';
import { DxfEntityParser, type EntityData } from './dxf-entity-parser';
import { getLayerColor, DEFAULT_LAYER_COLOR } from '../config/color-config';

export class DxfSceneBuilder {
  static buildScene(content: string): SceneModel {

    const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    const entities: AnySceneEntity[] = [];
    const layers: Record<string, SceneLayer> = {};
    
    // Add default layer
    layers['0'] = {
      name: '0',
      color: DEFAULT_LAYER_COLOR,
      visible: true,
      locked: false
    };
    
    // Parse entities using state machine
    const parsedEntities = DxfEntityParser.parseEntities(lines);

    // Convert to scene entities
    parsedEntities.forEach((entityData, index) => {
      const entity = DxfEntityParser.convertToSceneEntity(entityData, index);
      if (entity) {
        // Register layer first
        DxfSceneBuilder.registerLayer(layers, entity.layer);
        entities.push(entity);
        
        // Debug first 3 entities
        if (entities.length <= 3) {

        }
      }
    });

    // Calculate bounds
    const bounds = entities.length > 0 ? DxfSceneBuilder.calculateBounds(entities) : {
      min: { x: -100, y: -100 },
      max: { x: 100, y: 100 }
    };

    return {
      entities,
      layers,
      bounds,
      units: 'mm'
    };
  }

  // Helper to register layer dynamically
  private static registerLayer(layers: Record<string, SceneLayer>, layerName: string): void {
    if (!layers[layerName]) {
      layers[layerName] = {
        name: layerName,
        color: getLayerColor(layerName),
        visible: true,
        locked: false
      };

    }
  }

  // getLayerColor is now imported from unified color system

  static calculateBounds(entities: AnySceneEntity[]) {
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    
    entities.forEach(entity => {
      switch (entity.type) {
        case 'line':
          minX = Math.min(minX, entity.start.x, entity.end.x);
          minY = Math.min(minY, entity.start.y, entity.end.y);
          maxX = Math.max(maxX, entity.start.x, entity.end.x);
          maxY = Math.max(maxY, entity.start.y, entity.end.y);
          break;
        case 'polyline':
          entity.vertices.forEach(v => {
            minX = Math.min(minX, v.x);
            minY = Math.min(minY, v.y);
            maxX = Math.max(maxX, v.x);
            maxY = Math.max(maxY, v.y);
          });
          break;
        case 'circle':
        case 'arc':
          minX = Math.min(minX, entity.center.x - entity.radius);
          minY = Math.min(minY, entity.center.y - entity.radius);
          maxX = Math.max(maxX, entity.center.x + entity.radius);
          maxY = Math.max(maxY, entity.center.y + entity.radius);
          break;
      }
    });
    
    return {
      min: { x: minX, y: minY },
      max: { x: maxX, y: maxY }
    };
  }

  static validateScene(scene: SceneModel): boolean {
    // Basic validation
    if (!scene.entities || !scene.layers || !scene.bounds) {
      return false;
    }

    // Check bounds validity
    const { min, max } = scene.bounds;
    if (isNaN(min.x) || isNaN(min.y) || isNaN(max.x) || isNaN(max.y)) {
      return false;
    }

    // Check entities validity
    if (scene.entities.some(entity => !entity.id || !entity.type || !entity.layer)) {
      return false;
    }

    return true;
  }
}
