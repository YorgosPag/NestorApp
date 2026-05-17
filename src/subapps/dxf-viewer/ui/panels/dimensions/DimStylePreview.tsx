'use client';

import React, { useMemo } from 'react';
import type { DimStyle } from '../../../types/dimension';

interface DimStylePreviewProps {
  style: DimStyle;
}

const W = 160;
const H = 80;
const PAD = 16;
const DIM_Y = H - 20;
const EXT_TOP = 16;
const X1 = PAD + 10;
const X2 = W - PAD - 10;
const MID_X = (X1 + X2) / 2;
const ARROW_SIZE = 6;

function ArrowHead({ x, y, dir }: { x: number; y: number; dir: 'left' | 'right' }) {
  const tip = dir === 'left' ? x - ARROW_SIZE : x + ARROW_SIZE;
  return (
    <polygon
      points={`${x},${y} ${tip},${y - ARROW_SIZE / 2} ${tip},${y + ARROW_SIZE / 2}`}
      fill="currentColor"
    />
  );
}

export function DimStylePreview({ style }: DimStylePreviewProps) {
  const computed = useMemo(() => {
    const textY = DIM_Y - 8;
    const decimalPlaces = Math.min(Math.max(style.dimdec, 0), 4);
    const measurement = ((X2 - X1) * style.dimlfac).toFixed(decimalPlaces);
    const label = style.dimpost
      ? style.dimpost.replace('[]', measurement)
      : measurement;
    return { textY, label };
  }, [style]);

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      className="text-foreground bg-muted rounded border border-border"
      aria-hidden
    >
      {/* Extension lines */}
      <line x1={X1} y1={EXT_TOP} x2={X1} y2={DIM_Y} stroke="currentColor" strokeWidth={0.8} />
      <line x1={X2} y1={EXT_TOP} x2={X2} y2={DIM_Y} stroke="currentColor" strokeWidth={0.8} />

      {/* Dim line segments */}
      <line x1={X1} y1={DIM_Y} x2={MID_X - 18} y2={DIM_Y} stroke="currentColor" strokeWidth={0.8} />
      <line x1={MID_X + 18} y1={DIM_Y} x2={X2} y2={DIM_Y} stroke="currentColor" strokeWidth={0.8} />

      {/* Arrowheads */}
      <ArrowHead x={X1} y={DIM_Y} dir="right" />
      <ArrowHead x={X2} y={DIM_Y} dir="left" />

      {/* Measured points */}
      <circle cx={X1} cy={EXT_TOP} r={2} fill="currentColor" />
      <circle cx={X2} cy={EXT_TOP} r={2} fill="currentColor" />

      {/* Dimension text */}
      <text
        x={MID_X}
        y={computed.textY}
        textAnchor="middle"
        fontSize={9}
        fill="currentColor"
        fontFamily={style.textFontFamily || 'Arial'}
      >
        {computed.label}
      </text>
    </svg>
  );
}
