'use client';

/**
 * LinePatternPreviews — the two live pattern-preview subcomponents shared by the
 * `LinePatternSegmentsEditor` (dialog + inline tab). Extracted (N.7.1) so the editor
 * shell stays ≤500 lines.
 *
 * FULL SSoT: geometry dash preview = the SAME `buildLinetypeThumbnailFromPattern` the
 * renderer uses; text preview = `strokeStyledPolyline` (the SAME canvas render SSoT),
 * so `──GAS──` renders exactly as it will on the canvas.
 */

import React from 'react';
import {
  type LinePatternLayer,
  type LinePatternSegment,
  layersToComplex,
  segmentsToComplex,
} from '../../../config/line-pattern-segments';
import { buildLinetypeThumbnailFromPattern } from '../../../rendering/linetype-thumbnail';
import { strokeStyledPolyline } from '../../../rendering/linetype/ComplexLineStroker';
import { LinePatternGripOverlay, type LinePatternGripLabels } from './LinePatternGripOverlay';

/** Screen px per mm for the text preview canvas — makes a default (scale 1) glyph legible. */
const PREVIEW_PX_PER_MM = 4;

/** Larger scale for the compound preview so the small (±0.75mm) rail offsets are visible. */
const COMPOUND_PREVIEW_PX_PER_MM = 7;

/** The large (editable) compound preview zooms in further so the band spread + grips read clearly. */
const COMPOUND_PREVIEW_PX_PER_MM_LG = 14;

export function PatternPreview({ label, pattern }: { label: string; pattern: readonly number[] }) {
  const thumb = buildLinetypeThumbnailFromPattern(pattern, 220, 16);
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground w-36 shrink-0">{label}</span>
      <svg
        viewBox={`0 0 ${thumb.width} ${thumb.height}`}
        className="h-4 w-full rounded-sm border border-border"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <line
          x1={0}
          y1={thumb.height / 2}
          x2={thumb.width}
          y2={thumb.height / 2}
          stroke="currentColor"
          strokeWidth={1.25}
          strokeDasharray={thumb.dash.length > 0 ? thumb.dash.join(' ') : undefined}
        />
      </svg>
    </div>
  );
}

/**
 * Shared WYSIWYG canvas preview — owns the dpr/clear/strokeStyle boilerplate and re-runs
 * whenever the memoized `draw` closure changes. ONE SSoT (N.18) for both the text preview and
 * the compound preview: they differ only in the `def` they build and the vertical room they need.
 */
function StrokePreviewCanvas({
  label, heightClass, draw, overlay, stacked = false,
}: {
  label: string;
  heightClass: string;
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
  /** ADR-642 Φ6-A — an absolutely-positioned grip overlay drawn over the canvas (editable swatch). */
  overlay?: React.ReactNode;
  /** `true` → label stacked above a full-width swatch (large preview); `false` → inline label (compact). */
  stacked?: boolean;
}) {
  const ref = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w <= 0 || h <= 0) return;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = window.getComputedStyle(canvas).color || '#111';
    ctx.lineWidth = 1.25;
    draw(ctx, w, h);
  }, [draw]);

  const swatch = (
    <div className={`relative w-full ${heightClass}`}>
      <canvas ref={ref} className="h-full w-full rounded-sm border border-border" aria-hidden="true" />
      {overlay}
    </div>
  );

  if (stacked) {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">{label}</span>
        {swatch}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground w-36 shrink-0">{label}</span>
      {swatch}
    </div>
  );
}

/**
 * WYSIWYG preview for a text-carrying pattern — strokes a horizontal line through the
 * REAL `strokeStyledPolyline` SSoT, so `──GAS──` renders exactly as it will on canvas.
 */
export function TextPatternPreview({ label, segments }: { label: string; segments: readonly LinePatternSegment[] }) {
  const draw = React.useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      const def = segmentsToComplex('__preview__', segments);
      const midY = h / 2;
      strokeStyledPolyline(ctx, [{ x: 6, y: midY }, { x: w - 6, y: midY }], def, {
        worldToScreenScale: PREVIEW_PX_PER_MM,
        ltscale: 1,
      });
    },
    [segments],
  );
  return <StrokePreviewCanvas label={label} heightClass="h-9" draw={draw} />;
}

/**
 * WYSIWYG preview for a COMPOUND (multi-layer) pattern (ADR-642 Φ5) — strokes the full
 * `layersToComplex` def through the SAME `strokeStyledPolyline` SSoT, so the parallel rails +
 * ties render exactly as on canvas. A larger scale + taller canvas makes the small offsets legible.
 */
export function CompoundPatternPreview({
  label, layers, onLayersChange, gripLabels, size = 'sm',
}: {
  label: string;
  layers: readonly LinePatternLayer[];
  /** ADR-642 Φ6-A — when provided (with `gripLabels`), the swatch hosts the 8-handle grip editor. */
  onLayersChange?: (layers: LinePatternLayer[]) => void;
  gripLabels?: LinePatternGripLabels;
  /** `'lg'` → a tall, full-width, zoomed-in editable swatch (dialog); `'sm'` → the compact inline strip. */
  size?: 'sm' | 'lg';
}) {
  const big = size === 'lg';
  const pxPerMm = big ? COMPOUND_PREVIEW_PX_PER_MM_LG : COMPOUND_PREVIEW_PX_PER_MM;
  const draw = React.useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      const def = layersToComplex('__preview__', layers);
      const midY = h / 2;
      strokeStyledPolyline(ctx, [{ x: 6, y: midY }, { x: w - 6, y: midY }], def, {
        worldToScreenScale: pxPerMm,
        ltscale: 1,
      });
    },
    [layers, pxPerMm],
  );
  const overlay =
    onLayersChange && gripLabels ? (
      <LinePatternGripOverlay layers={layers} onLayersChange={onLayersChange} labels={gripLabels} />
    ) : undefined;
  return (
    <StrokePreviewCanvas
      label={label}
      heightClass={big ? 'h-44' : 'h-12'}
      stacked={big}
      draw={draw}
      overlay={overlay}
    />
  );
}
