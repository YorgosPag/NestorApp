'use client';
import React from 'react';
import type { Point2D } from '../../rendering/types/Types';
// 🏢 ENTERPRISE: Centralized design tokens for overlay colors
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
        className="absolute border-2 border-solid pointer-events-none"
        style={{
          left,
          top,
          width,
          height,
          borderColor: canvasUI.overlay.colors.zoom.border,
          backgroundColor: canvasUI.overlay.colors.zoom.background
        }}
      />
    </div>
  );
}