
'use client';

import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { HOVER_COLOR_EFFECTS } from '@/components/ui/effects';

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
          return isShiftDown ? "#ef4444" : "#facc15"; // red on shift-hover, yellow on hover
      }
      return isShiftDown ? "#a78bfa" : "#7c3aed"; // lighter violet on shift, default violet
  }

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
