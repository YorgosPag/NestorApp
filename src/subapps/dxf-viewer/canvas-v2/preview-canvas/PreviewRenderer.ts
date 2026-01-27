/**
 * 🏢 ENTERPRISE PREVIEW RENDERER
 *
 * CAD-grade direct canvas rendering for drawing previews.
 * Pattern: Autodesk AutoCAD / Bentley MicroStation - Zero React overhead
 *
 * @module PreviewRenderer
 * @version 1.0.0 - ADR-040: Dedicated Preview Canvas
 * @since 2026-01-26
 *
 * 🎯 PURPOSE:
 * - Direct canvas rendering WITHOUT React state changes
 * - Eliminates 250ms mousemove handler time
 * - Target: <16ms render time (60fps)
 *
 * 🏆 ENTERPRISE FEATURES:
 * - Direct 2D canvas API calls (no React re-renders)
 * - Supports line, circle, rectangle, polyline previews
 * - Color/style from centralized settings
 * - High-DPI support with devicePixelRatio
 * - Path2D caching for performance
 * - Full TypeScript (ZERO any)
 */

import type { Point2D, ViewTransform, Viewport } from '../../rendering/types/Types';
import type { ExtendedSceneEntity, ExtendedLineEntity, ExtendedCircleEntity, ExtendedPolylineEntity, PreviewPoint } from '../../hooks/drawing/useUnifiedDrawing';
// 🏢 ENTERPRISE: Centralized CAD colors & coordinate transforms
import { PANEL_LAYOUT } from '../../config/panel-tokens';
import { COORDINATE_LAYOUT } from '../../rendering/core/CoordinateTransforms';

// ============================================================================
// TYPES - Enterprise TypeScript Standards (ZERO any)
// ============================================================================

export interface PreviewRenderOptions {
  /** Preview line color (default: green) */
  color?: string;
  /** Line width in pixels */
  lineWidth?: number;
  /** Opacity (0-1) */
  opacity?: number;
  /** Dash pattern for preview lines */
  dashPattern?: number[];
  /** Show grip points at vertices */
  showGrips?: boolean;
  /** Grip point size in pixels */
  gripSize?: number;
  /** Grip point color */
  gripColor?: string;
}

// 🏢 ADR-040: Viewport imported from rendering/types/Types (removed local duplicate)

// ============================================================================
// CONSTANTS - Enterprise Design Tokens
// ============================================================================

const DEFAULT_PREVIEW_OPTIONS: Required<PreviewRenderOptions> = {
  color: '#00FF00', // Green preview (AutoCAD standard)
  lineWidth: 1,
  opacity: 0.9,
  dashPattern: [],
  showGrips: true,
  gripSize: 6,
  gripColor: '#00FF00',
};

// 🏢 ENTERPRISE: Cached Path2D for grip points (performance optimization)
const GRIP_PATH_CACHE = new Map<number, Path2D>();

function getGripPath(size: number): Path2D {
  if (!GRIP_PATH_CACHE.has(size)) {
    const path = new Path2D();
    const half = size / 2;
    path.rect(-half, -half, size, size);
    GRIP_PATH_CACHE.set(size, path);
  }
  return GRIP_PATH_CACHE.get(size)!;
}

// ============================================================================
// PREVIEW RENDERER CLASS
// ============================================================================

/**
 * 🏢 ENTERPRISE: Direct Canvas Preview Renderer
 *
 * Renders drawing previews directly to canvas without React state.
 * Pattern: Autodesk/Bentley - Direct 2D canvas for maximum performance
 */
export class PreviewRenderer {
  private ctx: CanvasRenderingContext2D | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private currentPreview: ExtendedSceneEntity | null = null;
  private currentTransform: ViewTransform | null = null;
  private currentViewport: Viewport | null = null;  // 🏢 ADR-040: Required for Y-axis inversion
  private currentOptions: Required<PreviewRenderOptions> = { ...DEFAULT_PREVIEW_OPTIONS };
  private isDirty = false;
  private dpr = 1;

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  /**
   * 🏢 ENTERPRISE: Initialize with canvas element
   */
  initialize(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', {
      alpha: true, // Transparent background
      desynchronized: true, // Better performance
    });
    this.dpr = window.devicePixelRatio || 1;
  }

  /**
   * 🏢 ENTERPRISE: Update canvas size (call on resize)
   */
  updateSize(width: number, height: number): void {
    if (!this.canvas || !this.ctx) return;

    const dpr = window.devicePixelRatio || 1;
    this.dpr = dpr;

    // Set canvas buffer size
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);

    // Set canvas display size
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;

    // Scale context for DPR
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Mark dirty to redraw with new size
    this.isDirty = true;
  }

  // ============================================================================
  // PUBLIC API - Called directly from mouse handlers
  // ============================================================================

  /**
   * 🏢 ENTERPRISE: Draw preview entity
   *
   * Called directly from mouse handler - NO REACT STATE!
   * This is the key optimization: direct canvas calls bypass React entirely.
   *
   * @param entity - Preview entity to render
   * @param transform - Current view transform
   * @param viewport - Viewport dimensions (required for Y-axis inversion)
   * @param options - Render options (optional)
   */
  drawPreview(
    entity: ExtendedSceneEntity | null,
    transform: ViewTransform,
    viewport: Viewport,
    options?: PreviewRenderOptions
  ): void {
    this.currentPreview = entity;
    this.currentTransform = transform;
    this.currentViewport = viewport;  // 🏢 ADR-040: Store viewport for Y-axis inversion
    this.currentOptions = { ...DEFAULT_PREVIEW_OPTIONS, ...options };
    this.isDirty = true;
  }

  /**
   * 🏢 ENTERPRISE: Clear preview
   */
  clear(): void {
    this.currentPreview = null;
    this.isDirty = true;
  }

  /**
   * 🏢 ENTERPRISE: Check if dirty (for UnifiedFrameScheduler)
   */
  checkDirty(): boolean {
    return this.isDirty;
  }

  /**
   * 🏢 ENTERPRISE: Render frame (called by UnifiedFrameScheduler)
   *
   * Performs the actual canvas rendering on RAF callback.
   */
  render(): void {
    if (!this.ctx || !this.canvas) return;

    const ctx = this.ctx;
    const dpr = this.dpr;

    // Reset transform and clear
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Mark as clean
    this.isDirty = false;

    // Early exit if no preview or missing viewport
    if (!this.currentPreview || !this.currentTransform || !this.currentViewport) {
      return;
    }

    const entity = this.currentPreview;
    const transform = this.currentTransform;
    const opts = this.currentOptions;

    // Setup context style
    ctx.strokeStyle = opts.color;
    ctx.fillStyle = opts.gripColor;
    ctx.lineWidth = opts.lineWidth;
    ctx.globalAlpha = opts.opacity;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (opts.dashPattern.length > 0) {
      ctx.setLineDash(opts.dashPattern);
    } else {
      ctx.setLineDash([]);
    }

    // Render based on entity type
    switch (entity.type) {
      case 'line':
        this.renderLine(ctx, entity as ExtendedLineEntity, transform, opts);
        break;
      case 'circle':
        this.renderCircle(ctx, entity as ExtendedCircleEntity, transform, opts);
        break;
      case 'polyline':
        this.renderPolyline(ctx, entity as ExtendedPolylineEntity, transform, opts);
        break;
      case 'rectangle':
        this.renderRectangle(ctx, entity, transform, opts);
        break;
      case 'point':
        this.renderPoint(ctx, entity as PreviewPoint, transform, opts);
        break;
      default:
        // Unsupported entity type - silently skip
        break;
    }

    // Reset context
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);
  }

  // ============================================================================
  // PRIVATE RENDER METHODS - Entity-specific rendering
  // ============================================================================

  /**
   * 🏢 ENTERPRISE: Render line preview
   */
  private renderLine(
    ctx: CanvasRenderingContext2D,
    entity: ExtendedLineEntity,
    transform: ViewTransform,
    opts: Required<PreviewRenderOptions>
  ): void {
    const start = this.worldToScreen(entity.start, transform);
    const end = this.worldToScreen(entity.end, transform);

    // Draw line
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();

    // Draw grips
    if (opts.showGrips) {
      this.renderGrip(ctx, start, opts);
      this.renderGrip(ctx, end, opts);
    }

    // Draw distance label (if measurement mode)
    // 🚀 PERFORMANCE FIX (2026-01-27): Pass WORLD coordinates for correct distance calculation
    if (entity.measurement || entity.showEdgeDistances) {
      this.renderDistanceLabelFromWorld(ctx, entity.start, entity.end, start, end);
    }
  }

  /**
   * 🏢 ENTERPRISE: Render circle preview
   */
  private renderCircle(
    ctx: CanvasRenderingContext2D,
    entity: ExtendedCircleEntity,
    transform: ViewTransform,
    opts: Required<PreviewRenderOptions>
  ): void {
    const center = this.worldToScreen(entity.center, transform);
    const radiusScreen = entity.radius * transform.scale;

    // Draw circle
    ctx.beginPath();
    ctx.arc(center.x, center.y, radiusScreen, 0, Math.PI * 2);
    ctx.stroke();

    // Draw center grip
    if (opts.showGrips) {
      this.renderGrip(ctx, center, opts);
    }
  }

  /**
   * 🏢 ENTERPRISE: Render polyline preview
   */
  private renderPolyline(
    ctx: CanvasRenderingContext2D,
    entity: ExtendedPolylineEntity,
    transform: ViewTransform,
    opts: Required<PreviewRenderOptions>
  ): void {
    if (!entity.vertices || entity.vertices.length < 2) return;

    const screenPoints = entity.vertices.map(v => this.worldToScreen(v, transform));

    // Draw polyline
    ctx.beginPath();
    ctx.moveTo(screenPoints[0].x, screenPoints[0].y);
    for (let i = 1; i < screenPoints.length; i++) {
      ctx.lineTo(screenPoints[i].x, screenPoints[i].y);
    }
    if (entity.closed) {
      ctx.closePath();
    }
    ctx.stroke();

    // Draw grips
    if (opts.showGrips) {
      for (const pt of screenPoints) {
        this.renderGrip(ctx, pt, opts);
      }
    }

    // Draw edge distances
    // 🚀 PERFORMANCE FIX (2026-01-27): Use WORLD coordinates for correct distance calculation
    if (entity.showEdgeDistances) {
      for (let i = 1; i < screenPoints.length; i++) {
        this.renderDistanceLabelFromWorld(
          ctx,
          entity.vertices[i - 1],
          entity.vertices[i],
          screenPoints[i - 1],
          screenPoints[i]
        );
      }
    }
  }

  /**
   * 🏢 ENTERPRISE: Render rectangle preview
   */
  private renderRectangle(
    ctx: CanvasRenderingContext2D,
    entity: { corner1?: Point2D; corner2?: Point2D },
    transform: ViewTransform,
    opts: Required<PreviewRenderOptions>
  ): void {
    if (!entity.corner1 || !entity.corner2) return;

    const c1 = this.worldToScreen(entity.corner1, transform);
    const c2 = this.worldToScreen(entity.corner2, transform);

    const x = Math.min(c1.x, c2.x);
    const y = Math.min(c1.y, c2.y);
    const width = Math.abs(c2.x - c1.x);
    const height = Math.abs(c2.y - c1.y);

    // Draw rectangle
    ctx.strokeRect(x, y, width, height);

    // Draw corner grips
    if (opts.showGrips) {
      this.renderGrip(ctx, { x, y }, opts);
      this.renderGrip(ctx, { x: x + width, y }, opts);
      this.renderGrip(ctx, { x, y: y + height }, opts);
      this.renderGrip(ctx, { x: x + width, y: y + height }, opts);
    }
  }

  /**
   * 🏢 ENTERPRISE: Render point preview (start point indicator)
   */
  private renderPoint(
    ctx: CanvasRenderingContext2D,
    entity: PreviewPoint,
    transform: ViewTransform,
    opts: Required<PreviewRenderOptions>
  ): void {
    const pos = this.worldToScreen(entity.position, transform);
    this.renderGrip(ctx, pos, opts);
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * 🏢 ENTERPRISE: Render grip point (square)
   */
  private renderGrip(
    ctx: CanvasRenderingContext2D,
    screenPos: Point2D,
    opts: Required<PreviewRenderOptions>
  ): void {
    const path = getGripPath(opts.gripSize);

    ctx.save();
    ctx.translate(screenPos.x, screenPos.y);

    // Fill with grip color
    ctx.fillStyle = opts.gripColor;
    ctx.fill(path);

    // Stroke with darker border
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.stroke(path);

    ctx.restore();
  }

  /**
   * 🏢 ENTERPRISE: Render distance label using WORLD coordinates
   * 🚀 PERFORMANCE FIX (2026-01-27): Uses world coordinates for correct distance calculation
   *
   * @param worldP1 - First point in WORLD coordinates (for distance calculation)
   * @param worldP2 - Second point in WORLD coordinates (for distance calculation)
   * @param screenP1 - First point in SCREEN coordinates (for label positioning)
   * @param screenP2 - Second point in SCREEN coordinates (for label positioning)
   */
  private renderDistanceLabelFromWorld(
    ctx: CanvasRenderingContext2D,
    worldP1: Point2D,
    worldP2: Point2D,
    screenP1: Point2D,
    screenP2: Point2D
  ): void {
    // 🎯 FIX: Calculate distance from WORLD coordinates (not screen)
    const worldDist = Math.sqrt(
      Math.pow(worldP2.x - worldP1.x, 2) +
      Math.pow(worldP2.y - worldP1.y, 2)
    );

    // Format distance
    const distText = worldDist.toFixed(2);

    // Calculate midpoint for label (use screen coordinates for positioning)
    const midX = (screenP1.x + screenP2.x) / 2;
    const midY = (screenP1.y + screenP2.y) / 2;

    // Draw label background
    ctx.save();
    ctx.font = '11px Inter, system-ui, sans-serif';
    const textMetrics = ctx.measureText(distText);
    const padding = 4;
    const bgWidth = textMetrics.width + padding * 2;
    const bgHeight = 16;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(
      midX - bgWidth / 2,
      midY - bgHeight / 2 - 10, // Offset above the line
      bgWidth,
      bgHeight
    );

    // Draw text
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(distText, midX, midY - 10);
    ctx.restore();
  }

  /**
   * 🏢 ENTERPRISE: Transform world coordinates to screen coordinates
   *
   * 🎯 CRITICAL: Uses same formula as CoordinateTransforms.worldToScreen()
   * to ensure consistent rendering between preview and main canvas.
   *
   * Formula:
   *   screenX = left + worldX * scale + offsetX
   *   screenY = (height - top) - worldY * scale - offsetY
   *
   * Note: offsetY is SUBTRACTED because positive offset moves drawing UP (decreases screenY)
   */
  private worldToScreen(worldPoint: Point2D, transform: ViewTransform): Point2D {
    // 🏢 ADR-040: Must have viewport for Y-axis inversion
    if (!this.currentViewport) {
      // Fallback to simple transform (will be mirrored - but shouldn't happen)
      return {
        x: worldPoint.x * transform.scale + transform.offsetX,
        y: worldPoint.y * transform.scale + transform.offsetY,
      };
    }

    const { left, top } = COORDINATE_LAYOUT.MARGINS;
    const { height } = this.currentViewport;

    // 🎯 ENTERPRISE: Same formula as CoordinateTransforms.worldToScreen()
    // This ensures preview renders at exact same position as completed entities
    return {
      x: left + worldPoint.x * transform.scale + transform.offsetX,
      y: (height - top) - worldPoint.y * transform.scale - transform.offsetY
    };
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  /**
   * 🏢 ENTERPRISE: Dispose renderer
   */
  dispose(): void {
    this.clear();
    this.ctx = null;
    this.canvas = null;
  }
}

/**
 * 🏢 ENTERPRISE COMPLIANCE CHECKLIST:
 *
 * ✅ Direct canvas API (ZERO React re-renders)
 * ✅ Full TypeScript (ZERO any)
 * ✅ High-DPI support with devicePixelRatio
 * ✅ Path2D caching for grip points
 * ✅ Dirty flag for UnifiedFrameScheduler integration
 * ✅ Supports all drawing tools (line, circle, rectangle, polyline, point)
 * ✅ Distance labels for measurement mode
 * ✅ Grip point rendering
 * ✅ Proper cleanup with dispose()
 * ✅ Industry-standard patterns (Autodesk/Bentley)
 */
