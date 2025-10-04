/**
 * CENTRALIZED GRID RENDERER - UI Rendering System
 * ✅ ΦΑΣΗ 6: Κεντρικοποιημένο grid rendering χωρίς διπλότυπα
 */

import type { Point2D, Viewport } from '../../types/Types';
import type {
  UIRenderer,
  UIRenderContext,
  UIElementSettings,
  UIRenderMetrics
} from '../core/UIRenderer';
import type {
  GridSettings,
  GridRenderData,
  GridRenderMode,
  GridStyle
} from './GridTypes';
import { COORDINATE_LAYOUT } from '../../core/CoordinateTransforms';

/**
 * 🔺 CENTRALIZED GRID RENDERER
 * Single Source of Truth για grid rendering
 * Αντικαθιστά όλα τα duplicate Grid rendering code
 */
export class GridRenderer implements UIRenderer {
  readonly type = 'grid';

  private renderCount = 0;
  private lastRenderTime = 0;

  /**
   * Main render method - Implements UIRenderer interface
   */
  render(
    context: UIRenderContext,
    viewport: Viewport,
    settings: UIElementSettings
  ): void {
    const gridSettings = settings as GridSettings;

    // Get transform data από context
    const transformData = this.getTransformData(context);
    if (!transformData) return;

    this.renderGrid(
      context.ctx,
      viewport,
      gridSettings,
      transformData,
      'normal'
    );
  }

  /**
   * 🔺 LEGACY COMPATIBILITY
   * Direct render method για backward compatibility
   */
  renderDirect(
    ctx: CanvasRenderingContext2D,
    viewport: Viewport,
    settings: GridSettings,
    transform: { scale: number; offsetX: number; offsetY: number },
    mode: GridRenderMode = 'normal'
  ): void {
    this.renderGrid(ctx, viewport, settings, transform, mode);
  }

  /**
   * 🔺 CORE GRID RENDERING
   * Unified rendering logic για όλους τους modes
   */
  private renderGrid(
    ctx: CanvasRenderingContext2D,
    viewport: Viewport,
    settings: GridSettings,
    transform: { scale: number; offsetX: number; offsetY: number },
    mode: GridRenderMode
  ): void {
    const startTime = performance.now();

    console.log('🔍 GRID RENDERER DEBUG:', {
      enabled: settings.enabled,
      visible: settings.visible,
      color: settings.color,
      size: settings.size,
      minVisibleSize: settings.minVisibleSize,
      transform: transform
    });

    if (!settings.enabled || !settings.visible) {
      console.log('❌ GRID SKIPPED:', { enabled: settings.enabled, visible: settings.visible });
      return;
    }

    // Calculate grid size in pixels
    const gridSizePixels = settings.size * transform.scale;

    console.log('📏 GRID SIZE:', { gridSizePixels, minVisibleSize: settings.minVisibleSize });

    // Skip rendering if grid is too small
    if (gridSizePixels < settings.minVisibleSize) {
      console.log('❌ GRID TOO SMALL:', { gridSizePixels, minVisibleSize: settings.minVisibleSize });
      return;
    }

    console.log('✅ GRID RENDERING STARTED');
    ctx.save();

    // Apply adaptive opacity based on zoom
    let opacity = settings.opacity;
    if (settings.adaptiveOpacity) {
      opacity = this.calculateAdaptiveOpacity(gridSizePixels, settings);
    }
    ctx.globalAlpha = opacity;

    // Render based on style
    switch (settings.style) {
      case 'lines':
        this.renderGridLines(ctx, viewport, settings, transform);
        break;
      case 'dots':
        this.renderGridDots(ctx, viewport, settings, transform);
        break;
      case 'crosses':
        this.renderGridCrosses(ctx, viewport, settings, transform);
        break;
    }


    ctx.restore();

    // Update metrics
    this.renderCount++;
    this.lastRenderTime = performance.now() - startTime;
  }

  /**
   * Render grid as lines
   */
  private renderGridLines(
    ctx: CanvasRenderingContext2D,
    viewport: Viewport,
    settings: GridSettings,
    transform: { scale: number; offsetX: number; offsetY: number }
  ): void {
    const gridSize = settings.size * transform.scale;

    // Render minor grid
    if (settings.showMinorGrid) {
      ctx.strokeStyle = settings.minorGridColor;
      ctx.lineWidth = settings.minorGridWeight; // ✅ FIX: Χρήση minorGridWeight
      this.drawGridLines(ctx, viewport, transform, gridSize);
    }

    // Render major grid
    if (settings.showMajorGrid) {
      const majorGridSize = gridSize * settings.majorInterval;
      ctx.strokeStyle = settings.majorGridColor;
      ctx.lineWidth = settings.majorGridWeight; // ✅ FIX: Χρήση majorGridWeight
      this.drawGridLines(ctx, viewport, transform, majorGridSize);
    }
  }

  /**
   * Draw grid lines (helper method)
   * ✅ FIXED: Uses simple calculation - CoordinateTransforms already handles flipped Y
   */
  private drawGridLines(
    ctx: CanvasRenderingContext2D,
    viewport: Viewport,
    transform: { scale: number; offsetX: number; offsetY: number },
    gridSize: number
  ): void {
    ctx.beginPath();

    // Vertical lines (X-axis) - ✅ CORRECT: Use world (0,0) as reference
    // Calculate screen position of world point (0,0)
    const { CoordinateTransforms: CT } = require('../../core/CoordinateTransforms');
    const worldOrigin = { x: 0, y: 0 };
    const screenOrigin = CT.worldToScreen(worldOrigin, transform, viewport);
    const originScreenX = screenOrigin.x;
    const startX = (originScreenX % gridSize);

    // 🔍 DEBUG: Log grid calculation
    console.log('🟢 GRID X-axis (using world 0,0):', {
      worldOrigin,
      screenOrigin,
      'transform.scale': transform.scale,
      gridSize,
      startX,
      'First line at': startX,
      'Second line at': startX + gridSize
    });

    // ✅ FIX: Draw ONLY inside drawing area (after margins)
    const MARGIN_LEFT = COORDINATE_LAYOUT.MARGINS.left;
    const MARGIN_TOP = COORDINATE_LAYOUT.MARGINS.top;

    // ✅ CRITICAL FIX: Start from first grid line >= MARGIN_LEFT
    let firstX = startX;
    while (firstX < MARGIN_LEFT) {
      firstX += gridSize;
    }

    for (let x = firstX; x <= viewport.width; x += gridSize) {
      ctx.moveTo(x, MARGIN_TOP);
      ctx.lineTo(x, viewport.height);
    }

    // Horizontal lines (Y-axis) - ✅ CORRECT: Use world (0,0) as reference
    // screenOrigin already calculated above from world (0,0)
    const originScreenY = screenOrigin.y;
    const startY = (originScreenY % gridSize);

    // 🔍 DEBUG: Log EXACT values for comparison with Rulers
    console.log('🟢 GRID Y-axis (using world 0,0):', {
      worldOrigin,
      screenOrigin,
      'transform.offsetY': transform.offsetY,
      gridSize,
      startY,
      'First line Y': startY,
      'Second line Y': startY + gridSize,
      'Third line Y': startY + gridSize * 2
    });

    // ✅ CRITICAL FIX: Start from first grid line >= MARGIN_TOP
    let firstY = startY;
    while (firstY < MARGIN_TOP) {
      firstY += gridSize;
    }

    for (let y = firstY; y <= viewport.height; y += gridSize) {
      ctx.moveTo(MARGIN_LEFT, y);
      ctx.lineTo(viewport.width, y);
    }

    ctx.stroke();
  }

  /**
   * Render grid as dots
   * ✅ UNIFIED WITH COORDINATETRANSFORMS: Use INVERTED offsetY
   */
  private renderGridDots(
    ctx: CanvasRenderingContext2D,
    viewport: Viewport,
    settings: GridSettings,
    transform: { scale: number; offsetX: number; offsetY: number }
  ): void {
    const gridSize = settings.size * transform.scale;
    const minorDotSize = Math.max(1, settings.minorGridWeight);
    const majorDotSize = Math.max(1, settings.majorGridWeight);

    // ✅ CORRECT: Use world (0,0) as reference
    const { CoordinateTransforms: CT } = require('../../core/CoordinateTransforms');
    const worldOrigin = { x: 0, y: 0 };
    const screenOrigin = CT.worldToScreen(worldOrigin, transform, viewport);
    const startX = (screenOrigin.x % gridSize);
    const startY = (screenOrigin.y % gridSize);

    for (let x = startX; x <= viewport.width; x += gridSize) {
      for (let y = startY; y <= viewport.height; y += gridSize) {
        // Check if this should be a major dot
        const isMajorX = ((x - startX) / gridSize) % settings.majorInterval === 0;
        const isMajorY = ((y - startY) / gridSize) % settings.majorInterval === 0;
        const isMajor = isMajorX && isMajorY;

        if ((isMajor && settings.showMajorGrid) || (!isMajor && settings.showMinorGrid)) {
          ctx.fillStyle = isMajor ? settings.majorGridColor : settings.minorGridColor;

          ctx.beginPath();
          ctx.arc(x, y, isMajor ? majorDotSize : minorDotSize, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  /**
   * Render grid as crosses
   * ✅ UNIFIED WITH COORDINATETRANSFORMS: Use INVERTED offsetY
   */
  private renderGridCrosses(
    ctx: CanvasRenderingContext2D,
    viewport: Viewport,
    settings: GridSettings,
    transform: { scale: number; offsetX: number; offsetY: number }
  ): void {
    const gridSize = settings.size * transform.scale;
    const minorCrossSize = Math.max(2, settings.minorGridWeight * 2);
    const majorCrossSize = Math.max(2, settings.majorGridWeight * 2);

    // ✅ CORRECT: Use world (0,0) as reference
    const { CoordinateTransforms: CT } = require('../../core/CoordinateTransforms');
    const worldOrigin = { x: 0, y: 0 };
    const screenOrigin = CT.worldToScreen(worldOrigin, transform, viewport);
    const startX = (screenOrigin.x % gridSize);
    const startY = (screenOrigin.y % gridSize);

    ctx.beginPath();

    for (let x = startX; x <= viewport.width; x += gridSize) {
      for (let y = startY; y <= viewport.height; y += gridSize) {
        // Check if this should be a major cross
        const isMajorX = ((x - startX) / gridSize) % settings.majorInterval === 0;
        const isMajorY = ((y - startY) / gridSize) % settings.majorInterval === 0;
        const isMajor = isMajorX && isMajorY;

        if ((isMajor && settings.showMajorGrid) || (!isMajor && settings.showMinorGrid)) {
          ctx.strokeStyle = isMajor ? settings.majorGridColor : settings.minorGridColor;
          ctx.lineWidth = isMajor ? settings.majorGridWeight : settings.minorGridWeight;

          const size = isMajor ? majorCrossSize : minorCrossSize;

          // Horizontal line
          ctx.moveTo(x - size, y);
          ctx.lineTo(x + size, y);

          // Vertical line
          ctx.moveTo(x, y - size);
          ctx.lineTo(x, y + size);
        }
      }
    }

    ctx.stroke();
  }


  /**
   * Calculate adaptive opacity based on grid size
   */
  private calculateAdaptiveOpacity(gridSizePixels: number, settings: GridSettings): number {
    const minSize = settings.minVisibleSize;
    const maxSize = minSize * 4;

    if (gridSizePixels <= minSize) {
      return 0;
    } else if (gridSizePixels >= maxSize) {
      return settings.opacity;
    } else {
      // Fade in as grid gets larger
      const factor = (gridSizePixels - minSize) / (maxSize - minSize);
      return settings.opacity * factor;
    }
  }

  /**
   * Extract transform data από UI context (if available)
   */
  private getTransformData(context: UIRenderContext): { scale: number; offsetX: number; offsetY: number } | null {
    // Enhanced: Check for transform data στο context
    const uiContextWithTransform = context as any;
    if (uiContextWithTransform.transform) {
      return uiContextWithTransform.transform;
    }

    return null;
  }

  /**
   * Get performance metrics
   */
  getMetrics(): UIRenderMetrics {
    return {
      renderTime: this.lastRenderTime,
      drawCalls: this.renderCount,
      primitiveCount: 1, // Grid rendering
      memoryUsage: 0
    };
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.renderCount = 0;
    this.lastRenderTime = 0;
  }
}