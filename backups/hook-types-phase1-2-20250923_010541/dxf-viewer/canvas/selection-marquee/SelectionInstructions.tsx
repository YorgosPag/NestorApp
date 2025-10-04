import React from 'react';
import type { SelectionInstructionsProps } from './types';

export function SelectionInstructions({ className = '' }: SelectionInstructionsProps) {
  return (
    <div className={`absolute inset-0 pointer-events-none ${className}`} style={{ zIndex: 2000 }}>
      <div className="absolute bottom-4 left-4 bg-gray-800 bg-opacity-90 text-white px-4 py-2 rounded-lg shadow-lg border border-gray-600">
        <div className="flex items-center gap-2">
          <span className="text-lg">🎯</span>
          <div>
            <div className="font-medium">AutoCAD Selection Mode</div>
            <div className="text-xs opacity-90">
              Drag L→R: Window (μπλε) • R→L: Crossing (πράσινο) • Hold+Drag: Lasso • ESC: Cancel
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}