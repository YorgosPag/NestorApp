'use client';
import React from 'react';
import type { Point2D } from '../../rendering/types/Types';
// 🏢 ENTERPRISE: Centralized design tokens for overlay colors
import { canvasUI } from '@/styles/design-tokens/canvas';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { PANEL_LAYOUT } from '../../config/panel-tokens';
// 🏢 ADR-080: Centralized Rectangle Bounds
import { rectFromTwoPoints } from '../../rendering/entities/shared/geometry-rendering-utils';

// 🏢 ENTERPRISE: Type-safe preview rect structure
interface PreviewRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface ZoomWindowState {
  isActive: boolean;
  isDragging: boolean;
  startPoint: Point2D | null;
  currentPoint: Point2D | null;
  previewRect: PreviewRect | null;
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

  // 🏢 ADR-080: Centralized Rectangle Bounds
  const { x: left, y: top, width, height } = rectFromTwoPoints(startPoint, currentPoint);

  return (
    <div className={`absolute ${PANEL_LAYOUT.INSET['0']} ${PANEL_LAYOUT.POINTER_EVENTS.NONE} ${className}`}>
      <div
        className="absolute border-2 border-solid ${PANEL_LAYOUT.POINTER_EVENTS.NONE}"
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