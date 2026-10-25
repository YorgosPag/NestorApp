'use client';
/**
 * ADR-920 Β4.8 Β1 — the ONE SVG painter of a breakline line (committed or proposed).
 *
 * Painter's order inside one `<g>`: an optional UNDER-stroke (the dark casing of a committed breakline, or
 * the selection-coloured halo of a focused candidate) → the line itself → optional vertex discs. The two
 * overlays differ only in the vocabulary they pass in (`topo-breakline-style` vs `auto-breakline-review-style`);
 * a second copy of this markup is exactly the sibling clone N.18 forbids.
 */
import React from 'react';
import type { Point2D } from '../../../rendering/types/Types';

export interface BreaklineStrokeSpec {
  readonly color: string;
  readonly widthPx: number;
  /** SVG `stroke-dasharray`; `null`/absent = solid. */
  readonly dash?: string | null;
  readonly opacity?: number;
}

export interface BreaklineVertexDots {
  readonly diameterPx: number;
  readonly fill: string;
  readonly outline: string;
}

interface Props {
  readonly d: string;
  readonly stroke: BreaklineStrokeSpec;
  readonly under?: BreaklineStrokeSpec;
  readonly vertices?: readonly Point2D[];
  readonly dots?: BreaklineVertexDots;
}

function StrokePath({ d, spec }: { readonly d: string; readonly spec: BreaklineStrokeSpec }) {
  return (
    <path
      d={d}
      fill="none"
      stroke={spec.color}
      strokeWidth={spec.widthPx}
      strokeOpacity={spec.opacity}
      strokeDasharray={spec.dash ?? undefined}
      strokeLinejoin="round"
      strokeLinecap="round"
    />
  );
}

export function TopoBreaklineStroke({ d, stroke, under, vertices, dots }: Props) {
  return (
    <g>
      {under && <StrokePath d={d} spec={under} />}
      <StrokePath d={d} spec={stroke} />
      {dots && vertices?.map((v, i) => (
        <circle
          key={i}
          cx={v.x}
          cy={v.y}
          r={dots.diameterPx / 2}
          fill={dots.fill}
          stroke={dots.outline}
          strokeWidth={1.5}
        />
      ))}
    </g>
  );
}
