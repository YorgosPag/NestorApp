import React from 'react';
import type { SelectionStatusProps } from './types';
import { filterValidPoints } from './utils';

export function SelectionStatus({ marquee, lasso }: SelectionStatusProps) {
  const isActive = marquee?.active || lasso?.active;
  
  if (!isActive) return null;

  const getStatusText = () => {
    if (lasso?.active) {
      const validPoints = filterValidPoints(lasso.points);
      return `Lasso Selection • ${validPoints.length} points`;
    }
    
    if (marquee?.active && marquee.start && marquee.end) {
      const width = Math.round(Math.abs(marquee.end.x - marquee.start.x));
      const height = Math.round(Math.abs(marquee.end.y - marquee.start.y));
      return `${marquee.kind || 'Rectangle'} Selection • ${width}×${height}`;
    }
    
    return `${marquee?.kind || 'Rectangle'} Selection`;
  };

  return (
    <div className="absolute bottom-4 left-4 bg-gray-800 bg-opacity-90 text-white px-3 py-2 rounded text-sm shadow-lg">
      <div className="flex items-center gap-2">
        <span>🎯</span>
        <span>{getStatusText()}</span>
      </div>
    </div>
  );
}