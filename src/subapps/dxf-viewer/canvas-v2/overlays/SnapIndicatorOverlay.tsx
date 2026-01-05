'use client';
import React from 'react';
import type { Point2D } from '../../rendering/types/Types';
import type { ViewTransform } from '../../systems/rulers-grid/config';
// 🏢 ENTERPRISE: Centralized design tokens for overlay colors
import { canvasUI } from '@/styles/design-tokens/canvas';
import { portalComponents } from '@/styles/design-tokens';  // ✅ ENTERPRISE: Centralized z-index hierarchy
// 🏢 ENTERPRISE: Centralized layout tokens (ADR-013)
import { PANEL_LAYOUT } from '../../config/panel-tokens';

interface SnapResult {
  point: Point2D;
  type: string;
}

interface SnapIndicatorOverlayProps {
  snapResult?: SnapResult | null;
  viewport: { width: number; height: number };
  canvasRect: DOMRect | null;
  transform?: ViewTransform;  // ✅ ENTERPRISE: Proper type instead of any
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
      {/* 🏢 ENTERPRISE: Centralized snap indicator tokens (ADR-013) */}
      <div
        className={`absolute ${PANEL_LAYOUT.SNAP_INDICATOR.SIZE} ${PANEL_LAYOUT.SNAP_INDICATOR.BORDER} border-solid rounded-full ${PANEL_LAYOUT.POINTER_EVENTS.NONE}`}
        style={{
          left: point.x - PANEL_LAYOUT.SNAP_INDICATOR.OFFSET_PX,
          top: point.y - PANEL_LAYOUT.SNAP_INDICATOR.OFFSET_PX,
          borderColor: canvasUI.overlay.colors.snap.border,
          boxShadow: canvasUI.overlay.colors.snap.glow
        }}
      />
    </div>
  );
}