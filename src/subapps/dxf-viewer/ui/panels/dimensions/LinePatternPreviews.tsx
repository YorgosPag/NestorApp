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
import { type LinePatternSegment, segmentsToComplex } from '../../../config/line-pattern-segments';
import { buildLinetypeThumbnailFromPattern } from '../../../rendering/linetype-thumbnail';
import { strokeStyledPolyline } from '../../../rendering/linetype/ComplexLineStroker';

/** Screen px per mm for the text preview canvas — makes a default (scale 1) glyph legible. */
const PREVIEW_PX_PER_MM = 4;

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
 * WYSIWYG preview for a text-carrying pattern — strokes a horizontal line through the
 * REAL `strokeStyledPolyline` SSoT, so `──GAS──` renders exactly as it will on canvas.
 */
export function TextPatternPreview({ label, segments }: { label: string; segments: readonly LinePatternSegment[] }) {
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
    const def = segmentsToComplex('__preview__', segments);
    const midY = h / 2;
    strokeStyledPolyline(ctx, [{ x: 6, y: midY }, { x: w - 6, y: midY }], def, {
      worldToScreenScale: PREVIEW_PX_PER_MM,
      ltscale: 1,
    });
  }, [segments]);

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground w-36 shrink-0">{label}</span>
      <canvas ref={ref} className="h-9 w-full rounded-sm border border-border" aria-hidden="true" />
    </div>
  );
}
