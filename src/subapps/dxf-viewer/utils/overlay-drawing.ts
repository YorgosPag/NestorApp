import type { Point2D } from '../rendering/types/Types';
import type { Region, RegionStatus } from '../types/overlay';
import type { ViewTransform } from '../rendering/types/Types';
import type { GripSettings } from '../types/gripSettings';
import { getStatusColors } from '../config/color-mapping'; // 🔺 Κεντρική function για ελληνικά/αγγλικά mapping
import { UI_COLORS, OPACITY, OVERLAY_OPACITY } from '../config/color-config'; // 🏢 ADR-119 + ADR-258
// 🏢 ADR-151: Centralized Simple Coordinate Transforms
import { worldToScreenSimple } from '../rendering/core/CoordinateTransforms';
// 🏢 ADR-044: Centralized Line Widths
// 🏢 ADR-083: Centralized Line Dash Patterns
// 🏢 ADR-090: Centralized UI Fonts
// 🏢 ADR-139: Centralized Label Box Dimensions
import { RENDER_LINE_WIDTHS, UI_FONTS, LINE_DASH_PATTERNS, TEXT_LABEL_OFFSETS } from '../config/text-rendering-config';
import { drawVerticesPath } from '../rendering/entities/shared/geometry-rendering-utils';

// 🏢 ADR-048: Unified Grip Rendering System
import { UnifiedGripRenderer, type GripRenderConfig } from '../rendering/grips';

// DEBUG FLAG - Set to false to disable performance-heavy logging
const DEBUG_OVERLAY_DRAWING = false;

export interface OverlayRenderOptions {
  showHandles: boolean;
  showLabels: boolean;
  selectedRegionIds: string[];
  isDrawing?: boolean;
  drawingVertices?: Point2D[];
  drawingStatus?: RegionStatus;
  editingRegionId?: string | null;
  mousePosition?: Point2D;
  gripSettings?: GripSettings; // === ΝΕΟ: GRIP SETTINGS ===
  gripInteractionState?: { // === ΝΕΟ: GRIP INTERACTION STATE ===
    hovered?: { entityId: string; gripIndex: number };
    active?: { entityId: string; gripIndex: number };
  };
}

export class OverlayDrawingEngine {
  private ctx: CanvasRenderingContext2D;
  private gripRenderer: UnifiedGripRenderer; // 🏢 ADR-048: Unified renderer

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
    // 🏢 ADR-048: Identity transform for overlay (already in screen coords)
    this.gripRenderer = new UnifiedGripRenderer(ctx, (p) => p);
  }

  drawRegion(
    region: Region,
    transform: ViewTransform,
    options: OverlayRenderOptions,
    canvasHeight: number
  ): void {
    if (!region.visible || region.vertices.length === 0) return;

    const ctx = this.ctx;
    const isSelected = options.selectedRegionIds.includes(region.id);
    const isEditing = options.editingRegionId === region.id;

    // Convert vertices to screen coordinates using OVERLAY coordinate system (not UGS)
    // This matches the coordinate system used by the original OverlayLayer
    // 🏢 ADR-151: Use centralized worldToScreenSimple (no Y-inversion for overlays)
    const screenVertices = region.vertices.map(v => worldToScreenSimple(v, transform));

    // Draw region fill using ToolStyle if available
    ctx.save();
    
    // 🐛 DEBUG: Ελέγχουμε τι παίρνουμε στον renderer

    // 🏢 ADR-258: Twin Architecture — Dynamic overlay coloring
    // Linked overlays: χρώμα βάσει status (20% fill opacity — αχνό, δεν κρύβει DXF γραμμές)
    // Unlinked overlays: λευκό (rgba(255,255,255,0.05) — σχεδόν αόρατο fill)
    const hasLinkedEntity = !!(region.metadata as Record<string, unknown> | undefined)?.linked;
    const hasStatus = region.status && region.status !== 'unavailable';
    const statusColors = hasStatus ? getStatusColors(region.status) : null;

    const fillColor = region.style?.fill
      || (hasLinkedEntity || hasStatus ? statusColors?.fill : undefined)
      || UI_COLORS.WHITE;
    const fillOpacity = region.style?.opacity
      ?? (hasLinkedEntity || hasStatus ? OVERLAY_OPACITY.DXF_FILL : OVERLAY_OPACITY.DXF_FILL);

    // 🐛 FIX: Επαναφορά globalCompositeOperation για να μη "μαυρίζει" από blend
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = fillOpacity;
    ctx.fillStyle = fillColor;

    drawVerticesPath(ctx, screenVertices, true);
    ctx.fill();

    // Draw border with DXF-style hover effects using ToolStyle if available
    ctx.globalAlpha = OPACITY.OPAQUE; // 🏢 ADR-119: Centralized opacity
    
    // Check if region is hovered (has grip interaction)
    const isHovered = options.gripInteractionState?.hovered?.entityId === region.id;
    // 🏢 ADR-258: Linked → status stroke color, Unlinked → λευκό stroke
    const strokeColor = region.style?.stroke
      || (hasLinkedEntity || hasStatus ? statusColors?.stroke : undefined)
      || UI_COLORS.WHITE;
    const lineWidth = region.style?.lineWidth || 2;

    if (isHovered) {
      // DXF HOVER STYLE: white, thick, dashed
      ctx.strokeStyle = UI_COLORS.WHITE;
      ctx.lineWidth = Math.max(3, lineWidth);
      ctx.setLineDash([...LINE_DASH_PATTERNS.HOVER]); // 🏢 ADR-083

    } else if (isSelected) {
      // SELECTED STYLE: red border
      ctx.strokeStyle = UI_COLORS.ERROR;
      ctx.lineWidth = Math.max(2, lineWidth);
      ctx.setLineDash([]);
    } else {
      // NORMAL STYLE: use ToolStyle stroke color and width
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = lineWidth;
      ctx.setLineDash([]);
    }
    
    if (region.locked) {
      ctx.setLineDash([...LINE_DASH_PATTERNS.LOCKED]); // 🏢 ADR-083
    }
    
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.restore();

    // Draw label
    const regionWithName = region as Region & { name?: string };
    if (options.showLabels && regionWithName.name) {
      this.drawLabel(regionWithName, screenVertices, isSelected);
    }

    // Draw AutoCAD-style handles με LIVE GRIP SETTINGS
    if (options.showHandles && isSelected && !region.locked) {
      this.drawAutoCADHandles(screenVertices, isEditing, options.gripSettings, region.id, options.gripInteractionState);
    }
  }

  drawDrawingPreview(
    vertices: Point2D[],
    status: RegionStatus,
    transform: ViewTransform,
    canvasHeight: number,
    mousePosition?: Point2D,
    gripSettings?: GripSettings // === ΝΕΟ: GRIP SETTINGS ===
  ): void {
    if (vertices.length === 0) return;

    const ctx = this.ctx;
    // Convert vertices to screen coordinates using OVERLAY coordinate system (not UGS)
    // 🏢 ADR-151: Use centralized worldToScreenSimple (no Y-inversion for overlays)
    const screenVertices = vertices.map(v => worldToScreenSimple(v, transform));

    ctx.save();
    
    // 🔺 ΚΕΝΤΡΙΚΗ ΛΟΓΙΚΗ: Χρήση getStatusColors() για drawing preview
    const statusColors = getStatusColors(status);
    ctx.strokeStyle = statusColors?.stroke || UI_COLORS.BUTTON_PRIMARY;
    ctx.lineWidth = RENDER_LINE_WIDTHS.NORMAL; // 🏢 ADR-044

    drawVerticesPath(ctx, screenVertices, false);
    if (mousePosition) {
      ctx.lineTo(mousePosition.x, mousePosition.y);
    }
    ctx.stroke();

    ctx.restore();

    // Draw vertex dots με AutoCAD style + LIVE SETTINGS
    this.drawAutoCADVertexDots(screenVertices, gripSettings);
  }

  // ——— 🏢 ADR-048: UNIFIED GRIP RENDERING ———
  private drawAutoCADHandles(
    screenVertices: Point2D[],
    isEditing: boolean,
    gripSettings?: GripSettings,
    entityId?: string,
    gripInteractionState?: { hovered?: { entityId: string; gripIndex: number }; active?: { entityId: string; gripIndex: number } }
  ): void {
    // Convert vertices to grip configs
    const vertexGrips: GripRenderConfig[] = screenVertices.map((vertex, i) => ({
      position: vertex,
      type: 'vertex',
      entityId: entityId || '',
      gripIndex: i,
    }));

    // Render vertex grips with UnifiedGripRenderer
    this.gripRenderer.renderGripSet(vertexGrips, gripInteractionState, gripSettings);

    // Render midpoint grips if enabled
    if (gripSettings?.multiGripEdit !== false) { // Default true
      this.gripRenderer.renderMidpoints(
        screenVertices,
        { enabled: true },
        gripSettings
      );
    }
  }

  // 🏢 ADR-048: Unified vertex dots rendering
  private drawAutoCADVertexDots(screenVertices: Point2D[], gripSettings?: GripSettings): void {
    // Convert vertices to small grip configs (for preview drawing)
    const dotGrips: GripRenderConfig[] = screenVertices.map((vertex, i) => ({
      position: vertex,
      type: 'vertex',
      sizeMultiplier: 0.5, // Smaller size for preview dots
    }));

    // Render using UnifiedGripRenderer
    this.gripRenderer.renderGripSet(dotGrips, undefined, gripSettings);
  }

  private drawLabel(region: { name?: string }, screenVertices: Point2D[], isSelected: boolean): void {
    const ctx = this.ctx;

    // Center of polygon
    const centerX = screenVertices.reduce((sum, v) => sum + v.x, 0) / screenVertices.length;
    const centerY = screenVertices.reduce((sum, v) => sum + v.y, 0) / screenVertices.length;

    ctx.save();

    // Bubble
    ctx.globalAlpha = OPACITY.HIGH; // 🏢 ADR-119: Centralized opacity
    ctx.fillStyle = isSelected ? UI_COLORS.ERROR : UI_COLORS.UPLOAD_AREA_BG;
    ctx.strokeStyle = UI_COLORS.WHITE;
    ctx.lineWidth = RENDER_LINE_WIDTHS.THIN; // 🏢 ADR-044

    const padding = TEXT_LABEL_OFFSETS.OVERLAY_LABEL_PADDING; // 🏢 ADR-139
    const text = region.name ?? '';
    ctx.font = UI_FONTS.SYSTEM.NORMAL; // 🏢 ADR-090: Centralized font
    const textWidth = ctx.measureText(text).width;

    const w = textWidth + padding * 2;
    const h = TEXT_LABEL_OFFSETS.OVERLAY_LABEL_HEIGHT; // 🏢 ADR-139

    const x = centerX - w / 2;
    const y = centerY - h / 2;

    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.fill();
    ctx.stroke();

    // Text
    ctx.globalAlpha = OPACITY.OPAQUE; // 🏢 ADR-119: Centralized opacity
    ctx.fillStyle = UI_COLORS.WHITE;
    ctx.fillText(text, centerX, centerY + 4);

    ctx.restore();
  }

  clear(): void {
    const canvas = this.ctx.canvas;
    this.ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}
