'use client';
import React from 'react';
import type { Point2D } from '../../rendering/types/Types';
// Enterprise Canvas UI Migration - Phase B
import { portalComponents, layoutUtilities } from '@/styles/design-tokens';
import { canvasUI } from '@/styles/design-tokens/canvas';

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
      <div style={{
        position: 'absolute',
        left: point.x - 4,
        top: point.y - 4,
        width: 8,
        height: 8,
        border: '2px solid #00ff00',
        borderRadius: '50%',
        pointerEvents: 'none'
      }} />
    </div>
  );
}