
'use client';

import { colors } from '@/styles/design-tokens';

/** Grid line visual configuration — SSoT: design-tokens */
const GRID_STYLE = {
  stroke: colors.gray['200'],   // #e5e7eb — Tailwind gray-200
  strokeWidth: 0.5,
  opacity: 0.5,
} as const;

interface GridOverlayProps {
  showGrid: boolean;
  width: number;
  height: number;
  gridSize: number;
}

export function GridOverlay({ showGrid, width, height, gridSize }: GridOverlayProps) {
  if (!showGrid) return null;

  const lines = [];

  // Vertical lines
  for (let x = 0; x <= width; x += gridSize) {
    lines.push(
      <line
        key={`v-${x}`}
        x1={x}
        y1={0}
        x2={x}
        y2={height}
        stroke={GRID_STYLE.stroke}
        strokeWidth={GRID_STYLE.strokeWidth}
        opacity={GRID_STYLE.opacity}
      />
    );
  }

  // Horizontal lines
  for (let y = 0; y <= height; y += gridSize) {
    lines.push(
      <line
        key={`h-${y}`}
        x1={0}
        y1={y}
        x2={width}
        y2={y}
        stroke={GRID_STYLE.stroke}
        strokeWidth={GRID_STYLE.strokeWidth}
        opacity={GRID_STYLE.opacity}
      />
    );
  }

  return <g className="grid-overlay">{lines}</g>;
}
