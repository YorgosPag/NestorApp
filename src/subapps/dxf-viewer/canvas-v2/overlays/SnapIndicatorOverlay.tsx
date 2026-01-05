'use client';
import React from 'react';
import type { Point2D } from '../../rendering/types/Types';
// 🏢 ENTERPRISE: Centralized design tokens for overlay colors
import { canvasUI } from '@/styles/design-tokens/canvas';
import { portalComponents } from '@/styles/design-tokens';  // ✅ ENTERPRISE: Centralized z-index hierarchy

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
    <div className={className} style={{ zIndex: portalComponents.overlay.snap.zIndex() }}>
      <div
        className="absolute w-2 h-2 border-2 border-solid rounded-full pointer-events-none"
        style={{
          left: point.x - 4,
          top: point.y - 4,
          borderColor: canvasUI.overlay.colors.snap.border,
          boxShadow: canvasUI.overlay.colors.snap.glow
        }}
      />
    </div>
  );
}