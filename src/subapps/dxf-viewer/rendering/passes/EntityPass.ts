/**
 * ENTITY PASS - Render των DXF entities με batching optimization — DEADCODE
 * ✅ ΦΑΣΗ 4: Δεύτερη φάση του render pipeline με batch processing
 */

import { UI_COLORS } from '../../config/color-config';
// 🏢 ADR-077: Centralized TAU Constant
import { TAU } from '../primitives/canvasPaths';
// ADR-130: Centralized Default Layer Name
import { getLayerNameOrDefault } from '../../config/layer-config';
// 🏢 ADR-151: Centralized Simple Coordinate Transforms
import { transformBoundsToScreen } from '../core/CoordinateTransforms';

import type { IRenderPass, IRenderContext, RenderPassOptions } from '../core/RenderPipeline';
import type { Entity } from '../../types/entities';  // ✅ ENTERPRISE FIX: Use proper Entity type instead of EntityModel

export interface EntityBatch {
  entityType: string;
  entities: Entity[];  // ✅ ENTERPRISE FIX: Use Entity instead of EntityModel
  layer?: string;
  color?: string;
  lineWidth?: number;
}

export interface EntityPassConfig {
  batchingEnabled: boolean;
  maxBatchSize: number;
  cullOutsideViewport: boolean;
  levelOfDetail: boolean;
  cacheEnabled: boolean;
}

/**
 * 🔺 ENTITY RENDER PASS
 * Κεντρικό pass για το rendering των DXF entities:
 * - Batching ανά entity type και layer
 * - Viewport culling για performance
 * - Level of detail rendering
 * - Path2D caching
 */
export class EntityPass implements IRenderPass {
  readonly name = 'entity';
  readonly priority = 2; // Δεύτερο στη σειρά

  private config: EntityPassConfig;
  private entities: Entity[] = [];
  private enabled = true;
  private pathCache = new Map<string, Path2D>();

  // Performance tracking
  private stats = {
    entitiesRendered: 0,
    entitiesCulled: 0,
    batchesProcessed: 0,
    cacheHits: 0,
    cacheMisses: 0
  };

  constructor(config: EntityPassConfig) {
    this.config = config;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  updateConfig(config: Partial<EntityPassConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 🔺 SET ENTITIES TO RENDER
   * Ενημερώνει τη λίστα των entities που θα render-αριστούν
   */
  setEntities(entities: Entity[]): void {
    this.entities = entities;
    this.resetStats();
  }

  render(context: IRenderContext, options: RenderPassOptions): void {
    if (!this.enabled || this.entities.length === 0) return;

    // 🔺 VIEWPORT CULLING (αν ενεργοποιημένο)
    const visibleEntities = this.config.cullOutsideViewport
      ? this.cullEntitiesOutsideViewport(this.entities, options.viewport, options.transform)
      : this.entities;

    // 🔺 BATCHING (αν ενεργοποιημένο)
    if (this.config.batchingEnabled) {
      this.renderWithBatching(context, visibleEntities, options);
    } else {
      this.renderSequential(context, visibleEntities, options);
    }
  }

  /**
   * 🔺 BATCH RENDERING
   * Οργανώνει entities σε batches και τα render-άρει με optimization
   */
  private renderWithBatching(context: IRenderContext, entities: Entity[], options: RenderPassOptions): void {
    const batches = this.createBatches(entities);

    context.startBatch?.();

    for (const batch of batches) {
      this.renderBatch(context, batch, options);
      this.stats.batchesProcessed++;
    }

    context.endBatch?.();
  }

  /**
   * 🔺 SEQUENTIAL RENDERING
   * Render entities ένα προς ένα (fallback mode)
   */
  private renderSequential(context: IRenderContext, entities: Entity[], options: RenderPassOptions): void {
    for (const entity of entities) {
      this.renderEntity(context, entity, options);
      this.stats.entitiesRendered++;
    }
  }

  /**
   * 🔺 CREATE BATCHES
   * Ομαδοποιεί entities για optimized rendering
   */
  private createBatches(entities: Entity[]): EntityBatch[] {
    const batchMap = new Map<string, EntityBatch>();

    for (const entity of entities) {
      // Create batch key based on type, layer, and style
      // ✅ ENTERPRISE FIX: Safe property access with type guards
      // ADR-130: Centralized default layer
      const entityWithStyle = entity as Entity & { layer?: string; color?: string; lineWidth?: number; };
      const batchKey = `${entity.type}_${getLayerNameOrDefault(entityWithStyle.layer)}_${entityWithStyle.color || UI_COLORS.WHITE}_${entityWithStyle.lineWidth || 1}`;

      if (!batchMap.has(batchKey)) {
        batchMap.set(batchKey, {
          entityType: entity.type,
          entities: [],
          layer: entityWithStyle.layer,
          color: entityWithStyle.color,
          lineWidth: entityWithStyle.lineWidth
        });
      }

      const batch = batchMap.get(batchKey)!;
      batch.entities.push(entity);

      // Split large batches
      if (batch.entities.length >= this.config.maxBatchSize) {
        // Create new batch for overflow
        const overflowKey = `${batchKey}_${Date.now()}`;
        batchMap.set(overflowKey, {
          entityType: entity.type,
          entities: [],
          layer: entityWithStyle.layer,
          color: entityWithStyle.color,
          lineWidth: entityWithStyle.lineWidth
        });
      }
    }

    return Array.from(batchMap.values());
  }

  /**
   * 🔺 RENDER BATCH
   * Render ένα batch entities με κοινό styling
   */
  private renderBatch(context: IRenderContext, batch: EntityBatch, options: RenderPassOptions): void {
    // Set common style for entire batch
    context.save();
    context.setState({
      strokeStyle: batch.color || UI_COLORS.WHITE,
      lineWidth: batch.lineWidth || 1,
      lineDash: [] // Reset line dash
    });

    // Render all entities in batch
    for (const entity of batch.entities) {
      this.renderEntity(context, entity, options, true); // skipStyleSetup = true
      this.stats.entitiesRendered++;
    }

    context.restore();
  }

  /**
   * 🔺 RENDER SINGLE ENTITY
   * Render ένα entity με ή χωρίς style setup
   */
  private renderEntity(context: IRenderContext, entity: Entity, options: RenderPassOptions, skipStyleSetup = false): void {
    // Check cache first
    if (this.config.cacheEnabled) {
      const cacheKey = this.getCacheKey(entity);
      const cachedPath = this.pathCache.get(cacheKey);

      if (cachedPath) {
        context.drawPath(cachedPath);
        this.stats.cacheHits++;
        return;
      }
      this.stats.cacheMisses++;
    }

    // Apply entity-specific styling (if not skipped)
    if (!skipStyleSetup) {
      context.save();
      this.applyEntityStyle(context, entity);
    }

    // Render based on entity type
    switch (entity.type) {
      case 'line':
        this.renderLine(context, entity, options);
        break;
      case 'circle':
        this.renderCircle(context, entity, options);
        break;
      case 'polyline':
      case 'lwpolyline':
        this.renderPolyline(context, entity, options);
        break;
      case 'arc':
        this.renderArc(context, entity, options);
        break;
      case 'text':
      case 'mtext':
        this.renderText(context, entity, options);
        break;
      case 'rectangle':
      case 'rect':
        this.renderRectangle(context, entity, options);
        break;
      default:
        console.warn(`EntityPass: Unknown entity type: ${entity.type}`);
    }

    if (!skipStyleSetup) {
      context.restore();
    }
  }

  /**
   * 🔺 VIEWPORT CULLING
   * Αφαιρεί entities που είναι εκτός viewport
   */
  private cullEntitiesOutsideViewport(
    entities: Entity[],
    viewport: { x: number; y: number; width: number; height: number },
    transform: { scale: number; offsetX: number; offsetY: number }
  ): Entity[] {
    const visible: Entity[] = [];

    for (const entity of entities) {
      if (this.isEntityVisible(entity, viewport, transform)) {
        visible.push(entity);
      } else {
        this.stats.entitiesCulled++;
      }
    }

    return visible;
  }

  /**
   * 🔺 VISIBILITY CHECK
   * Ελέγχει αν ένα entity είναι ορατό στο viewport
   */
  private isEntityVisible(
    entity: Entity,
    viewport: { x: number; y: number; width: number; height: number },
    transform: { scale: number; offsetX: number; offsetY: number }
  ): boolean {
    // Simple bounding box check - can be optimized with proper bounds calculation
    const bounds = this.calculateEntityBounds(entity);
    if (!bounds) return true; // If can't calculate bounds, assume visible

    // 🏢 ADR-151: Use centralized transformBoundsToScreen
    const screenBounds = transformBoundsToScreen(bounds, transform);

    const viewportX = viewport.x ?? 0;
    const viewportY = viewport.y ?? 0;
    return !(screenBounds.maxX < viewportX ||
             screenBounds.minX > viewportX + viewport.width ||
             screenBounds.maxY < viewportY ||
             screenBounds.minY > viewportY + viewport.height);
  }

  /**
   * 🔺 ENTITY BOUNDS CALCULATION
   * Υπολογίζει τα bounds ενός entity (simplified)
   */
  private calculateEntityBounds(entity: Entity): { minX: number; minY: number; maxX: number; maxY: number } | null {
    // Simplified bounds calculation - should be expanded for all entity types
    switch (entity.type) {
      case 'line':
        const start = entity.start as { x: number; y: number };
        const end = entity.end as { x: number; y: number };
        return {
          minX: Math.min(start.x, end.x),
          minY: Math.min(start.y, end.y),
          maxX: Math.max(start.x, end.x),
          maxY: Math.max(start.y, end.y)
        };
      case 'circle':
        const center = entity.center as { x: number; y: number };
        const radius = entity.radius as number;
        return {
          minX: center.x - radius,
          minY: center.y - radius,
          maxX: center.x + radius,
          maxY: center.y + radius
        };
      default:
        return null; // Not implemented for this entity type
    }
  }

  /**
   * 🔺 SIMPLE ENTITY RENDERERS
   * Simplified rendering για demonstration - θα χρησιμοποιήσουμε τους υπάρχοντες renderers
   */
  private renderLine(context: IRenderContext, entity: Entity, options: RenderPassOptions): void {
    // ✅ ENTERPRISE FIX: Safe property access with type guard
    if (!('start' in entity) || !('end' in entity)) return;
    const start = entity.start as { x: number; y: number };
    const end = entity.end as { x: number; y: number };

    const screenStart = context.worldToScreen(start);
    const screenEnd = context.worldToScreen(end);

    context.beginPath();
    context.moveTo(screenStart.x, screenStart.y);
    context.lineTo(screenEnd.x, screenEnd.y);
    context.stroke();
  }

  private renderCircle(context: IRenderContext, entity: Entity, options: RenderPassOptions): void {
    // ✅ ENTERPRISE FIX: Safe property access with type guard
    if (!('center' in entity) || !('radius' in entity)) return;
    const center = entity.center as { x: number; y: number };
    const radius = entity.radius as number;

    const screenCenter = context.worldToScreen(center);
    const screenRadius = radius * options.transform.scale;

    // 🔧 FIX (2026-01-31): Use ellipse() instead of arc() - arc() has rendering bug!
    context.beginPath();
    context.ellipse(screenCenter.x, screenCenter.y, screenRadius, screenRadius, 0, 0, TAU);
    context.stroke();
  }

  private renderPolyline(context: IRenderContext, entity: Entity, options: RenderPassOptions): void {
    // ✅ ENTERPRISE FIX: Safe property access with type guard
    if (!('vertices' in entity)) return;
    const vertices = entity.vertices as { x: number; y: number }[];
    if (!vertices || vertices.length < 2) return;

    const screenVertices = vertices.map(v => context.worldToScreen(v));

    context.beginPath();
    context.moveTo(screenVertices[0].x, screenVertices[0].y);
    for (let i = 1; i < screenVertices.length; i++) {
      context.lineTo(screenVertices[i].x, screenVertices[i].y);
    }

    // ✅ ENTERPRISE FIX: Safe property access
    if ('closed' in entity && entity.closed) {
      context.closePath();
    }

    context.stroke();
  }

  private renderArc(context: IRenderContext, entity: Entity, options: RenderPassOptions): void {
    // Simplified arc rendering
    this.renderCircle(context, entity, options);
  }

  private renderText(context: IRenderContext, entity: Entity, options: RenderPassOptions): void {
    // ✅ ENTERPRISE FIX: Safe property access with type guards
    if (!('position' in entity) || !('text' in entity)) return;
    const position = entity.position as { x: number; y: number };
    const text = entity.text as string;

    const screenPos = context.worldToScreen(position);

    context.fillText(text, screenPos.x, screenPos.y);
  }

  private renderRectangle(context: IRenderContext, entity: Entity, options: RenderPassOptions): void {
    // ✅ ENTERPRISE FIX: Safe property access with type guard
    if (!('vertices' in entity)) return;
    const vertices = entity.vertices as { x: number; y: number }[];
    if (!vertices || vertices.length < 4) return;

    const polylineEntity: Entity = {
      ...entity,
      type: 'polyline',
      vertices,
      closed: true
    };
    this.renderPolyline(context, polylineEntity, options);
  }

  /**
   * 🔺 ENTITY STYLING
   * Εφαρμόζει styling σε ένα entity
   */
  private applyEntityStyle(context: IRenderContext, entity: Entity): void {
    // ✅ ENTERPRISE FIX: Safe property access with type assertion
    const entityWithStyle = entity as Entity & { color?: string; lineWidth?: number; lineDash?: number[]; opacity?: number; };
    context.setState({
      strokeStyle: entityWithStyle.color || UI_COLORS.WHITE,
      lineWidth: entityWithStyle.lineWidth || 1,
      lineDash: entityWithStyle.lineDash || [],
      globalAlpha: entityWithStyle.opacity || 1
    });
  }

  /**
   * 🔺 CACHE KEY GENERATION
   * Δημιουργεί unique key για caching
   */
  private getCacheKey(entity: Entity): string {
    return `${entity.type}_${entity.id}_${JSON.stringify(entity)}`;
  }

  /**
   * 🔺 PERFORMANCE STATS
   */
  getStats() {
    return { ...this.stats };
  }

  private resetStats(): void {
    this.stats = {
      entitiesRendered: 0,
      entitiesCulled: 0,
      batchesProcessed: 0,
      cacheHits: 0,
      cacheMisses: 0
    };
  }

  cleanup(): void {
    this.pathCache.clear();
    this.resetStats();
  }
}

/**
 * 🔺 FACTORY FUNCTION
 * Δημιουργεί EntityPass με default configuration
 */
export function createEntityPass(config?: Partial<EntityPassConfig>): EntityPass {
  const defaultConfig: EntityPassConfig = {
    batchingEnabled: true,
    maxBatchSize: 100,
    cullOutsideViewport: true,
    levelOfDetail: false,
    cacheEnabled: true
  };

  return new EntityPass({ ...defaultConfig, ...config });
}
