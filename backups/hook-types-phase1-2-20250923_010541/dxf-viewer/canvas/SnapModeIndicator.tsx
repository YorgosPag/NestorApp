'use client';

import React from 'react';
import { ExtendedSnapType, type ProSnapResult } from '../snapping/extended-types';
import type { Point2D as Point } from '../types/scene';

interface Props {
  snapResult?: ProSnapResult | null;
  mouseCss: Point | null;
  enabledModes: Set<ExtendedSnapType>;
  className?: string;
}

// Mode display names (σύντομα)
const MODE_LABELS: Record<ExtendedSnapType, string> = {
  [ExtendedSnapType.ENDPOINT]: 'END',
  [ExtendedSnapType.MIDPOINT]: 'MID',
  [ExtendedSnapType.CENTER]: 'CEN',
  [ExtendedSnapType.INTERSECTION]: 'INT',
  [ExtendedSnapType.PERPENDICULAR]: 'PER',
  [ExtendedSnapType.TANGENT]: 'TAN',
  [ExtendedSnapType.QUADRANT]: 'QUA',
  [ExtendedSnapType.NEAREST]: 'NEA',
  [ExtendedSnapType.EXTENSION]: 'EXT',
  [ExtendedSnapType.NODE]: 'NOD',
  [ExtendedSnapType.INSERTION]: 'INS',
  [ExtendedSnapType.NEAR]: 'NER',
  [ExtendedSnapType.PARALLEL]: 'PAR',
  [ExtendedSnapType.ORTHO]: 'ORT',
  [ExtendedSnapType.GRID]: 'GRD',
  [ExtendedSnapType.AUTO]: 'AUTO'
};

export default function SnapModeIndicator({ snapResult, mouseCss, enabledModes, className }: Props) {
  if (!mouseCss) return null;

  const activeMode = snapResult?.activeMode;
  const activeModeLabel = activeMode ? MODE_LABELS[activeMode] : '';

  return (
    <div className={className}>
      {/* Active snap mode badge παίνω από cursor */}
      {activeModeLabel && (
        <div 
          className="absolute z-50 pointer-events-none"
          style={{
            left: mouseCss.x + 20,
            top: mouseCss.y - 25,
            transform: 'translateZ(0)' // Force GPU acceleration
          }}
        >
          <div className="px-2 py-1 bg-blue-600 text-white text-xs font-mono rounded shadow-lg">
            {activeModeLabel}
          </div>
        </div>
      )}

      {/* Status bar με enabled modes (κάτω δεξιά) */}
      <div className="absolute bottom-4 right-4 z-40 pointer-events-none">
        <div className="bg-gray-900/80 text-white px-3 py-2 rounded-lg font-mono text-xs">
          <div className="flex items-center gap-2">
            <span className="text-green-400">SNAP:</span>
            <span className="text-gray-300">
              {Array.from(enabledModes).slice(0, 3).map(mode => MODE_LABELS[mode]).join(' ')}
              {enabledModes.size > 3 && ` +${enabledModes.size - 3}`}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}