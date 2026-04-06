/**
 * Enterprise Preview Renderer — Direct canvas rendering for drawing previews.
 * Pattern: Autodesk AutoCAD / Bentley MicroStation — Zero React overhead.
 * ADR-065 SRP split: 958 lines -> 3 files (types, entity-renderers, main)
 */

import type { Point2D, ViewTransform, Viewport } from '../../rendering/types/Types';
import type { ExtendedSceneEntity, ExtendedLineEntity, ExtendedCircleEntity, ExtendedPolylineEntity, PreviewPoint } from '../../hooks/drawing/useUnifiedDrawing';
import type { AngleMeasurementEntity } from '../../types/scene';
import { getDevicePixelRatio, toDevicePixels } from '../../systems/cursor/utils';
import { renderDistanceLabel, PREVIEW_LABEL_DEFAULTS } from '../../rendering/entities/shared/distance-label-utils';
import { getTextPreviewStyleWithOverride } from '../../hooks/useTextPreviewStyle';
import { RENDER_LINE_WIDTHS } from '../../config/text-rendering-config';
import { UI_COLORS, OPACITY } from '../../config/color-config';

// Re-export types for consumers
export type { PreviewRenderOptions } from './preview-renderer-types';
import type { PreviewRenderOptions, ArcPreviewEntity, PreviewRenderHelpers } from './preview-renderer-types';
import { DEFAULT_PREVIEW_OPTIONS, getGripPath } from './preview-renderer-types';
import {
  renderLine, renderCircle, renderPolyline, renderRectangle,
  renderAngleMeasurement, renderPoint, renderArc,
} from './preview-entity-renderers';

export class PreviewRenderer {
  private ctx: CanvasRenderingContext2D | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private currentPreview: ExtendedSceneEntity | null = null;
  private currentTransform: ViewTransform | null = null;
  private currentViewport: Viewport | null = null;
  private currentOptions: Required<PreviewRenderOptions> = { ...DEFAULT_PREVIEW_OPTIONS };
  private isDirty = false;
  private dpr = 1;

  // Debug FPS counter (disabled in production)
  private debugFpsCounter = 0;
  private debugFpsLastTime = 0;
  private debugFpsEnabled = false;

  // ===== INITIALIZATION =====

  initialize(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
    this.dpr = getDevicePixelRatio();
  }

  updateSize(width: number, height: number): void {
    if (!this.canvas || !this.ctx) return;

    const dpr = getDevicePixelRatio();
    const newWidth = toDevicePixels(width, dpr);
    const newHeight = toDevicePixels(height, dpr);

    // Skip if size unchanged (prevents canvas buffer clear)
    if (this.canvas.width === newWidth && this.canvas.height === newHeight && this.dpr === dpr) {
      return;
    }

    this.dpr = dpr;
    this.canvas.width = newWidth;
    this.canvas.height = newHeight;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.isDirty = true;
  }

  // ===== PUBLIC API =====

  /**
   * Draw preview entity — called directly from mouse handler (NO React state).
   * Immediate synchronous render for zero-latency feedback.
   */
  drawPreview(
    entity: ExtendedSceneEntity | null,
    transform: ViewTransform,
    viewport: Viewport,
    options?: PreviewRenderOptions
  ): void {
    if (this.debugFpsEnabled) {
      const now = performance.now();
      this.debugFpsCounter++;
      if (now - this.debugFpsLastTime >= 1000) {
        console.error(`[PREVIEW FPS] ${this.debugFpsCounter} calls/sec | entity: ${entity?.type || 'null'}`);
        this.debugFpsCounter = 0;
        this.debugFpsLastTime = now;
      }
    }

    this.currentPreview = entity;
    this.currentTransform = transform;
    this.currentViewport = viewport;
    this.currentOptions = { ...DEFAULT_PREVIEW_OPTIONS, ...options };

    // Immediate render (no RAF wait)
    this.render();
  }

  /** Clear preview immediately */
  clear(): void {
    this.currentPreview = null;
    this.isDirty = false;

    if (this.ctx && this.canvas) {
      const dpr = getDevicePixelRatio();
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }

  /** Check if dirty (for UnifiedFrameScheduler) */
  checkDirty(): boolean {
    return this.isDirty;
  }

  /** Render frame */
  render(): void {
    if (!this.ctx || !this.canvas) return;

    const ctx = this.ctx;
    const dpr = this.dpr;

    // Early exit if no valid content or viewport
    if (!this.currentPreview || !this.currentTransform || !this.currentViewport) {
      this.isDirty = false;
      return;
    }
    if (this.currentViewport.width <= 0 || this.currentViewport.height <= 0) {
      this.isDirty = false;
      return;
    }

    // Clear canvas
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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
    ctx.setLineDash(opts.dashPattern.length > 0 ? opts.dashPattern : []);

    // Build helpers object for entity renderers
    const helpers: PreviewRenderHelpers = {
      viewport: this.currentViewport,
      renderGrip: (c, pos, o) => this.renderGrip(c, pos, o),
      renderDistanceLabelFromWorld: (c, w1, w2, s1, s2) => this.renderDistanceLabelFromWorld(c, w1, w2, s1, s2),
      renderInfoLabel: (c, pos, lines) => this.renderInfoLabel(c, pos, lines),
    };

    // Dispatch to entity renderer
    switch (entity.type) {
      case 'line': renderLine(ctx, entity as ExtendedLineEntity, transform, opts, helpers); break;
      case 'circle': renderCircle(ctx, entity as ExtendedCircleEntity, transform, opts, helpers); break;
      case 'polyline': renderPolyline(ctx, entity as ExtendedPolylineEntity, transform, opts, helpers); break;
      case 'rectangle': renderRectangle(ctx, entity, transform, opts, helpers); break;
      case 'angle-measurement': renderAngleMeasurement(ctx, entity as AngleMeasurementEntity, transform, opts, helpers); break;
      case 'point': renderPoint(ctx, entity as PreviewPoint, transform, opts, helpers); break;
      case 'arc': renderArc(ctx, entity as ArcPreviewEntity, transform, opts, helpers); break;
    }

    // Reset context
    ctx.globalAlpha = OPACITY.OPAQUE;
    ctx.setLineDash([]);
  }

  // ===== PRIVATE HELPERS =====

  private renderGrip(
    ctx: CanvasRenderingContext2D, screenPos: Point2D, opts: Required<PreviewRenderOptions>,
  ): void {
    const path = getGripPath(opts.gripSize);
    ctx.save();
    ctx.translate(screenPos.x, screenPos.y);
    ctx.fillStyle = opts.gripColor;
    ctx.fill(path);
    ctx.strokeStyle = UI_COLORS.BLACK;
    ctx.lineWidth = RENDER_LINE_WIDTHS.GRIP_OUTLINE;
    ctx.stroke(path);
    ctx.restore();
  }

  private renderDistanceLabelFromWorld(
    ctx: CanvasRenderingContext2D,
    worldP1: Point2D, worldP2: Point2D, screenP1: Point2D, screenP2: Point2D,
  ): void {
    renderDistanceLabel(ctx, worldP1, worldP2, screenP1, screenP2, PREVIEW_LABEL_DEFAULTS);
  }

  private renderInfoLabel(
    ctx: CanvasRenderingContext2D, screenPos: Point2D, lines: string[],
  ): void {
    if (lines.length === 0) return;
    const style = getTextPreviewStyleWithOverride();
    if (!style.enabled) return;

    const fontSize = parseInt(style.fontSize);
    const lineHeight = fontSize + 4;
    const font = `${style.fontStyle} ${style.fontWeight} ${fontSize}px ${style.fontFamily}`;

    ctx.save();
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const boxY = screenPos.y + fontSize + 6;
    ctx.fillStyle = style.color;
    ctx.globalAlpha = style.opacity;
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], screenPos.x, boxY + i * lineHeight + lineHeight / 2);
    }
    ctx.restore();
  }

  // ===== CLEANUP =====

  dispose(): void {
    this.clear();
    this.ctx = null;
    this.canvas = null;
  }
}
