
'use client';

import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { HOVER_COLOR_EFFECTS } from '@/components/ui/effects';
import { colors } from '@/styles/design-tokens';

/** Vertex handle colors by interaction state — SSoT: design-tokens */
const VERTEX_COLORS = {
  default: colors.purple['600'],          // #7c3aed — violet
  shiftDown: colors.purple['400'],        // #a78bfa — lighter violet
  hover: colors.yellow['400'],            // #facc15 — yellow highlight
  shiftHover: colors.red['500'],          // #ef4444 — red (delete hint)
} as const;

interface VertexHandleProps {
  vertex: { x: number; y: number };
  index: number;
  onMouseDown: (index: number, event: React.MouseEvent) => void;
}

export function VertexHandle({
  vertex,
  index,
  onMouseDown
}: VertexHandleProps) {
  const [isShiftDown, setIsShiftDown] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => e.key === 'Shift' && setIsShiftDown(true);
    const handleKeyUp = (e: KeyboardEvent) => e.key === 'Shift' && setIsShiftDown(false);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const getFillColor = () => {
    if (isHovered) {
      return isShiftDown ? VERTEX_COLORS.shiftHover : VERTEX_COLORS.hover;
    }
    return isShiftDown ? VERTEX_COLORS.shiftDown : VERTEX_COLORS.default;
  };

  return (
    <circle
      cx={vertex.x}
      cy={vertex.y}
      r={5}
      fill={getFillColor()}
      stroke="hsl(var(--border))"
      strokeWidth={2}
      className={cn(
        "transition-colors",
        isShiftDown ? "cursor-crosshair" : `cursor-move ${HOVER_COLOR_EFFECTS.FILL_VIOLET}`
      )}
      onMouseDown={(e) => onMouseDown(index, e)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    />
  );
}
