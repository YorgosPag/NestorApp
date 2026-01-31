'use client';
import React from 'react';
import type { Point2D } from '../../rendering/types/Types';
// 🏢 ENTERPRISE: Centralized design tokens for overlay colors
import { canvasUI } from '@/styles/design-tokens/canvas';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { PANEL_LAYOUT } from '../../config/panel-tokens';
// 🏢 ADR-080: Centralized Rectangle Bounds
import { rectFromTwoPoints } from '../../rendering/entities/shared/geometry-rendering-utils';

interface MarqueeState {
  active: boolean;
  start?: Point2D;
  end?: Point2D;
  kind?: 'window' | 'crossing';
}

interface SelectionState {
  marquee: MarqueeState;
  lasso: { active: boolean; points: Point2D[] };
}

interface SelectionMarqueeOverlayProps {
  state: SelectionState;
  className?: string;
}

export default function SelectionMarqueeOverlay({
  state,
  className = ''
}: SelectionMarqueeOverlayProps) {
  const { marquee } = state;

  if (!marquee.active || !marquee.start || !marquee.end) return null;

  // 🏢 ADR-080: Centralized Rectangle Bounds
  const { x: left, y: top, width, height } = rectFromTwoPoints(marquee.start, marquee.end);

  // 🏢 ENTERPRISE: Use centralized selection colors based on marquee kind
  const selectionColors = marquee.kind === 'window'
    ? canvasUI.overlay.colors.selection.window
    : canvasUI.overlay.colors.selection.crossing;

  return (
    <div className={`absolute ${PANEL_LAYOUT.INSET['0']} ${PANEL_LAYOUT.POINTER_EVENTS.NONE} ${className}`}>
      <div
        className="absolute border border-dashed ${PANEL_LAYOUT.POINTER_EVENTS.NONE}"
        style={{
          left,
          top,
          width,
          height,
          borderColor: selectionColors.border,
          backgroundColor: selectionColors.background
        }}
      />
    </div>
  );
}