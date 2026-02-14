/**
 * CANVAS V2 - UNIFIED DXF RENDERER
 * ✅ ΕΞΑΛΕΙΨΗ ΔΙΠΛΟΓΡΑΦΙΩΝ: Χρησιμοποιεί EntityRendererComposite
 * ❌ ΠΡΙΝ: Direct switch statement με duplicate rendering methods
 * ✅ ΜΕΤΑ: Centralized composite pattern
 */

import type { ViewTransform, Viewport, Point2D } from '../../rendering/types/Types';
import type { DxfScene, DxfEntityUnion, DxfRenderOptions } from './dxf-types';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
// UI_COLORS, RENDER_LINE_WIDTHS, LINE_DASH_PATTERNS — removed: dashed selection overlay replaced by inline grips
// 🏢 ENTERPRISE: Refresh cached bounds before render to prevent stale clear/draw mismatch
import { canvasBoundsService } from '../../services/CanvasBoundsService';
// 🏢 ADR-102: Centralized Origin Markers
import { renderOriginMarker } from '../../rendering/ui/origin/OriginMarkerUtils';

// ✅ ΝΕΟ: Import unified rendering system
import { EntityRendererComposite } from '../../rendering/core/EntityRendererComposite';
import { Canvas2DContext } from '../../rendering/adapters/canvas2d/Canvas2DContext';
import type { EntityModel, RenderOptions } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';



/**
 * ✅ ENTERPRISE TYPE-SAFE MAPPING: DXF → Centralized LineType
 * Εξασφαλίζει enterprise compatibility χωρίς hardcoded values
 */
function mapDxfLineTypeToEnterprise(dxfLineType: string | undefined): 'solid' | 'dashed' | 'dotted' | 'dashdot' {
  const mapping: Record<string, 'solid' | 'dashed' | 'dotted' | 'dashdot'> = {
    'solid': 'solid',
    'dashed': 'dashed',
    'dotted': 'dotted',
    'dashdot': 'dashdot', // ✅ ENTERPRISE FIX: Keep 'dashdot' for BaseEntity compatibility
    'dash-dot': 'dashdot', // ✅ Map 'dash-dot' to 'dashdot' for BaseEntity compatibility
    'dash-dot-dot': 'dashdot' // ✅ Fallback to 'dashdot' for complex patterns
  };

  const key = dxfLineType || 'solid';
  return mapping[key] || 'solid';
}

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
    // 🔧 FIX (2026-02-15): Use FRESH bounds for both clear AND draw — single source of truth
    // Root cause: CanvasUtils.clearCanvas re-fetches from cache internally, which is fragile.
    // Direct clearRect with the same rect used for rendering eliminates any implicit dependency.
    const canvasRect = canvasBoundsService.refreshBounds(this.canvas);
    const actualViewport: Viewport = { width: canvasRect.width, height: canvasRect.height };

    // Clear canvas using exact same fresh dimensions as rendering viewport
    this.ctx.clearRect(0, 0, canvasRect.width, canvasRect.height);

    // 🏢 ADR-102: Centralized Origin Marker (Single Source of Truth)
    // Only DxfCanvas renders the origin marker - eliminates dual-canvas alignment issues
    renderOriginMarker(this.ctx, transform, actualViewport, { variant: 'dxf' });

    // Early return if no scene
      if (!scene || !scene.entities.length) {
        return;
      }

    this.ctx.save();

    // ✅ ΝΕΟ: Update composite settings
    this.entityComposite.setTransform(transform);

    // Render all entities
    for (const entity of scene.entities) {
      if (!entity.visible) continue;
      this.renderEntityUnified(entity, transform, actualViewport, options);
    }

    // Render selection highlights
    this.renderSelectionHighlights(scene, transform, actualViewport, options);

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
    const isHovered = options.hoveredEntityId === entity.id;

    const entityModel: EntityModel = this.toEntityModel(entity, isSelected);

    // ✅ COMPOSITE RENDERING: Ένα κεντρικό call αντί για switch
    const renderOptions: RenderOptions = {
      phase: isSelected ? 'selected' : isHovered ? 'highlighted' : 'normal',
      transform,
      viewport,
      showGrips: isSelected,
      grips: isSelected, // ✅ FIX: Enables grip rendering in renderWithPhases
      hovered: isHovered, // AutoCAD-style hover highlighting
      alpha: entity.visible ? 1.0 : 0.3
    };

    // 🚀 ΑΥΤΟ ΑΝΤΙΚΑΘΙΣΤΑ ΤΟ SWITCH STATEMENT!
    this.entityComposite.render(entityModel, renderOptions);
  }

  private toEntityModel(entity: DxfEntityUnion, isSelected: boolean): Entity {
    const entityWithLineType = entity as typeof entity & { lineType?: string };
    const entityWithMeasurement = entity as typeof entity & {
      measurement?: boolean;
      showEdgeDistances?: boolean;
    };
    const base = {
      id: entity.id,
      visible: entity.visible,
      selected: isSelected,
      layer: entity.layer,
      color: entity.color,
      lineType: mapDxfLineTypeToEnterprise(entityWithLineType.lineType),
      lineweight: entity.lineWidth,
      ...(entityWithMeasurement.measurement !== undefined && { measurement: entityWithMeasurement.measurement }),
      ...(entityWithMeasurement.showEdgeDistances !== undefined && { showEdgeDistances: entityWithMeasurement.showEdgeDistances })
    };

    switch (entity.type) {
      case 'line':
        return { ...base, type: 'line', start: entity.start, end: entity.end };
      case 'circle':
        return { ...base, type: 'circle', center: entity.center, radius: entity.radius };
      case 'polyline':
        return { ...base, type: 'polyline', vertices: entity.vertices, closed: entity.closed };
      case 'arc':
        return {
          ...base,
          type: 'arc',
          center: entity.center,
          radius: entity.radius,
          startAngle: entity.startAngle,
          endAngle: entity.endAngle,
          counterclockwise: entity.counterclockwise
        };
      case 'text':
        return {
          ...base,
          type: 'text',
          position: entity.position,
          text: entity.text,
          height: entity.height,
          rotation: entity.rotation
        };
      case 'angle-measurement':
        return {
          ...base,
          type: 'angle-measurement',
          vertex: entity.vertex,
          point1: entity.point1,
          point2: entity.point2,
          angle: entity.angle
        };
      default: {
        const exhaustiveCheck: never = entity;
        return exhaustiveCheck;
      }
    }
  }

  /**
   * Render selection highlights — grips are now rendered per-entity via renderWithPhases.
   * This method is kept as a no-op to avoid removing the call site.
   * The dashed orange bounding box has been replaced by proper AutoCAD-style grips.
   */
  private renderSelectionHighlights(
    _scene: DxfScene,
    _transform: ViewTransform,
    _viewport: Viewport,
    _options: DxfRenderOptions
  ): void {
    // Grips are now rendered inline during entity rendering (options.grips = true)
    // No additional selection overlay needed
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

      case 'arc': {
        // 🏢 ENTERPRISE (2026-02-13): Arc highlight — bounding circle of the arc
        const arcCenter = CoordinateTransforms.worldToScreen(entity.center, transform, viewport);
        const arcScreenRadius = entity.radius * transform.scale;
        return {
          min: { x: arcCenter.x - arcScreenRadius, y: arcCenter.y - arcScreenRadius },
          max: { x: arcCenter.x + arcScreenRadius, y: arcCenter.y + arcScreenRadius }
        };
      }

      case 'polyline': {
        // 🏢 ENTERPRISE (2026-02-13): Polyline/polygon highlight — bounds from all vertices
        if (!entity.vertices || entity.vertices.length === 0) return null;
        const screenVerts = entity.vertices.map(v => CoordinateTransforms.worldToScreen(v, transform, viewport));
        let minX = screenVerts[0].x, minY = screenVerts[0].y;
        let maxX = screenVerts[0].x, maxY = screenVerts[0].y;
        for (let i = 1; i < screenVerts.length; i++) {
          minX = Math.min(minX, screenVerts[i].x);
          minY = Math.min(minY, screenVerts[i].y);
          maxX = Math.max(maxX, screenVerts[i].x);
          maxY = Math.max(maxY, screenVerts[i].y);
        }
        return { min: { x: minX, y: minY }, max: { x: maxX, y: maxY } };
      }

      case 'angle-measurement': {
        // 🏢 ENTERPRISE (2026-02-13): Angle measurement highlight — bounds from 3 points
        const v = CoordinateTransforms.worldToScreen(entity.vertex, transform, viewport);
        const p1 = CoordinateTransforms.worldToScreen(entity.point1, transform, viewport);
        const p2 = CoordinateTransforms.worldToScreen(entity.point2, transform, viewport);
        return {
          min: { x: Math.min(v.x, p1.x, p2.x), y: Math.min(v.y, p1.y, p2.y) },
          max: { x: Math.max(v.x, p1.x, p2.x), y: Math.max(v.y, p1.y, p2.y) }
        };
      }

      case 'text': {
        // 🏢 ENTERPRISE (2026-02-13): Text highlight — approximate from position and height
        const textPos = CoordinateTransforms.worldToScreen(entity.position, transform, viewport);
        const screenHeight = entity.height * transform.scale;
        return {
          min: { x: textPos.x, y: textPos.y - screenHeight },
          max: { x: textPos.x + screenHeight * 4, y: textPos.y } // Approximate width = 4x height
        };
      }

      default:
        return null;
    }
  }


}
