/**
 * CANVAS V2 - UNIFIED DXF RENDERER
 * ✅ ΕΞΑΛΕΙΨΗ ΔΙΠΛΟΓΡΑΦΙΩΝ: Χρησιμοποιεί EntityRendererComposite
 * ❌ ΠΡΙΝ: Direct switch statement με duplicate rendering methods
 * ✅ ΜΕΤΑ: Centralized composite pattern
 */

import type { ViewTransform, Viewport, Point2D } from '../../rendering/types/Types';
import type { DxfScene, DxfEntityUnion, DxfRenderOptions } from './dxf-types';
import { CoordinateTransforms, COORDINATE_LAYOUT } from '../../rendering/core/CoordinateTransforms';
import { CanvasUtils } from '../../rendering/canvas/utils/CanvasUtils';

// ✅ ΝΕΟ: Import unified rendering system
import { EntityRendererComposite } from '../../rendering/core/EntityRendererComposite';
import { Canvas2DContext } from '../../rendering/adapters/canvas2d/Canvas2DContext';
import type { EntityModel, RenderOptions } from '../../rendering/types/Types';



export class DxfRenderer {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  private entityComposite: EntityRendererComposite; // ✅ ΝΕΟ: Centralized rendering
  private renderContext: Canvas2DContext; // ✅ ΝΕΟ: Backend abstraction

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2D context for DXF canvas');
    this.ctx = ctx;

    // ✅ ΝΕΟ: Initialize unified rendering system
    this.renderContext = new Canvas2DContext(canvas);
    this.entityComposite = new EntityRendererComposite(ctx);
  }

  /**
   * Κύρια render method
   * ✅ ΕΝΗΜΕΡΩΜΕΝΟ: Χρησιμοποιεί composite για entity rendering
   */
  render(
    scene: DxfScene | null,
    transform: ViewTransform,
    viewport: Viewport,
    options: DxfRenderOptions = {
      showGrid: false,
      showLayerNames: false,
      wireframeMode: false,
      selectedEntityIds: []
    }
  ): void {
    // Clear canvas
    CanvasUtils.clearCanvas(this.ctx, this.canvas, 'transparent');

    console.log('🔧 DxfRenderer.render called:', {
      hasScene: !!scene,
      entityCount: scene?.entities?.length || 0,
      transform,
      viewport
    });

    // 🎨 DEBUG: Draw DxfCanvas origin marker (ORANGE) - TOP + LEFT half
    // ✅ CORRECT: Calculate screen position of ACTUAL world (0,0) using CoordinateTransforms
    const worldOrigin = { x: 0, y: 0 };
    const screenOrigin = CoordinateTransforms.worldToScreen(worldOrigin, transform, viewport);
    const px = (v: number) => Math.round(v) + 0.5;
    const originX = px(screenOrigin.x);
    const originY = px(screenOrigin.y);

    // 🔍 DEBUG: Log values to compare with rulers
    console.log('🟠 DxfRenderer origin marker:', {
      worldOrigin,
      screenOrigin,
      transform: { scale: transform.scale, offsetX: transform.offsetX, offsetY: transform.offsetY },
      calculated: { originX, originY }
    });
    this.ctx.save();
    this.ctx.strokeStyle = 'orange';
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    // TOP vertical line (up from origin)
    this.ctx.moveTo(originX, originY);
    this.ctx.lineTo(originX, originY - 20);
    // LEFT horizontal line (left from origin)
    this.ctx.moveTo(originX, originY);
    this.ctx.lineTo(originX - 20, originY);
    this.ctx.stroke();
    // Label
    this.ctx.fillStyle = 'orange';
    this.ctx.font = 'bold 12px monospace';
    this.ctx.fillText('DXF', originX - 45, originY - 10);
    this.ctx.restore();

    // Early return if no scene - but origin marker is already drawn above!
    if (!scene || !scene.entities.length) {
      console.warn('🚨 DxfRenderer: No scene or no entities to render');
      return;
    }

    this.ctx.save();

    // ✅ ΝΕΟ: Update composite settings
    this.entityComposite.setTransform(transform);

    // Render all entities
    for (const entity of scene.entities) {
      if (!entity.visible) continue;

      // ✅ ΑΝΤΙΚΑΤΑΣΤΑΣΗ: Χρήση composite αντί για switch statement
      this.renderEntityUnified(entity, transform, viewport, options);
    }

    // Render selection highlights
    this.renderSelectionHighlights(scene, transform, viewport, options);

    this.ctx.restore();
  }

  /**
   * ✅ ΝΕΟ: Unified entity rendering με composite pattern
   * Αντικαθιστά τις 5 διπλογραφικές methods (renderLine, renderCircle, κλπ)
   */
  private renderEntityUnified(
    entity: DxfEntityUnion,
    transform: ViewTransform,
    viewport: Viewport,
    options: DxfRenderOptions
  ): void {
    const isSelected = options.selectedEntityIds.includes(entity.id);

    // Convert DxfEntityUnion to EntityModel για compatibility
    const entityModel: EntityModel = {
      id: entity.id,
      type: entity.type,
      visible: entity.visible,
      selected: isSelected,
      layer: entity.layer,
      color: entity.color,
      lineType: (entity as any).lineType || 'solid',
      lineWeight: entity.lineWidth,

      // Geometry mapping βάσει τύπου
      ...this.mapEntityGeometry(entity)
    };

    // ✅ COMPOSITE RENDERING: Ένα κεντρικό call αντί για switch
    const renderOptions: RenderOptions = {
      phase: isSelected ? 'selected' : 'normal',
      transform,
      viewport,
      showGrips: false, // Θα ενεργοποιηθεί σε επόμενη φάση
      alpha: entity.visible ? 1.0 : 0.3
    };

    // 🚀 ΑΥΤΟ ΑΝΤΙΚΑΘΙΣΤΑ ΤΟ SWITCH STATEMENT!
    this.entityComposite.render(entityModel, renderOptions);
  }


  /**
   * ✅ HELPER: Map DxfEntityUnion geometry σε EntityModel format
   */
  private mapEntityGeometry(entity: DxfEntityUnion): Partial<EntityModel> {
    switch (entity.type) {
      case 'line':
        return {
          start: entity.start,
          end: entity.end
        };

      case 'circle':
        return {
          center: entity.center,
          radius: entity.radius
        };

      case 'polyline':
        return {
          points: (entity as any).points || (entity as any).vertices || []
        };

      case 'arc':
        return {
          center: entity.center,
          radius: entity.radius,
          // Arc-specific properties θα πρέπει να προστεθούν στο EntityModel
          startAngle: (entity as any).startAngle,
          endAngle: (entity as any).endAngle
        };

      case 'text':
        return {
          position: entity.position,
          // Text-specific properties
          text: (entity as any).text,
          height: (entity as any).height
        };

      default:
        return {};
    }
  }

  /**
   * Render selection highlights
   * 🚨 TODO Φάση 2.4: Θα μεταφερθεί στο SelectionRenderer για πλήρη deduplication
   */
  private renderSelectionHighlights(
    scene: DxfScene,
    transform: ViewTransform,
    viewport: Viewport,
    options: DxfRenderOptions
  ): void {
    if (options.selectedEntityIds.length === 0) return;

    this.ctx.save();
    this.ctx.strokeStyle = '#ff6600';
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([5, 5]);

    for (const entityId of options.selectedEntityIds) {
      const entity = scene.entities.find(e => e.id === entityId);
      if (!entity) continue;

      // Simple selection box για τώρα - θα βελτιωθεί στη Φάση 2.4
      const bounds = this.calculateEntityBounds(entity, transform, viewport);
      if (bounds) {
        this.ctx.strokeRect(bounds.min.x - 2, bounds.min.y - 2,
                           bounds.max.x - bounds.min.x + 4,
                           bounds.max.y - bounds.min.y + 4);
      }
    }

    this.ctx.restore();
  }

  /**
   * Calculate basic entity bounds για selection highlighting
   * TODO: Θα βελτιωθεί με proper bounding box calculation στη Φάση 4
   */
  private calculateEntityBounds(
    entity: DxfEntityUnion,
    transform: ViewTransform,
    viewport: Viewport
  ): { min: Point2D; max: Point2D } | null {
    switch (entity.type) {
      case 'line': {
        const start = CoordinateTransforms.worldToScreen(entity.start, transform, viewport);
        const end = CoordinateTransforms.worldToScreen(entity.end, transform, viewport);
        return {
          min: { x: Math.min(start.x, end.x), y: Math.min(start.y, end.y) },
          max: { x: Math.max(start.x, end.x), y: Math.max(start.y, end.y) }
        };
      }

      case 'circle': {
        const center = CoordinateTransforms.worldToScreen(entity.center, transform, viewport);
        const screenRadius = entity.radius * transform.scale;
        return {
          min: { x: center.x - screenRadius, y: center.y - screenRadius },
          max: { x: center.x + screenRadius, y: center.y + screenRadius }
        };
      }

      default:
        return null; // TODO: Implement για άλλους τύπους
    }
  }


}