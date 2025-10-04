'use client';
import React from 'react';
import type { Point2D } from '../../rendering/types/Types';

interface SnapResult {
  point: Point2D;
  type: string;
}

interface SnapIndicatorOverlayProps {
  snapResult?: SnapResult | null;
  viewport: { width: number; height: number };
  canvasRect: DOMRect | null;
  transform?: any;
  className?: string;
}

export default function SnapIndicatorOverlay({
  snapResult,
  viewport,
  canvasRect,
  transform,
  className = ''
}: SnapIndicatorOverlayProps) {
  if (!snapResult || !snapResult.point) return null;

  const { point } = snapResult;

  return (
    <div className={`absolute inset-0 pointer-events-none ${className}`}>
      <div
        className="absolute w-2 h-2 bg-yellow-400 border border-yellow-600 rounded-full"
        style={{
          left: point.x - 4,
          top: point.y - 4,
          zIndex: 1001
        }}
      />
    </div>
  );
}