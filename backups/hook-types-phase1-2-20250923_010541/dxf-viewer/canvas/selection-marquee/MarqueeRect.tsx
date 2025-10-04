import React from 'react';
import type { MarqueeRectProps } from './types';
import { calculateRectGeometry, getSelectionColors } from './utils';

// DEBUG FLAG - Set to false to disable performance-heavy logging
const DEBUG_MARQUEE_RECT = false;

export function MarqueeRect({ start, end, kind }: MarqueeRectProps) {
  const rect = calculateRectGeometry(start, end);
  const { borderColor, fillColor, borderStyle, borderWidth } = getSelectionColors(kind);

  // Convert borderStyle to SVG strokeDasharray
  const getStrokeDashArray = (style: string) => {
    const dashArray = (() => {
      switch (style) {
        case 'dashed': return "8,4";
        case 'dotted': return "2,2"; 
        case 'dash-dot': return "8,4,2,4";
        default: return "none";
      }
    })();
    
    if (DEBUG_MARQUEE_RECT) console.log(`📦 MarqueeRect ${kind}: borderStyle="${style}" → strokeDasharray="${dashArray}"`);
    return dashArray;
  };

  return (
    <div
      className="absolute"
      style={{
        left: rect.x,
        top: rect.y,
        width: rect.width,
        height: rect.height,
        pointerEvents: 'none'
      }}
    >
      <svg
        width={rect.width}
        height={rect.height}
        className="absolute inset-0"
        style={{ overflow: 'visible' }}
      >
        {/* Fill rectangle */}
        <rect
          x={borderWidth / 2}
          y={borderWidth / 2}
          width={rect.width - borderWidth}
          height={rect.height - borderWidth}
          fill={fillColor}
          stroke="none"
        />
        {/* Border rectangle */}
        <rect
          x={borderWidth / 2}
          y={borderWidth / 2}
          width={rect.width - borderWidth}
          height={rect.height - borderWidth}
          fill="none"
          stroke={borderColor}
          strokeWidth={borderWidth}
          strokeDasharray={getStrokeDashArray(borderStyle)}
        />
      </svg>
    </div>
  );
}