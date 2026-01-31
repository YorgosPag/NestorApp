'use client';

import React, { useRef, useMemo } from 'react';
import { useCursor } from '../../systems/cursor';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { PANEL_LAYOUT } from '../../config/panel-tokens';
// 🏢 ADR-081: Centralized percentage formatting
// 🏢 ADR-090: Centralized Number Formatting
import { formatPercent, formatDistance } from '../../rendering/entities/shared/distance-label-utils';
// 🏢 ADR-082: Step-by-step tool hints
import { useToolHints } from '../../hooks/useToolHints';
import type { ToolType } from './types';
import type { Point2D } from '../../rendering/types/Types';

interface ToolbarStatusBarProps {
  activeTool: ToolType;
  currentZoom: number;
  snapEnabled: boolean;
  commandCount?: number;
  mouseCoordinates?: Point2D | null;
  showCoordinates?: boolean;
}

export const ToolbarStatusBar: React.FC<ToolbarStatusBarProps> = ({
  activeTool,
  currentZoom,
  snapEnabled,
  commandCount = 0,
  mouseCoordinates = null,
  showCoordinates = false
}) => {
  const { settings } = useCursor();
  const { getDirectionalBorder } = useBorderTokens();
  const colors = useSemanticColors();

  // 🏢 ADR-082: Tool hints system
  const { hint, currentStepText, hasHints, isReady } = useToolHints(activeTool);

  // Λειτουργία ακρίβειας: περισσότερα δεκαδικά ψηφία
  const precision = settings.performance.precision_mode ? 4 : 2;

  // ✅ Throttle coordinate updates για performance
  const lastCoordinatesRef = useRef<Point2D | null>(null);

  const throttledCoordinates = useMemo(() => {
    if (!mouseCoordinates) return null;

    // Only update if coordinates changed significantly (>1px)
    if (lastCoordinatesRef.current &&
        Math.abs(lastCoordinatesRef.current.x - mouseCoordinates.x) < 1 &&
        Math.abs(lastCoordinatesRef.current.y - mouseCoordinates.y) < 1) {
      return lastCoordinatesRef.current;
    }

    lastCoordinatesRef.current = mouseCoordinates;
    return mouseCoordinates;
  }, [mouseCoordinates]);
  
  return (
    <div className={`${getDirectionalBorder('muted', 'top')} ${colors.bg.backgroundSecondary} ${PANEL_LAYOUT.SPACING.HORIZONTAL_MD} ${PANEL_LAYOUT.PADDING.VERTICAL_XS} ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted} flex justify-between items-center`}>
      <div className={`flex items-center ${PANEL_LAYOUT.GAP.LG}`}>
        <span>
          Tool: <strong className={`${colors.text.info}`}>
            {activeTool?.charAt(0)?.toUpperCase() + activeTool?.slice(1) || 'Unknown'}
          </strong>
        </span>
        
        <span className={`${colors.text.muted}`}>|</span>
        
        <span>
          Zoom: <strong className={`${colors.text.success}`}>
            {formatPercent(currentZoom)}
          </strong>
        </span>
        
        <span className={`${colors.text.muted}`}>|</span>
        
        <span>
          Snap: <strong className={snapEnabled ? `${colors.text.success}` : `${colors.text.error}`}>
            {snapEnabled ? 'ON' : 'OFF'}
          </strong>
        </span>
        
        {commandCount > 0 && (
          <>
            <span className={`${colors.text.muted}`}>|</span>
            <span>
              Commands: <strong className={`${colors.text.warning}`}>{commandCount}</strong>
            </span>
          </>
        )}

        {showCoordinates && (
          <>
            <span className={`${colors.text.muted}`}>|</span>
            <span>
              Συντεταγμένες: <strong className={`${colors.text.accent}`}>
                {throttledCoordinates ?
                  `X: ${formatDistance(throttledCoordinates.x, precision)}, Y: ${formatDistance(throttledCoordinates.y, precision)}` :
                  `X: ${formatDistance(0, precision)}, Y: ${formatDistance(0, precision)}`}
              </strong>
            </span>
          </>
        )}
      </div>
      
      {/* 🏢 ADR-082: Dynamic tool hints section */}
      <div className={`flex items-center ${PANEL_LAYOUT.GAP.SM} ${colors.text.muted}`}>
        {hasHints && isReady ? (
          <>
            {/* Current step instruction */}
            <span className={`${colors.text.primary} font-medium`}>
              {currentStepText}
            </span>
            {/* Tool shortcuts */}
            {hint?.shortcuts && (
              <>
                <span className={`${colors.text.muted}`}>|</span>
                <span className="text-xs">
                  {hint.shortcuts}
                </span>
              </>
            )}
          </>
        ) : (
          /* Fallback: generic shortcuts */
          <span>D=Ruler | W=ZoomWindow | +/-=Zoom | F9=Grid | ESC=Cancel</span>
        )}
      </div>
    </div>
  );
};
