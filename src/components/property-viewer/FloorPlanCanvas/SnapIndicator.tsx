
'use client';

import { colors } from '@/styles/design-tokens';

/** Snap indicator visual style — SSoT: design-tokens */
const SNAP_STYLE = {
  radius: 4,
  stroke: `${colors.red['500']}B3`,  // red-500 @ ~70% opacity (B3 hex = 0.7)
  strokeWidth: 1.5,
  dashArray: '2 2',
} as const;

interface Point {
  x: number;
  y: number;
}

interface SnapIndicatorProps {
  position: Point;
}

export function SnapIndicator({ position }: SnapIndicatorProps) {
  return (
    <circle
      cx={position.x}
      cy={position.y}
      r={SNAP_STYLE.radius}
      fill="none"
      stroke={SNAP_STYLE.stroke}
      strokeWidth={SNAP_STYLE.strokeWidth}
      strokeDasharray={SNAP_STYLE.dashArray}
      className="pointer-events-none"
    />
  );
}
