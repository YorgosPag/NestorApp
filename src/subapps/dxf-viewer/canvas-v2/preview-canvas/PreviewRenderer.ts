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
import { OPACITY } from '../../config/color-config';
import { degToRad } from '../../rendering/entities/shared/geometry-utils';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import type { PreviewGripPoint } from '../../types/entities';

// Re-export types for consumers
export type { PreviewRenderOptions } from './preview-renderer-types';
import type { PreviewRenderOptions, ArcPreviewEntity, PreviewRenderHelpers } from './preview-renderer-types';
import { DEFAULT_PREVIEW_OPTIONS } from './preview-renderer-types';
import { UnifiedGripRenderer } from '../../rendering/grips/UnifiedGripRenderer';
import {
  renderLine, renderCircle, renderPolyline, renderRectangle,
  renderAngleMeasurement, renderPoint, renderArc,
} from './preview-entity-renderers';
// ADR-362 Phase D1: dim entity preview routed through the dedicated renderer
// (Phase C2 deliverable). PreviewRenderer keeps DIMSTYLE resolution local so
// the dim creation flow doesn't have to thread styles through props.
import { renderPreviewDimension } from './preview-dimension-renderer';
import { getDimStyleRegistry } from '../../systems/dimensions/dim-style-registry';
import type { DimensionEntity } from '../../types/dimension';

export class PreviewRenderer {
  private ctx: CanvasRenderingContext2D | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private _gripRenderer: UnifiedGripRenderer | null = null;
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
    this._gripRenderer = this.ctx ? new UnifiedGripRenderer(this.ctx, (p) => p) : null;
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

  /**
   * Draw polar tracking alignment path + tooltip (ADR-357 Phase 1).
   * Called AFTER drawPreview so it overlays on top without clearing.
   * The next drawPreview call will clear this automatically.
   */
  drawPolarTrackingLine(
    ref: Point2D,
    snappedAngle: number,
    label: string,
    cursorWorld: Point2D,
    transform: ViewTransform,
    viewport: Viewport,
  ): void {
    if (!this.ctx) return;
    const ctx = this.ctx;

    const refScreen = CoordinateTransforms.worldToScreen(ref, transform, viewport);
    const cursorScreen = CoordinateTransforms.worldToScreen(cursorWorld, transform, viewport);

    // Direction in screen space — flip Y since screen Y is down
    const rad = degToRad(snappedAngle);
    const dx = Math.cos(rad);
    const dy = -Math.sin(rad);
    const EXTEND = 6000;

    ctx.save();
    ctx.setLineDash([8, 5]);
    ctx.strokeStyle = '#00CC44';
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.75;
    ctx.beginPath();
    ctx.moveTo(refScreen.x, refScreen.y);
    ctx.lineTo(refScreen.x + dx * EXTEND, refScreen.y + dy * EXTEND);
    ctx.stroke();

    // Tooltip near cursor
    ctx.setLineDash([]);
    ctx.font = '11px monospace';
    ctx.fillStyle = '#00CC44';
    ctx.globalAlpha = 0.9;
    ctx.fillText(label, cursorScreen.x + 14, cursorScreen.y - 8);
    ctx.restore();
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

    // Colored preview grips override entity-renderer grips (ADR-142 icon click sequence)
    const entityMeta = entity as { previewGripPoints?: Array<PreviewGripPoint>; showPreviewGrips?: boolean };
    const coloredGrips = entityMeta.showPreviewGrips && entityMeta.previewGripPoints?.length
      ? entityMeta.previewGripPoints
      : null;

    // Setup context style
    ctx.strokeStyle = opts.color;
    ctx.fillStyle = opts.gripColor;
    ctx.lineWidth = opts.lineWidth;
    ctx.globalAlpha = opts.opacity;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.setLineDash(opts.dashPattern.length > 0 ? opts.dashPattern : []);

    // Suppress entity-level grips when colored grips handle rendering
    const renderOpts = coloredGrips ? { ...opts, showGrips: false } : opts;

    // Build helpers object for entity renderers
    const helpers: PreviewRenderHelpers = {
      viewport: this.currentViewport,
      renderGrip: (c, pos, o) => this.renderGrip(c, pos, o),
      renderDistanceLabelFromWorld: (c, w1, w2, s1, s2) => this.renderDistanceLabelFromWorld(c, w1, w2, s1, s2),
      renderInfoLabel: (c, pos, lines) => this.renderInfoLabel(c, pos, lines),
    };

    // Dispatch to entity renderer
    switch (entity.type) {
      case 'line': renderLine(ctx, entity as ExtendedLineEntity, transform, renderOpts, helpers); break;
      case 'circle': renderCircle(ctx, entity as ExtendedCircleEntity, transform, renderOpts, helpers); break;
      case 'polyline': renderPolyline(ctx, entity as ExtendedPolylineEntity, transform, renderOpts, helpers); break;
      case 'rectangle': renderRectangle(ctx, entity, transform, renderOpts, helpers); break;
      case 'angle-measurement': renderAngleMeasurement(ctx, entity as AngleMeasurementEntity, transform, renderOpts, helpers); break;
      case 'point': renderPoint(ctx, entity as PreviewPoint, transform, renderOpts, helpers); break;
      case 'arc': renderArc(ctx, entity as ArcPreviewEntity, transform, renderOpts, helpers); break;
      // ADR-362 Phase D1: route dim preview through the Phase C2 renderer.
      case 'dimension': {
        const dimEntity = entity as DimensionEntity;
        const registry = getDimStyleRegistry();
        const style = registry.getStyle(dimEntity.styleId) ?? registry.getActiveStyle();
        renderPreviewDimension({
          ctx,
          entity: dimEntity,
          style,
          transform,
          viewport: this.currentViewport,
          opts: { color: renderOpts.color, opacity: renderOpts.opacity },
        });
        break;
      }
    }

    // Render colored preview grips (FIRST=teal P1/cursor-start, SECOND=yellow intermediates, THIRD=red cursor)
    if (coloredGrips) {
      for (const grip of coloredGrips) {
        const screenPos = CoordinateTransforms.worldToScreen(grip.position, transform, this.currentViewport!);
        this.renderGrip(ctx, screenPos, opts, grip.color);
      }
    }

    // Reset context
    ctx.globalAlpha = OPACITY.OPAQUE;
    ctx.setLineDash([]);
  }

  // ===== PRIVATE HELPERS =====

  private renderGrip(
    _ctx: CanvasRenderingContext2D, screenPos: Point2D, opts: Required<PreviewRenderOptions>,
    customColor?: string,
  ): void {
    if (!this._gripRenderer) return;
    this._gripRenderer.renderGrip(
      {
        position: screenPos,
        type: 'vertex',
        shape: 'square',
        temperature: 'cold',
        customColor: customColor ?? opts.gripColor,
      },
      { gripSize: opts.gripSize, dpiScale: 1.0 }
    );
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
    this._gripRenderer = null;
  }
}
