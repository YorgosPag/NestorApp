'use client';
import React from 'react';
import type { Point2D } from '../../rendering/types/Types';
import { portalComponents } from '@/styles/design-tokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { PANEL_LAYOUT } from '../../config/panel-tokens';
// 🏢 ADR-124: Centralized label offsets
import { TEXT_LABEL_OFFSETS } from '../../config/text-rendering-config';

// 🏢 ENTERPRISE NOTE: This component uses a simplified SnapResult interface
// TODO: Migrate to use ProSnapResult.activeMode instead of type when refactoring
interface SnapResult {
  point: Point2D;
  type: string;
}

interface SnapModeIndicatorProps {
  snapResult?: SnapResult | null;
  mouseCss: Point2D | null;
  enabledModes: Set<string>;
  className?: string;
}

export default function SnapModeIndicator({
  snapResult,
  mouseCss,
  enabledModes,
  className = ''
}: SnapModeIndicatorProps) {
  const colors = useSemanticColors();
  if (!snapResult || !mouseCss) return null;

  return (
    <div className={`absolute ${PANEL_LAYOUT.INSET['0']} ${PANEL_LAYOUT.POINTER_EVENTS.NONE} ${className}`}>
      <div
        className={`absolute ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.warning} ${colors.bg.overlay} ${PANEL_LAYOUT.SPACING.COMPACT_XS} rounded`}
        style={{
          left: mouseCss.x + 10,
          // 🏢 ADR-124: Centralized circle/cursor label offset
          top: mouseCss.y - TEXT_LABEL_OFFSETS.CIRCLE_LABEL,
          zIndex: portalComponents.zIndex.tooltip + 1
        }}
      >
        {snapResult.type}
      </div>
    </div>
  );
}