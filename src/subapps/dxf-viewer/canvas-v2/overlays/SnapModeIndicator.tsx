'use client';
import React from 'react';
import type { Point2D } from '../../rendering/types/Types';
import { portalComponents } from '@/styles/design-tokens';

interface SnapResult {
  point: Point2D;
  type: string;
}

interface SnapModeIndicatorProps {
  snapResult?: SnapResult | null;
  mouseCss: Point2D | null;
  enabledModes: Set<string>;
  className?: string;
}

export default function SnapModeIndicator({
  snapResult,
  mouseCss,
  enabledModes,
  className = ''
}: SnapModeIndicatorProps) {
  if (!snapResult || !mouseCss) return null;

  return (
    <div className={`absolute inset-0 pointer-events-none ${className}`}>
      <div
        className="absolute text-xs text-yellow-300 bg-black bg-opacity-75 px-1 py-0.5 rounded"
        style={{
          left: mouseCss.x + 10,
          top: mouseCss.y - 25,
          zIndex: portalComponents.zIndex.tooltip + 1
        }}
      >
        {snapResult.type}
      </div>
    </div>
  );
}