'use client';
import React from 'react';
import type { Point2D } from '../../rendering/types/Types';
import { portalComponents, layoutUtilities, canvasUtilities } from '@/styles/design-tokens';

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
    <div className={className} style={portalComponents.overlay.fullscreen}>
      <div style={canvasUtilities.overlays.snapIndicator.point(point.x, point.y)} />
    </div>
  );
}