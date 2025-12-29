'use client';
import React from 'react';
import type { Point2D } from '../../rendering/types/Types';
// Enterprise Canvas UI Migration - Phase B
import { portalComponents } from '@/styles/design-tokens';
import { canvasUI } from '@/styles/design-tokens/canvas';

interface ZoomWindowState {
  isActive: boolean;
  isDragging: boolean;
  startPoint: Point2D | null;
  currentPoint: Point2D | null;
  previewRect: any | null;
}

interface ZoomWindowOverlayProps {
  zoomWindowState: ZoomWindowState;
  className?: string;
}

export default function ZoomWindowOverlay({
  zoomWindowState,
  className = ''
}: ZoomWindowOverlayProps) {
  const { isActive, startPoint, currentPoint } = zoomWindowState;

  if (!isActive || !startPoint || !currentPoint) return null;

  const left = Math.min(startPoint.x, currentPoint.x);
  const top = Math.min(startPoint.y, currentPoint.y);
  const width = Math.abs(currentPoint.x - startPoint.x);
  const height = Math.abs(currentPoint.y - startPoint.y);

  return (
    <div className={`absolute inset-0 pointer-events-none ${className}`}>
      <div
        style={{
          position: 'absolute',
          left: left,
          top: top,
          width: width,
          height: height,
          border: '2px solid rgba(255, 255, 0, 0.8)',
          backgroundColor: 'rgba(255, 255, 0, 0.1)',
          pointerEvents: 'none'
        }}
      />
    </div>
  );
}