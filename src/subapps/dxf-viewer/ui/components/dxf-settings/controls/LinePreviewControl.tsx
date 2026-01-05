/**
 * LINE PREVIEW CONTROL Component
 * Live preview του line style
 * OPTIMIZED: React.memo για conference performance
 */

import React, { useMemo } from 'react';
import type { LineSettings } from '../../../../settings-core/types';
import { getDashArray } from '../../../../settings-core/defaults';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { UI_COLORS } from '../../../../config/color-config';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { PANEL_LAYOUT } from '../../../../config/panel-tokens';

interface LinePreviewControlProps {
  settings: Partial<LineSettings>;
  height?: number;
  label?: string;
}

const LinePreviewControlComponent: React.FC<LinePreviewControlProps> = ({
  settings,
  height = 40,
  label = 'Preview',
}) => {
  const { getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();
  const getDashArrayForSvg = useMemo(() => (type?: string, scale: number = 1): string => {
    const result = getDashArray(type || 'solid', scale);
    return result.length > 0 ? result.join(',') : '';
  }, []);

  // Memoize dash array calculation
  const dashArray = useMemo(
    () => getDashArrayForSvg(settings.lineType, settings.dashScale),
    [getDashArrayForSvg, settings.lineType, settings.dashScale]
  );

  // Memoize stroke width calculation
  const strokeWidth = useMemo(
    () => (settings.lineWidth || 0.25) * 4,
    [settings.lineWidth]
  );

  return (
    <div className={PANEL_LAYOUT.SPACING.GAP_SM}>
      {label && (
        <label className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.secondary}`}>
          {label}
        </label>
      )}

      <div
        className={`${colors.bg.backgroundSecondary} rounded ${getStatusBorder('muted')} ${PANEL_LAYOUT.SPACING.LG} flex items-center justify-center`}
        style={{ height }}
      >
        {settings.enabled !== false ? (
          <svg width="100%" height="100%" className="overflow-visible">
            {/* Main line */}
            <line
              x1="10%"
              y1="50%"
              x2="90%"
              y2="50%"
              stroke={settings.color || UI_COLORS.WHITE}
              strokeWidth={strokeWidth}
              strokeOpacity={settings.opacity || 1}
              strokeDasharray={dashArray}
              strokeLinecap={settings.lineCap || 'butt'}
              strokeLinejoin={settings.lineJoin || 'miter'}
              className="transition-all duration-150"
            />

            {/* Start point marker */}
            <circle
              cx="10%"
              cy="50%"
              r="3"
              fill={settings.color || UI_COLORS.WHITE}
              opacity={settings.opacity || 1}
            />

            {/* End point marker */}
            <circle
              cx="90%"
              cy="50%"
              r="3"
              fill={settings.color || UI_COLORS.WHITE}
              opacity={settings.opacity || 1}
            />
          </svg>
        ) : (
          <div className={`${colors.text.muted} ${PANEL_LAYOUT.TYPOGRAPHY.SM} italic`}>
            Γραμμή απενεργοποιημένη
          </div>
        )}
      </div>

      {/* Info text */}
      <div className={`flex items-center justify-between ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted}`}>
        <span>{settings.enabled !== false ? (settings.lineType || 'solid') : 'Απενεργοποιημένη'}</span>
        <span>{(settings.lineWidth || 0.25).toFixed(2)}mm</span>
        <span>{settings.color || UI_COLORS.WHITE}</span>
      </div>
    </div>
  );
};

// Export με React.memo για performance optimization
export const LinePreviewControl = React.memo(
  LinePreviewControlComponent,
  (prevProps, nextProps) => {
    // Custom comparison για fine-grained optimization
    return (
      prevProps.settings.enabled === nextProps.settings.enabled &&
      prevProps.settings.lineWidth === nextProps.settings.lineWidth &&
      prevProps.settings.color === nextProps.settings.color &&
      prevProps.settings.lineType === nextProps.settings.lineType &&
      prevProps.settings.opacity === nextProps.settings.opacity &&
      prevProps.settings.dashScale === nextProps.settings.dashScale &&
      prevProps.height === nextProps.height &&
      prevProps.label === nextProps.label
    );
  }
);