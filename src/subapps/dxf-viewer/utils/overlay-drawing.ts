import type { Point2D } from '../rendering/types/Types';
import type { Region, RegionStatus } from '../types/overlay';
import type { ViewTransform } from '../rendering/types/Types';
import type { GripSettings } from '../types/gripSettings';
import { getStatusColors } from '../config/color-mapping'; // 🔺 Κεντρική function για ελληνικά/αγγλικά mapping
import { CAD_UI_COLORS, UI_COLORS } from '../config/color-config';
// 🏢 ADR-044: Centralized Line Widths
import { RENDER_LINE_WIDTHS } from '../config/text-rendering-config';
import { drawVerticesPath } from '../rendering/entities/shared/geometry-rendering-utils';

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

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
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
    const screenVertices = region.vertices.map(v => ({
      x: v.x * transform.scale + transform.offsetX,
      y: v.y * transform.scale + transform.offsetY
    }));

    // Draw region fill using ToolStyle if available
    ctx.save();
    
    // 🐛 DEBUG: Ελέγχουμε τι παίρνουμε στον renderer

    // 🔺 ΚΕΝΤΡΙΚΗ ΛΟΓΙΚΗ: Χρήση getStatusColors() για ελληνικά/αγγλικά mapping
    const statusColors = getStatusColors(region.status);
    const fillColor = region.style?.fill || statusColors?.fill || UI_COLORS.BUTTON_PRIMARY;
    const fillOpacity = region.style?.opacity ?? region.opacity ?? 0.3;

    // 🐛 FIX: Επαναφορά globalCompositeOperation για να μη "μαυρίζει" από blend
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = fillOpacity;
    ctx.fillStyle = fillColor;

    drawVerticesPath(ctx, screenVertices, true);
    ctx.fill();

    // Draw border with DXF-style hover effects using ToolStyle if available
    ctx.globalAlpha = 1;
    
    // Check if region is hovered (has grip interaction)
    const isHovered = options.gripInteractionState?.hovered?.entityId === region.id;
    // 🔺 ΚΕΝΤΡΙΚΗ ΛΟΓΙΚΗ: Χρήση ίδιων statusColors για consistency
    const strokeColor = region.style?.stroke || statusColors?.stroke || UI_COLORS.BUTTON_SECONDARY;
    const lineWidth = region.style?.lineWidth || 2;

    if (isHovered) {
      // DXF HOVER STYLE: white, thick, dashed
      ctx.strokeStyle = UI_COLORS.WHITE;
      ctx.lineWidth = Math.max(3, lineWidth);
      ctx.setLineDash([12, 6]);

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
      ctx.setLineDash([4, 4]);
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
    const screenVertices = vertices.map(v => ({
      x: v.x * transform.scale + transform.offsetX,
      y: v.y * transform.scale + transform.offsetY
    }));

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

  // ——— ENHANCED AutoCAD-STYLE HANDLES με LIVE GRIP SETTINGS ———
  private drawAutoCADHandles(
    screenVertices: Point2D[],
    isEditing: boolean,
    gripSettings?: GripSettings,
    entityId?: string,
    gripInteractionState?: { hovered?: { entityId: string; gripIndex: number }; active?: { entityId: string; gripIndex: number } }
  ): void {
    const ctx = this.ctx;
    
    // === USE LIVE GRIP SETTINGS ΑΝ ΔΙΑΘΕΣΙΜΑ ===
    const size = gripSettings ? 
      Math.round(gripSettings.gripSize * gripSettings.dpiScale) : 
      CAD_UI_COLORS.grips.size_px; // Fallback
      
    const colorUnselected = gripSettings?.colors.cold || CAD_UI_COLORS.grips.color_unselected;
    const colorHot = gripSettings?.colors.hot || CAD_UI_COLORS.grips.color_hot;
    const colorSelected = gripSettings?.colors.warm || CAD_UI_COLORS.grips.color_selected;
    const outlineColor = gripSettings?.colors.contour || CAD_UI_COLORS.grips.outline_color;
    const outlineWidth = CAD_UI_COLORS.grips.outline_width;

    ctx.save();
    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = outlineWidth;

    // Vertex handles - ΤΕΤΡΑΓΩΝΑ όπως στο AutoCAD με hover effects
    for (let i = 0; i < screenVertices.length; i++) {
      const vertex = screenVertices[i];
      
      // Check if this grip is hovered or active
      const isHovered = gripInteractionState?.hovered?.entityId === entityId && gripInteractionState?.hovered?.gripIndex === i;
      const isActive = gripInteractionState?.active?.entityId === entityId && gripInteractionState?.active?.gripIndex === i;
      
      // Choose color based on state
      if (isActive) {
        ctx.fillStyle = colorSelected; // Hot orange for active grip
      } else if (isHovered) {
        ctx.fillStyle = colorHot; // Orange for hovered grip
      } else {
        ctx.fillStyle = colorUnselected; // Cold blue/green for normal grip
      }
      
      ctx.beginPath();
      ctx.rect(vertex.x - size / 2, vertex.y - size / 2, size, size);
      ctx.fill();
      ctx.stroke();
      
      if (isHovered || isActive) {

      }
    }

    // Edge handles (midpoints) - μικρότερα τετράγωνα με hover effects
    if (gripSettings?.multiGripEdit !== false) { // Default true
      const midSize = Math.max(3, size - 2);
      const numVertices = screenVertices.length;
      
      for (let i = 0; i < screenVertices.length; i++) {
        const current = screenVertices[i];
        const next = screenVertices[(i + 1) % screenVertices.length];
        const midX = (current.x + next.x) / 2;
        const midY = (current.y + next.y) / 2;
        
        // Check if this midpoint grip is hovered or active
        const midpointGripIndex = numVertices + i;
        const isHovered = gripInteractionState?.hovered?.entityId === entityId && gripInteractionState?.hovered?.gripIndex === midpointGripIndex;
        const isActive = gripInteractionState?.active?.entityId === entityId && gripInteractionState?.active?.gripIndex === midpointGripIndex;
        
        // Choose color based on state
        if (isActive) {
          ctx.fillStyle = colorSelected; // Hot orange for active grip
        } else if (isHovered) {
          ctx.fillStyle = colorHot; // Orange for hovered grip
        } else {
          ctx.fillStyle = colorUnselected; // Cold blue/green for normal grip
        }

        ctx.beginPath();
        ctx.rect(midX - midSize / 2, midY - midSize / 2, midSize, midSize);
        ctx.fill();
        ctx.stroke();
        
        if (isHovered || isActive) {

        }
      }
    }

    ctx.restore();
  }

  private drawAutoCADVertexDots(screenVertices: Point2D[], gripSettings?: GripSettings): void {
    const ctx = this.ctx;
    
    // === USE LIVE GRIP SETTINGS ===
    const baseSize = gripSettings ? 
      Math.round(gripSettings.gripSize * gripSettings.dpiScale) : 
      CAD_UI_COLORS.grips.size_px;
    const dotSize = Math.max(2, baseSize - 3);
    const color = gripSettings?.colors.contour || CAD_UI_COLORS.grips.outline_color;
    
    ctx.save();
    ctx.fillStyle = color;
    
    for (const v of screenVertices) {
      ctx.beginPath();
      ctx.rect(v.x - dotSize / 2, v.y - dotSize / 2, dotSize, dotSize);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawLabel(region: { name?: string }, screenVertices: Point2D[], isSelected: boolean): void {
    const ctx = this.ctx;

    // Center of polygon
    const centerX = screenVertices.reduce((sum, v) => sum + v.x, 0) / screenVertices.length;
    const centerY = screenVertices.reduce((sum, v) => sum + v.y, 0) / screenVertices.length;

    ctx.save();

    // Bubble
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = isSelected ? UI_COLORS.ERROR : UI_COLORS.UPLOAD_AREA_BG;
    ctx.strokeStyle = UI_COLORS.WHITE;
    ctx.lineWidth = RENDER_LINE_WIDTHS.THIN; // 🏢 ADR-044

    const padding = 6;
    const text = region.name ?? '';
    ctx.font = '12px system-ui';
    const textWidth = ctx.measureText(text).width;

    const w = textWidth + padding * 2;
    const h = 18;

    const x = centerX - w / 2;
    const y = centerY - h / 2;

    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.fill();
    ctx.stroke();

    // Text
    ctx.globalAlpha = 1;
    ctx.fillStyle = UI_COLORS.WHITE;
    ctx.fillText(text, centerX, centerY + 4);

    ctx.restore();
  }

  clear(): void {
    const canvas = this.ctx.canvas;
    this.ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}
