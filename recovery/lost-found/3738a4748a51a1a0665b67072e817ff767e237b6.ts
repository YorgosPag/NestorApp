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
 * - Supports line, circle, rectangle, polyline, angle-measurement previews
 * - Color/style from centralized settings
 * - High-DPI support with devicePixelRatio
 * - Path2D caching for performance
 * - Full TypeScript (ZERO any)
 */

import type { Point2D, ViewTransform, Viewport } from '../../rendering/types/Types';
import type { ExtendedSceneEntity, ExtendedLineEntity, ExtendedCircleEntity, ExtendedPolylineEntity, PreviewPoint } from '../../hooks/drawing/useUnifiedDrawing';
// 🏢 ADR-094: Centralized Device Pixel Ratio
// 🏢 ADR-117: DPI-Aware Pixel Calculations Centralization
import { getDevicePixelRatio, toDevicePixels } from '../../systems/cursor/utils';

// 🏢 ENTERPRISE (2026-01-31): Arc preview entity type - ADR-059
// Extended to support construction lines (rubber band) during arc drawing
interface ArcPreviewEntity {
  type: 'arc';
  id: string;
  center: Point2D;
  radius: number;
  startAngle: number;  // in degrees
  endAngle: number;    // in degrees
  visible?: boolean;
  layer?: string;
  preview?: boolean;
  showPreviewGrips?: boolean;
  // 🏢 ENTERPRISE: Construction vertices for rubber band lines
  constructionVertices?: Point2D[];
  showConstructionLines?: boolean;
  showEdgeDistances?: boolean;
  // 🏢 ENTERPRISE: Arc direction flag for Canvas 2D rendering
  // true = draw counterclockwise, false = draw clockwise
  counterclockwise?: boolean;
  // 🏢 ENTERPRISE: Construction line drawing mode
  // 'polyline': Connect points in sequence (arc-3p: start → mid → end)
  // 'radial': Draw radii from center (arc-cse/arc-sce: center → start, center → end)
  constructionLineMode?: 'polyline' | 'radial';
}

interface AngleMeasurementEntity {
  type: 'angle-measurement';
  vertex: Point2D;
  point1: Point2D;
  point2: Point2D;
  angle: number;
}
// 🏢 ENTERPRISE: Centralized CAD colors & coordinate transforms
import { PANEL_LAYOUT } from '../../config/panel-tokens';
// 🏢 ADR-040: Centralized coordinate transforms - worldToScreen() Single Source of Truth
import { CoordinateTransforms, COORDINATE_LAYOUT } from '../../rendering/core/CoordinateTransforms';
// 🏢 ADR-041: Centralized Distance Label Rendering
import { renderDistanceLabel, PREVIEW_LABEL_DEFAULTS } from '../../rendering/entities/shared/distance-label-utils';
// 🏢 ADR-044: Centralized Line Widths
// 🏢 ADR-090: Centralized UI Fonts
// 🏢 ADR-097: Centralized Line Dash Patterns
// 🏢 ADR-140: Added RENDER_GEOMETRY for angle measurement visualization constants
import { RENDER_LINE_WIDTHS, UI_FONTS, LINE_DASH_PATTERNS, RENDER_GEOMETRY } from '../../config/text-rendering-config';
// 🏢 ADR-066: Centralized Angle Calculation
// 🏢 ADR-080: Centralized Rectangle Bounds
import { calculateAngle, rectFromTwoPoints } from '../../rendering/entities/shared/geometry-rendering-utils';
// 🏢 ADR-073: Centralized Bisector Angle
// 🏢 ADR-077: Centralized TAU Constant
// 🏢 ADR-067: Centralized Radians/Degrees Conversion
// 🏢 ADR-100: Centralized Degrees-to-Radians Conversion
import { bisectorAngle, TAU, degToRad } from '../../rendering/entities/shared/geometry-utils';
// 🏢 ADR-119: Centralized Opacity Constants
// 🏢 ADR-123: Centralized Preview Colors
import { UI_COLORS, OPACITY } from '../../config/color-config';
// 🏢 ADR-163: Canvas Layer Synchronization - Immediate render for synchronized preview
// 🔧 FIX (2026-02-01): REMOVED markAllCanvasDirty calls - they caused preview to disappear!
// Root cause: markAllCanvasDirty() schedules ALL canvases for next RAF frame. When scheduler runs,
// preview's isDirty()=false (already rendered immediately) → scheduler skips it → preview disappears!
// Solution: Preview canvas is independent - doesn't need to sync with other canvases.
// The DXF/Layer canvases don't change during preview updates, so no sync needed.
// import { markAllCanvasDirty } from '../../rendering/core/UnifiedFrameScheduler';

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
  color: UI_COLORS.BRIGHT_GREEN, // 🏢 ADR-123: Green preview (AutoCAD standard)
  lineWidth: 1,
  opacity: OPACITY.HIGH,  // 🏢 ADR-134: Centralized opacity (0.9)
  dashPattern: [],
  showGrips: true,
  gripSize: 6,
  gripColor: UI_COLORS.BRIGHT_GREEN, // 🏢 ADR-123: Centralized grip color
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

  // 🔍 DEBUG (2026-02-02): FPS counter for preview rendering investigation
  private debugFpsCounter = 0;
  private debugFpsLastTime = 0;
  private debugFpsEnabled = false; // 🔧 DISABLED (2026-02-02): z-index fix confirmed working (12-17 FPS vs 3-5 FPS before)

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
    this.dpr = getDevicePixelRatio(); // 🏢 ADR-094
  }

  /**
   * 🏢 ENTERPRISE: Update canvas size (call on resize)
   */
  updateSize(width: number, height: number): void {
    if (!this.canvas || !this.ctx) return;

    const dpr = getDevicePixelRatio(); // 🏢 ADR-094
    this.dpr = dpr;

    // Set canvas buffer size
    // 🏢 ADR-117: Use centralized toDevicePixels for DPI-aware calculations
    this.canvas.width = toDevicePixels(width, dpr);
    this.canvas.height = toDevicePixels(height, dpr);

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
   * 🚀 PERFORMANCE FIX (2026-02-01): IMMEDIATE RENDER
   * Pattern: Same as CrosshairOverlay - render synchronously on mouse move
   * This fixes the "preview disappears during mouse movement" bug caused by
   * the delay between mouse event and RAF frame.
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
    // 🔍 DEBUG (2026-02-02): FPS counter - logs once per second
    // Using console.error to FORCE bypass suppress-console.js filtering
    if (this.debugFpsEnabled) {
      const now = performance.now();
      this.debugFpsCounter++;
      if (now - this.debugFpsLastTime >= 1000) {
        console.error(`📊 [PREVIEW FPS] ${this.debugFpsCounter} calls/sec | entity: ${entity?.type || 'null'}`);
        this.debugFpsCounter = 0;
        this.debugFpsLastTime = now;
      }
    }

    this.currentPreview = entity;
    this.currentTransform = transform;
    this.currentViewport = viewport;  // 🏢 ADR-040: Store viewport for Y-axis inversion
    this.currentOptions = { ...DEFAULT_PREVIEW_OPTIONS, ...options };

    // 🚀 IMMEDIATE RENDER: Render preview synchronously (no RAF wait!)
    // This matches the CrosshairOverlay pattern for zero-latency visual feedback
    this.render();

    // 🔧 FIX (2026-02-01): REMOVED markAllCanvasDirty() - it caused preview to disappear!
    // Preview canvas is independent - renders immediately, doesn't need RAF sync with other canvases.
  }

  /**
   * 🏢 ENTERPRISE: Clear preview IMMEDIATELY
   * Pattern: Autodesk AutoCAD - Immediate visual feedback on command completion
   *
   * CRITICAL: Must clear canvas IMMEDIATELY, not wait for frame scheduler!
   * This prevents the "two distance labels" bug where preview stays visible
   * for one frame after drawing completion.
   */
  clear(): void {
    this.currentPreview = null;
    this.isDirty = false; // Already clean after immediate clear

    // 🔧 FIX (2026-01-27): IMMEDIATE clearRect - don't wait for scheduler
    if (this.ctx && this.canvas) {
      const dpr = getDevicePixelRatio(); // 🏢 ADR-094
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    // 🔧 FIX (2026-02-01): REMOVED markAllCanvasDirty() - preview canvas is independent.
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
    if (!this.ctx || !this.canvas) {
      return;
    }

    const ctx = this.ctx;
    const dpr = this.dpr;

    // 🏢 ADR-163: Early exit BEFORE clear if no valid content to render
    // This prevents the "entities disappear" bug where we clear but don't redraw
    // because viewport is invalid (0x0)
    if (!this.currentPreview || !this.currentTransform || !this.currentViewport) {
      this.isDirty = false;
      return;
    }

    // 🏢 ADR-163: Additional check - skip if viewport is invalid (0x0)
    // This can happen during component mount/unmount transitions
    if (this.currentViewport.width <= 0 || this.currentViewport.height <= 0) {
      this.isDirty = false;
      return;
    }

    // Reset transform and clear
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Mark as clean
    this.isDirty = false;

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
      case 'angle-measurement':
        this.renderAngleMeasurement(ctx, entity as AngleMeasurementEntity, transform, opts);
        break;
      case 'point':
        this.renderPoint(ctx, entity as PreviewPoint, transform, opts);
        break;
      case 'arc':
        // 🏢 ENTERPRISE (2026-01-31): Arc preview support - ADR-059
        this.renderArc(ctx, entity as ArcPreviewEntity, transform, opts);
        break;
      default:
        // Unsupported entity type - silently skip
        break;
    }

    // Reset context
    ctx.globalAlpha = OPACITY.OPAQUE; // 🏢 ADR-119: Centralized opacity
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
    // 🏢 ADR-040: Use centralized CoordinateTransforms.worldToScreen()
    const start = CoordinateTransforms.worldToScreen(entity.start, transform, this.currentViewport!);
    const end = CoordinateTransforms.worldToScreen(entity.end, transform, this.currentViewport!);

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
    // 🏢 ADR-040: Use centralized CoordinateTransforms.worldToScreen()
    const center = CoordinateTransforms.worldToScreen(entity.center, transform, this.currentViewport!);
    const radiusScreen = entity.radius * transform.scale;

    // Draw circle
    // 🔧 FIX (2026-01-31): Use ellipse() instead of arc() - arc() has rendering bug!
    ctx.beginPath();
    ctx.ellipse(center.x, center.y, radiusScreen, radiusScreen, 0, 0, TAU);
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

    // 🏢 ADR-040: Use centralized CoordinateTransforms.worldToScreen()
    const screenPoints = entity.vertices.map(v => CoordinateTransforms.worldToScreen(v, transform, this.currentViewport!));

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

    // 🏢 ADR-040: Use centralized CoordinateTransforms.worldToScreen()
    const c1 = CoordinateTransforms.worldToScreen(entity.corner1, transform, this.currentViewport!);
    const c2 = CoordinateTransforms.worldToScreen(entity.corner2, transform, this.currentViewport!);

    // 🏢 ADR-080: Centralized Rectangle Bounds
    const { x, y, width, height } = rectFromTwoPoints(c1, c2);

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
   * 🏢 ENTERPRISE (2026-01-27): Render angle measurement preview
   */
  private renderAngleMeasurement(
    ctx: CanvasRenderingContext2D,
    entity: { vertex: Point2D; point1: Point2D; point2: Point2D; angle: number },
    transform: ViewTransform,
    opts: Required<PreviewRenderOptions>
  ): void {
    // 🏢 ADR-040: Use centralized CoordinateTransforms.worldToScreen()
    const screenVertex = CoordinateTransforms.worldToScreen(entity.vertex, transform, this.currentViewport!);
    const screenPoint1 = CoordinateTransforms.worldToScreen(entity.point1, transform, this.currentViewport!);
    const screenPoint2 = CoordinateTransforms.worldToScreen(entity.point2, transform, this.currentViewport!);

    // Draw two lines (vertex → point1, vertex → point2)
    ctx.beginPath();
    ctx.moveTo(screenVertex.x, screenVertex.y);
    ctx.lineTo(screenPoint1.x, screenPoint1.y);
    ctx.moveTo(screenVertex.x, screenVertex.y);
    ctx.lineTo(screenPoint2.x, screenPoint2.y);
    ctx.stroke();

    // Draw arc for angle visualization (screen space)
    // 🏢 ADR-140: Use centralized angle measurement constants
    const arcRadius = RENDER_GEOMETRY.ANGLE_ARC_RADIUS;
    // 🏢 ADR-066: Use centralized angle calculation
    const angle1 = calculateAngle(entity.vertex, entity.point1);
    const angle2 = calculateAngle(entity.vertex, entity.point2);

    ctx.save();
    ctx.strokeStyle = UI_COLORS.PREVIEW_ARC_ORANGE; // 🏢 ADR-123: Orange for arc (CAD standard)
    ctx.setLineDash([...LINE_DASH_PATTERNS.DASHED]); // 🏢 ADR-097: Centralized dashed pattern
    // 🔧 FIX (2026-01-31): Use ellipse() instead of arc() - arc() has rendering bug!
    ctx.beginPath();
    ctx.ellipse(screenVertex.x, screenVertex.y, arcRadius, arcRadius, 0, angle1, angle2, false);
    ctx.stroke();
    ctx.restore();

    // Draw grips at 3 points
    if (opts.showGrips) {
      this.renderGrip(ctx, screenVertex, opts);
      this.renderGrip(ctx, screenPoint1, opts);
      this.renderGrip(ctx, screenPoint2, opts);
    }

    // Draw distance labels for both lines
    if (entity.vertex && entity.point1) {
      this.renderDistanceLabelFromWorld(ctx, entity.vertex, entity.point1, screenVertex, screenPoint1);
    }
    if (entity.vertex && entity.point2) {
      this.renderDistanceLabelFromWorld(ctx, entity.vertex, entity.point2, screenVertex, screenPoint2);
    }

    // 🏢 ADR-073: Use centralized bisector angle calculation
    const bisectorAngleValue = bisectorAngle(angle1, angle2);
    // 🏢 ADR-140: Use centralized angle measurement constants
    const textDistance = RENDER_GEOMETRY.ANGLE_TEXT_DISTANCE;
    const textX = screenVertex.x + Math.cos(bisectorAngleValue) * textDistance;
    const textY = screenVertex.y + Math.sin(bisectorAngleValue) * textDistance;

    ctx.save();
    ctx.fillStyle = UI_COLORS.DIMENSION_TEXT; // 🏢 ADR-123: Fuchsia for angle text (measurement standard)
    ctx.font = UI_FONTS.ARIAL.LARGE; // 🏢 ADR-090: Centralized font
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${entity.angle.toFixed(1)}°`, textX, textY);
    ctx.restore();
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
    // 🏢 ADR-040: Use centralized CoordinateTransforms.worldToScreen()
    const pos = CoordinateTransforms.worldToScreen(entity.position, transform, this.currentViewport!);
    this.renderGrip(ctx, pos, opts);
  }

  /**
   * 🏢 ENTERPRISE (2026-01-31): Render arc preview - ADR-059
   * Renders both construction lines (rubber band) AND the arc shape
   */
  private renderArc(
    ctx: CanvasRenderingContext2D,
    entity: ArcPreviewEntity,
    transform: ViewTransform,
    opts: Required<PreviewRenderOptions>
  ): void {
    // 🏢 ADR-040: Use centralized CoordinateTransforms.worldToScreen()
    const center = CoordinateTransforms.worldToScreen(entity.center, transform, this.currentViewport!);
    const radiusScreen = entity.radius * transform.scale;

    // 🏢 ADR-100: Centralized degrees-to-radians conversion
    const startRad = degToRad(entity.startAngle);
    const endRad = degToRad(entity.endAngle);

    // 🏢 ENTERPRISE: Draw construction lines (rubber band) FIRST
    // This shows the clicked points connected with lines
    if (entity.showConstructionLines && entity.constructionVertices && entity.constructionVertices.length >= 2) {
      ctx.save();
      // Use dashed line style for construction lines
      ctx.setLineDash([...LINE_DASH_PATTERNS.CONSTRUCTION]); // 🏢 ADR-083
      ctx.strokeStyle = PANEL_LAYOUT.CAD_COLORS.CONSTRUCTION_LINE || opts.color;
      ctx.lineWidth = RENDER_LINE_WIDTHS.PREVIEW_CONSTRUCTION || 1;
      ctx.globalAlpha = OPACITY.MEDIUM; // 🏢 ADR-119: Centralized opacity

      // 🏢 ADR-040: Use centralized CoordinateTransforms.worldToScreen()
      const screenVertices = entity.constructionVertices.map(v => CoordinateTransforms.worldToScreen(v, transform, this.currentViewport!));
      const mode = entity.constructionLineMode || 'polyline';

      if (mode === 'radial') {
        // 🏢 ENTERPRISE: Radial mode for arc-cse/arc-sce
        // Draw radii from center to start and end points ON THE CIRCUMFERENCE
        // Use entity.center, startAngle, endAngle, radius for accurate positioning
        const centerScreen = center; // Already calculated above

        // 🏢 ADR-100: Centralized degrees-to-radians conversion
        const startAngleRad = degToRad(entity.startAngle);
        const endAngleRad = degToRad(entity.endAngle);

        const startPointWorld: Point2D = {
          x: entity.center.x + Math.cos(startAngleRad) * entity.radius,
          y: entity.center.y + Math.sin(startAngleRad) * entity.radius
        };
        const endPointWorld: Point2D = {
          x: entity.center.x + Math.cos(endAngleRad) * entity.radius,
          y: entity.center.y + Math.sin(endAngleRad) * entity.radius
        };

        // 🏢 ADR-040: Use centralized CoordinateTransforms.worldToScreen()
        const startPointScreen = CoordinateTransforms.worldToScreen(startPointWorld, transform, this.currentViewport!);
        const endPointScreen = CoordinateTransforms.worldToScreen(endPointWorld, transform, this.currentViewport!);

        // Draw radius to start point
        ctx.beginPath();
        ctx.moveTo(centerScreen.x, centerScreen.y);
        ctx.lineTo(startPointScreen.x, startPointScreen.y);
        ctx.stroke();

        // Draw radius to end point
        ctx.beginPath();
        ctx.moveTo(centerScreen.x, centerScreen.y);
        ctx.lineTo(endPointScreen.x, endPointScreen.y);
        ctx.stroke();

        // Draw grips at center, start, and end
        if (opts.showGrips) {
          this.renderGrip(ctx, centerScreen, opts);
          this.renderGrip(ctx, startPointScreen, opts);
          this.renderGrip(ctx, endPointScreen, opts);
        }

        // Draw radius label (only one - they're the same length)
        if (entity.showEdgeDistances) {
          this.renderDistanceLabelFromWorld(
            ctx,
            entity.center,
            startPointWorld,
            centerScreen,
            startPointScreen
          );
        }
      } else {
        // 🏢 ENTERPRISE: Polyline mode for arc-3p
        // constructionVertices = [start, mid, end] - all on circumference
        ctx.beginPath();
        ctx.moveTo(screenVertices[0].x, screenVertices[0].y);
        for (let i = 1; i < screenVertices.length; i++) {
          ctx.lineTo(screenVertices[i].x, screenVertices[i].y);
        }
        ctx.stroke();

        // Draw grips at construction vertices
        if (opts.showGrips) {
          for (const screenVertex of screenVertices) {
            this.renderGrip(ctx, screenVertex, opts);
          }
        }

        // Draw distance labels on construction lines
        if (entity.showEdgeDistances) {
          for (let i = 0; i < entity.constructionVertices.length - 1; i++) {
            const worldStart = entity.constructionVertices[i];
            const worldEnd = entity.constructionVertices[i + 1];
            const screenStart = screenVertices[i];
            const screenEnd = screenVertices[i + 1];
            this.renderDistanceLabelFromWorld(ctx, worldStart, worldEnd, screenStart, screenEnd);
          }
        }
      }

      ctx.restore();
    }

    // 🏢 ENTERPRISE: Draw arc shape (solid line)
    // Use counterclockwise flag to determine arc sweep direction
    // This ensures the arc passes through all 3 points correctly
    //
    // 🎯 CRITICAL: Y-axis inversion fix!
    // World coords: Y+ is UP, angles are counterclockwise from East
    // Screen coords: Y+ is DOWN, angles are clockwise from East
    // Solution: Negate angles and flip direction to compensate for Y-inversion
    const screenStartRad = -startRad;
    const screenEndRad = -endRad;
    const screenCounterclockwise = !(entity.counterclockwise ?? false);

    ctx.beginPath();
    ctx.ellipse(center.x, center.y, radiusScreen, radiusScreen, 0, screenStartRad, screenEndRad, screenCounterclockwise);
    ctx.stroke();

    // Draw center grip for the arc
    if (opts.showGrips) {
      this.renderGrip(ctx, center, opts);
    }
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
    ctx.strokeStyle = UI_COLORS.BLACK; // 🏢 ADR-123: Centralized grip border color
    ctx.lineWidth = RENDER_LINE_WIDTHS.GRIP_OUTLINE; // 🏢 ADR-044
    ctx.stroke(path);

    ctx.restore();
  }

  /**
   * 🏢 ADR-041: Render distance label using CENTRALIZED utility
   *
   * Uses shared distance-label-utils for consistent rendering across
   * PreviewCanvas and main canvas. Single source of truth!
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
    // 🏢 ADR-041: Use centralized distance label rendering
    renderDistanceLabel(ctx, worldP1, worldP2, screenP1, screenP2, PREVIEW_LABEL_DEFAULTS);
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
