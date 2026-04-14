'use client';
import React from 'react';
import type { Point2D } from '../../rendering/types/Types';
// Enterprise Canvas UI Migration - Phase B
import { portalComponents } from '@/styles/design-tokens';
import { canvasUI } from '@/styles/design-tokens/canvas';
// 🏢 ENTERPRISE: Centralized layout tokens (ADR-013)
import { PANEL_LAYOUT } from '../../config/panel-tokens';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from 'react-i18next';

interface CursorTooltipOverlayProps {
  isActive: boolean;
  cursorPosition: Point2D | null;
  activeTool: string;
  canvasRect: DOMRect | null;
  className?: string;
}

// 🏢 ENTERPRISE: Tool key mapping for i18n
const TOOL_I18N_KEYS: Record<string, string> = {
  'line': 'line',
  'rectangle': 'rectangle',
  'circle': 'circle',
  'pan': 'pan',
  'zoom-window': 'zoomWindow',
  'layering': 'layering'
} as const;

export default function CursorTooltipOverlay({
  isActive,
  cursorPosition,
  activeTool,
  canvasRect,
  className = ''
}: CursorTooltipOverlayProps) {
  // 🌐 i18n
  const { t } = useTranslation(['dxf-viewer', 'dxf-viewer-settings', 'dxf-viewer-wizard', 'dxf-viewer-guides', 'dxf-viewer-panels', 'dxf-viewer-shell']);

  if (!isActive || !cursorPosition || activeTool === 'select') return null;

  // 🏢 ENTERPRISE: Get translated tool label
  const i18nKey = TOOL_I18N_KEYS[activeTool];
  const label = i18nKey ? t(`toolLabels.${i18nKey}`) : activeTool;

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