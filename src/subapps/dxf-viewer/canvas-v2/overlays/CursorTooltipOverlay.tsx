'use client';
import React from 'react';
import type { Point2D } from '../../rendering/types/Types';
// Enterprise Canvas UI Migration - Phase B
import { portalComponents, layoutUtilities } from '@/styles/design-tokens';
import { canvasUI } from '@/styles/design-tokens/canvas';
// 🏢 ENTERPRISE: Centralized layout tokens (ADR-013)
import { PANEL_LAYOUT } from '../../config/panel-tokens';

interface CursorTooltipOverlayProps {
  isActive: boolean;
  cursorPosition: Point2D | null;
  activeTool: string;
  canvasRect: DOMRect | null;
  className?: string;
}

export default function CursorTooltipOverlay({
  isActive,
  cursorPosition,
  activeTool,
  canvasRect,
  className = ''
}: CursorTooltipOverlayProps) {
  if (!isActive || !cursorPosition || activeTool === 'select') return null;

  const toolLabels: { [key: string]: string } = {
    'line': 'Γραμμή',
    'rectangle': 'Ορθογώνιο',
    'circle': 'Κύκλος',
    'pan': 'Μετακίνηση',
    'zoom-window': 'Παράθυρο Zoom',
    'layering': 'Επίπεδα'
  };

  const label = toolLabels[activeTool] || activeTool;

  return (
    // 🏢 ENTERPRISE: pointer-events-none για να μην εμποδίζει mouse events στο canvas κάτω
    <div
      className={`${className} ${PANEL_LAYOUT.POINTER_EVENTS.NONE}`}
      style={{ zIndex: portalComponents.overlay.tooltip.zIndex() }}
    >
      <div style={canvasUI.positioning.tooltip.positioned(cursorPosition.x, cursorPosition.y)}>
        {label}
      </div>
    </div>
  );
}