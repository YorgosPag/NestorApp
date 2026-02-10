
'use client';

import React from 'react';
import { INTERACTIVE_PATTERNS, CORE_HOVER_TRANSFORMS } from '@/components/ui/effects';
import { borderColors } from '@/styles/design-tokens';

/** Midpoint handle color — SSoT: design-tokens success (emerald-500) */
const MIDPOINT_COLOR = borderColors.success.light; // #10b981

interface EdgeMidpointProps {
  start: { x: number; y: number };
  end: { x: number; y: number };
  index: number;
  onMouseDown: (index: number, event: React.MouseEvent) => void;
}

export function EdgeMidpoint({
  start,
  end,
  index,
  onMouseDown
}: EdgeMidpointProps) {
  const midpoint = {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2
  };

  return (
    <circle
      cx={midpoint.x}
      cy={midpoint.y}
      r={4}
      fill={MIDPOINT_COLOR}
      stroke="hsl(var(--border))"
      strokeWidth={1}
      className={`cursor-pointer opacity-70 ${INTERACTIVE_PATTERNS.OPACITY_REVEAL} ${CORE_HOVER_TRANSFORMS.SCALE_UP_SMALL} transition-all`}
      onMouseDown={(e) => onMouseDown(index, e)}
    />
  );
}
