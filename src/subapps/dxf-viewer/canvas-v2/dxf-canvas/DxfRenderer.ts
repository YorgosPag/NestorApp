/**
 * CANVAS V2 - UNIFIED DXF RENDERER
 * ✅ ΕΞΑΛΕΙΨΗ ΔΙΠΛΟΓΡΑΦΙΩΝ: Χρησιμοποιεί EntityRendererComposite
 * ❌ ΠΡΙΝ: Direct switch statement με duplicate rendering methods
 * ✅ ΜΕΤΑ: Centralized composite pattern
 */

import type { ViewTransform, Viewport, Point2D } from '../../rendering/types/Types';
import type { DxfScene, DxfEntityUnion, DxfRenderOptions } from './dxf-types';
import { CoordinateTransforms, COORDINATE_LAYOUT } from '../../rendering/core/CoordinateTransforms';
import { UI_COLORS } from '../../config/color-config';
import { CanvasUtils } from '../../rendering/canvas/utils/CanvasUtils';

// ✅ ΝΕΟ: Import unified rendering system
import { EntityRendererComposite } from '../../rendering/core/EntityRendererComposite';
import { Canvas2DContext } from '../../rendering/adapters/canvas2d/Canvas2DContext';
import type { EntityModel, RenderOptions } from '../../rendering/types/Types';
import type { LineType } from '../../settings-core/types';



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
    // Clear canvas
    CanvasUtils.clearCanvas(this.ctx, this.canvas, 'transparent');

    // 🎨 DEBUG: Draw DxfCanvas origin marker (ORANGE) - TOP + LEFT half
    // ✅ CORRECT: Calculate screen position of ACTUAL world (0,0) using CoordinateTransforms
    const worldOrigin = { x: 0, y: 0 };
    const screenOrigin = CoordinateTransforms.worldToScreen(worldOrigin, transform, viewport);
    const px = (v: number) => Math.round(v) + 0.5;
    const originX = px(screenOrigin.x);
    const originY = px(screenOrigin.y);

    this.ctx.save();
    this.ctx.strokeStyle = UI_COLORS.DRAWING_HIGHLIGHT; // ✅ CENTRALIZED: Orange highlight για DXF origin marker
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
    this.ctx.fillStyle = UI_COLORS.DRAWING_HIGHLIGHT; // ✅ CENTRALIZED: Orange text για DXF label
    this.ctx.font = 'bold 12px monospace';
    this.ctx.fillText('DXF', originX - 45, originY - 10);
    this.ctx.restore();

    // Early return if no scene
      if (!scene || !scene.entities.length) {
        // Silent: No scene or no entities to render (avoid React stack noise)
        return;
      }

    this.ctx.save();

    // ✅ ΝΕΟ: Update composite settings
    this.entityComposite.setTransform(transform);

    // Render all entities
    for (const entity of scene.entities) {
      if (!entity.visible) continue;
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
    // Type guard: Τα DXF entities μπορεί να έχουν optional lineType property
    const entityWithLineType = entity as typeof entity & { lineType?: string };

    const entityModel: EntityModel = {
      id: entity.id,
      type: entity.type,
      visible: entity.visible,
      selected: isSelected,
      layer: entity.layer,
      color: entity.color,
      lineType: mapDxfLineTypeToEnterprise(entityWithLineType.lineType),
      lineweight: entity.lineWidth, // ✅ ENTERPRISE FIX: Use correct property name 'lineweight' not 'lineWeight'

      // Geometry mapping βάσει τύπου
      ...this.mapEntityGeometry(entity)
    };

    // ✅ COMPOSITE RENDERING: Ένα κεντρικό call αντί για switch
    const renderOptions: RenderOptions = {
      phase: isSelected ? 'selected' : 'normal',
      transform,
      viewport,
      showGrips: isSelected, // ✅ FIX: Show grips for selected entities
      alpha: entity.visible ? 1.0 : 0.3
    };

    // 🚀 ΑΥΤΟ ΑΝΤΙΚΑΘΙΣΤΑ ΤΟ SWITCH STATEMENT!
    // 🏢 ENTERPRISE: EntityModel is compatible with Entity - both extend BaseEntity
    this.entityComposite.render(entityModel as import('../../types/entities').Entity, renderOptions);
  }


  /**
   * ✅ HELPER: Map DxfEntityUnion geometry σε EntityModel format
   */
  private mapEntityGeometry(entity: DxfEntityUnion): Record<string, any> { // ✅ ENTERPRISE FIX: Return flexible object for geometry properties
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

      case 'polyline': {
        // Type guard: Polyline entities έχουν vertices property
        const polyline = entity as typeof entity & { vertices?: Point2D[]; points?: Point2D[] };
        return {
          points: polyline.points || polyline.vertices || []
        };
      }

      case 'arc':
        // Arc entities ήδη έχουν τα properties στο DxfArc type
        return {
          center: entity.center,
          radius: entity.radius,
          startAngle: entity.startAngle,
          endAngle: entity.endAngle
        };

      case 'text':
        // ╔════════════════════════════════════════════════════════════════════╗
        // ║ ⚠️ VERIFIED WORKING (2026-01-03) - ΜΗΝ ΑΛΛΑΞΕΤΕ!                   ║
        // ║                                                                    ║
        // ║ ΚΡΙΣΙΜΟ: Αυτός ο κώδικας είναι ΑΠΑΡΑΙΤΗΤΟΣ για σωστή εμφάνιση     ║
        // ║ κειμένων διαστάσεων (dimension text) με τη σωστή κατεύθυνση.      ║
        // ║                                                                    ║
        // ║ ✅ position: Θέση κειμένου στο DXF                                 ║
        // ║ ✅ text: Περιεχόμενο κειμένου                                      ║
        // ║ ✅ height: Ύψος γραμματοσειράς (ΟΧΙ fontSize!)                     ║
        // ║ ✅ rotation: Γωνία περιστροφής σε μοίρες (ΚΡΙΣΙΜΟ!)               ║
        // ║                                                                    ║
        // ║ 🔧 FIX (2026-01-03): Προσθήκη rotation - χωρίς αυτό τα κείμενα    ║
        // ║    διαστάσεων εμφανίζονταν ΠΑΝΤΑ οριζόντια!                       ║
        // ╚════════════════════════════════════════════════════════════════════╝
        return {
          position: entity.position,
          text: entity.text,
          height: entity.height,
          rotation: entity.rotation
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
    this.ctx.strokeStyle = UI_COLORS.DRAWING_HIGHLIGHT;
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