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

/** Screen px per mm for the text preview canvas — makes a default (scale 1) glyph legible. */
const PREVIEW_PX_PER_MM = 4;

/** Larger scale for the compound preview so the small (±0.75mm) rail offsets are visible. */
const COMPOUND_PREVIEW_PX_PER_MM = 7;

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
  label, heightClass, draw,
}: {
  label: string;
  heightClass: string;
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
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

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground w-36 shrink-0">{label}</span>
      <canvas ref={ref} className={`${heightClass} w-full rounded-sm border border-border`} aria-hidden="true" />
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
export function CompoundPatternPreview({ label, layers }: { label: string; layers: readonly LinePatternLayer[] }) {
  const draw = React.useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      const def = layersToComplex('__preview__', layers);
      const midY = h / 2;
      strokeStyledPolyline(ctx, [{ x: 6, y: midY }, { x: w - 6, y: midY }], def, {
        worldToScreenScale: COMPOUND_PREVIEW_PX_PER_MM,
        ltscale: 1,
      });
    },
    [layers],
  );
  return <StrokePreviewCanvas label={label} heightClass="h-12" draw={draw} />;
}
