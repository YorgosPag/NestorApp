'use client';

import React, { useRef, useMemo } from 'react';
import { useCursor } from '../../systems/cursor';
import type { ToolType } from './types';

interface ToolbarStatusBarProps {
  activeTool: ToolType;
  currentZoom: number;
  snapEnabled: boolean;
  commandCount?: number;
  mouseCoordinates?: { x: number; y: number } | null;
  showCoordinates?: boolean;
}

export const ToolbarStatusBar: React.FC<ToolbarStatusBarProps> = ({
  activeTool,
  currentZoom,
  snapEnabled,
  commandCount = 0,
  mouseCoordinates = null,
  showCoordinates = false
}) => {
  const { settings } = useCursor();

  // Λειτουργία ακρίβειας: περισσότερα δεκαδικά ψηφία
  const precision = settings.performance.precision_mode ? 4 : 2;

  // ✅ Throttle coordinate updates για performance
  const lastCoordinatesRef = useRef<{ x: number; y: number } | null>(null);

  const throttledCoordinates = useMemo(() => {
    if (!mouseCoordinates) return null;

    // Only update if coordinates changed significantly (>1px)
    if (lastCoordinatesRef.current &&
        Math.abs(lastCoordinatesRef.current.x - mouseCoordinates.x) < 1 &&
        Math.abs(lastCoordinatesRef.current.y - mouseCoordinates.y) < 1) {
      return lastCoordinatesRef.current;
    }

    lastCoordinatesRef.current = mouseCoordinates;
    return mouseCoordinates;
  }, [mouseCoordinates]);
  
  return (
    <div className="border-t border-gray-600 bg-gray-900 px-3 py-1 text-xs text-gray-300 flex justify-between items-center">
      <div className="flex items-center gap-4">
        <span>
          Tool: <strong className="text-blue-400">
            {activeTool?.charAt(0)?.toUpperCase() + activeTool?.slice(1) || 'Unknown'}
          </strong>
        </span>
        
        <span className="text-gray-500">|</span>
        
        <span>
          Zoom: <strong className="text-green-400">
            {Math.round(currentZoom * 100)}%
          </strong>
        </span>
        
        <span className="text-gray-500">|</span>
        
        <span>
          Snap: <strong className={snapEnabled ? "text-green-400" : "text-red-400"}>
            {snapEnabled ? 'ON' : 'OFF'}
          </strong>
        </span>
        
        {commandCount > 0 && (
          <>
            <span className="text-gray-500">|</span>
            <span>
              Commands: <strong className="text-yellow-400">{commandCount}</strong>
            </span>
          </>
        )}

        {showCoordinates && (
          <>
            <span className="text-gray-500">|</span>
            <span>
              Συντεταγμένες: <strong className="text-cyan-400">
                {throttledCoordinates ?
                  `X: ${throttledCoordinates.x.toFixed(precision)}, Y: ${throttledCoordinates.y.toFixed(precision)}` :
                  `X: ${(0).toFixed(precision)}, Y: ${(0).toFixed(precision)}`}
              </strong>
            </span>
          </>
        )}
      </div>
      
      <div className="flex items-center gap-2 text-gray-400">
        <span>🎯 D=Ruler | W=ZoomWindow | +/-=Zoom | F9=Grid | ESC=Cancel</span>
      </div>
    </div>
  );
};
