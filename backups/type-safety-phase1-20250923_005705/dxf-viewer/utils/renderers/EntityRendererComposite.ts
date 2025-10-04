/**
 * Entity Renderer Composite
 * Manages all entity-specific renderers and delegates rendering to appropriate renderer
 */

import { BaseEntityRenderer } from './BaseEntityRenderer';
import type { EntityModel, GripInfo, RenderOptions } from '../../types/renderer';
import { LineRenderer } from './LineRenderer';
import { CircleRenderer } from './CircleRenderer';
import { PolylineRenderer } from './PolylineRenderer';
import { ArcRenderer } from './ArcRenderer';
import { TextRenderer } from './TextRenderer';
import { RectangleRenderer } from './RectangleRenderer';
import { EllipseRenderer } from './EllipseRenderer';
import { SplineRenderer } from './SplineRenderer';
import { AngleMeasurementRenderer } from './AngleMeasurementRenderer';
import { PointRenderer } from './PointRenderer';
import { UI_COLORS } from '../../config/color-config';

import type { ViewTransform, Point2D } from '../../systems/rulers-grid/config';
import type { GripSettings, GripInteractionState } from '../../types/gripSettings';

export class EntityRendererComposite {
  private renderers: Map<string, BaseEntityRenderer>;
  private ctx: CanvasRenderingContext2D;
  private transform: ViewTransform = { scale: 1, offsetX: 0, offsetY: 0 };
  private gripSettings?: GripSettings;
  private gripInteraction: GripInteractionState = {};

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
    this.renderers = new Map();
    this.initializeRenderers();
  }

  private initializeRenderers(): void {
    // Create instances of all entity renderers
    const lineRenderer = new LineRenderer(this.ctx);
    const circleRenderer = new CircleRenderer(this.ctx);
    const polylineRenderer = new PolylineRenderer(this.ctx);
    const arcRenderer = new ArcRenderer(this.ctx);
    const textRenderer = new TextRenderer(this.ctx);
    const rectangleRenderer = new RectangleRenderer(this.ctx);
    const ellipseRenderer = new EllipseRenderer(this.ctx);
    const splineRenderer = new SplineRenderer(this.ctx);
    const angleMeasurementRenderer = new AngleMeasurementRenderer(this.ctx);
    const pointRenderer = new PointRenderer(this.ctx);

    // Register renderers by entity type
    this.renderers.set('line', lineRenderer);
    this.renderers.set('circle', circleRenderer);
    this.renderers.set('polyline', polylineRenderer);
    this.renderers.set('lwpolyline', polylineRenderer); // Light-weight polyline uses same renderer
    this.renderers.set('arc', arcRenderer);
    this.renderers.set('text', textRenderer);
    this.renderers.set('mtext', textRenderer); // Multi-line text uses same renderer
    this.renderers.set('rectangle', rectangleRenderer);
    this.renderers.set('rect', rectangleRenderer); // Alias
    this.renderers.set('ellipse', ellipseRenderer);
    this.renderers.set('spline', splineRenderer);
    this.renderers.set('point', pointRenderer); // Use point renderer for POINT entities
    this.renderers.set('angle-measurement', angleMeasurementRenderer);
  }

  // Settings management
  setTransform(transform: ViewTransform): void {
    this.transform = { ...transform };
    // Update all renderers
    this.renderers.forEach(renderer => renderer.setTransform(transform));
  }

  setGripSettings(settings: GripSettings): void {
    this.gripSettings = settings;
    // Update all renderers
    this.renderers.forEach(renderer => renderer.setGripSettings(settings));
  }

  setGripInteractionState(state: GripInteractionState): void {
    this.gripInteraction = state || {};
    // Update all renderers
    this.renderers.forEach(renderer => renderer.setGripInteractionState(state));
  }

  // Main render method
  render(entity: EntityModel, options: RenderOptions = {}): void {
    const renderer = this.getRenderer(entity.type);
    if (renderer) {
      renderer.render(entity, options);
    } else {
      console.warn(`No renderer found for entity type: ${entity.type}`);
      this.renderFallback(entity, options);
    }
  }

  // Render multiple entities
  renderEntities(entities: EntityModel[], options: RenderOptions = {}): void {
    entities.forEach(entity => {
      if (entity.visible !== false) {
        this.render(entity, options);
      }
    });
  }

  // Get grips for an entity
  getEntityGrips(entity: EntityModel): GripInfo[] {
    const renderer = this.getRenderer(entity.type);
    if (renderer) {
      return renderer.getGrips(entity);
    }
    return [];
  }

  // Find grip at point
  findGripAtPoint(entity: EntityModel, screenPoint: Point2D, tolerance: number = 8): GripInfo | null {
    const renderer = this.getRenderer(entity.type);
    if (renderer) {
      return renderer.findGripAtPoint(entity, screenPoint, tolerance);
    }
    return null;
  }

  // Hit test for entity
  hitTestEntity(entity: EntityModel, point: Point2D, tolerance: number): boolean {
    const renderer = this.getRenderer(entity.type);
    if (renderer) {
      return renderer.hitTest(entity, point, tolerance);
    }
    return false;
  }

  // Hit test for multiple entities
  hitTest(entities: EntityModel[], point: Point2D, tolerance: number): EntityModel | null {
    // Test in reverse order (top to bottom)
    for (let i = entities.length - 1; i >= 0; i--) {
      const entity = entities[i];
      if (entity.visible !== false && this.hitTestEntity(entity, point, tolerance)) {
        return entity;
      }
    }
    return null;
  }

  // Get renderer for entity type
  private getRenderer(entityType: string): BaseEntityRenderer | undefined {
    return this.renderers.get(entityType.toLowerCase());
  }

  // Fallback renderer for unknown entity types
  private renderFallback(entity: EntityModel, options: RenderOptions): void {
    // Safely handle unknown entity types without causing infinite loops
    try {
      const position = entity.position || entity.center || entity.start;
      if (!position) return;

      const screenPos = this.worldToScreen(position as Point2D);
      
      this.ctx.save();
      this.ctx.strokeStyle = UI_COLORS.SELECTION_HIGHLIGHT;
      this.ctx.lineWidth = 1;
      
      // ⚡ NUCLEAR: GENERIC POINT CIRCLE ELIMINATED
      
      this.ctx.restore();
    } catch (error) {
      // Silently handle any rendering errors to prevent crashes
      console.warn(`Fallback rendering failed for entity ${entity.id}:`, error);
    }
  }

  private worldToScreen(point: Point2D): Point2D {
    const rect = this.ctx.canvas.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    return {
      x: centerX + (point.x + this.transform.offsetX) * this.transform.scale,
      y: centerY - (point.y + this.transform.offsetY) * this.transform.scale
    };
  }

  // Clear canvas
  clear(): void {
    this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
  }

  // Get all registered entity types
  getSupportedEntityTypes(): string[] {
    return Array.from(this.renderers.keys());
  }
}