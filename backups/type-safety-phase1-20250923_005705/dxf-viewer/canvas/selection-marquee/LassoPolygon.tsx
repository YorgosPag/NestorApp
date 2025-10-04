import React from 'react';
import type { LassoPolygonProps } from './types';
import { isCounterClockwise, getSelectionColors, generateSVGPath } from './utils';

export function LassoPolygon({ points }: LassoPolygonProps) {
  if (points.length < 2) return null;

  const isWindow = isCounterClockwise(points);
  const kind = isWindow ? 'window' : 'crossing';
  const { borderColor, fillColor, borderStyle } = getSelectionColors(kind);
  const pathData = generateSVGPath(points);

  // Convert borderStyle to SVG strokeDasharray
  const getStrokeDashArray = (style: string) => {
    switch (style) {
      case 'dashed': return "8,4";
      case 'dotted': return "2,2";
      case 'dash-dot': return "8,4,2,4";
      default: return "none";
    }
  };

  return (
    <svg 
      className="absolute inset-0 w-full h-full"
      style={{ pointerEvents: 'none' }}
    >
      <path
        d={pathData}
        fill={fillColor}
        stroke={borderColor}
        strokeWidth="2"
        strokeDasharray={getStrokeDashArray(borderStyle)}
      />
      
      {/* Vertex dots */}
      {points.map((point, i) => (
        <circle
          key={i}
          cx={point.x}
          cy={point.y}
          r="3"
          fill={borderColor}
          stroke="white"
          strokeWidth="1"
        />
      ))}
    </svg>
  );
}