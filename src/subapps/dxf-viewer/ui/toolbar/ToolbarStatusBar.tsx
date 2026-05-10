'use client';

import React from 'react';
import { useCursor } from '../../systems/cursor';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { PANEL_LAYOUT } from '../../config/panel-tokens';
import { ICON_CLICK_COLORS } from '../../config/color-config';
import { useTranslation } from '@/i18n';
// 🏢 ADR-081: Centralized percentage formatting
// 🏢 ADR-090: Centralized Number Formatting
import { formatPercent } from '../../rendering/entities/shared/distance-label-utils';
// 🏢 ADR-082: Step-by-step tool hints
import { useToolHints } from '../../hooks/useToolHints';
// ADR-040 Phase H: leaf subscriber for live cursor coordinates
import { ToolbarCoordinatesDisplay } from './ToolbarCoordinatesDisplay';
import type { ToolType } from './types';

interface ToolbarStatusBarProps {
  activeTool: ToolType;
  currentZoom: number;
  snapEnabled: boolean;
  commandCount?: number;
  showCoordinates?: boolean;
  /** ADR-176: Compact mode — shows only tool name + zoom percentage */
  compact?: boolean;
}

export const ToolbarStatusBar: React.FC<ToolbarStatusBarProps> = ({
  activeTool,
  currentZoom,
  snapEnabled,
  commandCount = 0,
  showCoordinates = false,
  compact = false,
}) => {
  const { t } = useTranslation(['dxf-viewer', 'dxf-viewer-settings', 'dxf-viewer-wizard', 'dxf-viewer-guides', 'dxf-viewer-panels', 'dxf-viewer-shell']);
  const { settings } = useCursor();
  const { getDirectionalBorder } = useBorderTokens();
  const colors = useSemanticColors();

  // 🏢 ADR-082: Tool hints system
  const { hint, currentStepText, currentStep, totalSteps, hasHints, isReady } = useToolHints(activeTool);
  const stepColor = currentStep === 0
    ? ICON_CLICK_COLORS.FIRST
    : currentStep >= totalSteps - 1
      ? ICON_CLICK_COLORS.THIRD
      : ICON_CLICK_COLORS.SECOND;

  // Λειτουργία ακρίβειας: περισσότερα δεκαδικά ψηφία
  const precision = settings.performance.precision_mode ? 4 : 2;

  const toolLabelMap: Partial<Record<ToolType, string>> = {
    select: 'tools.select',
    pan: 'tools.pan',
    'zoom-in': 'tools.zoomIn',
    'zoom-out': 'tools.zoomOut',
    'zoom-window': 'tools.zoomWindow',
    'zoom-extents': 'tools.zoomExtents',
    line: 'tools.line',
    rectangle: 'tools.rectangle',
    circle: 'tools.circle',
    'circle-diameter': 'tools.circleDiameter',
    'circle-2p-diameter': 'tools.circle2pDiameter',
    'circle-3p': 'tools.circle3p',
    'circle-chord-sagitta': 'tools.circleChordSagitta',
    'circle-2p-radius': 'tools.circle2pRadius',
    'circle-best-fit': 'tools.circleBestFit',
    'circle-ttt': 'tools.circleTTT',
    arc: 'tools.arc',
    'arc-3p': 'tools.arc3p',
    'arc-cse': 'tools.arcCenterStartEnd',
    'arc-sce': 'tools.arcStartCenterEnd',
    'line-perpendicular': 'tools.linePerpendicular',
    'line-parallel': 'tools.lineParallel',
    polyline: 'tools.polyline',
    polygon: 'tools.polygon',
    move: 'tools.move',
    copy: 'tools.copy',
    delete: 'tools.delete',
    'measure-distance': 'tools.measureDistance',
    'measure-distance-continuous': 'tools.measureDistanceContinuous',
    'measure-area': 'tools.measureArea',
    'measure-angle': 'tools.measureAngle',
    'measure-angle-line-arc': 'tools.measureAngleLineArc',
    'measure-angle-two-arcs': 'tools.measureAngleTwoArcs',
    'measure-angle-measuregeom': 'tools.measureAngleMeasuregeom',
    'measure-angle-constraint': 'tools.measureAngleConstraint',
    layering: 'tools.layering',
    'grip-edit': 'tools.gripEdit'
  };
  const toolLabelKey = toolLabelMap[activeTool];
  const toolLabel = toolLabelKey ? t(toolLabelKey) : activeTool || t('toolbarStatus.unknownTool');
  
  // ADR-176: Compact mode — only tool + zoom
  if (compact) {
    return (
      <div className={`${getDirectionalBorder('muted', 'top')} ${colors.bg.backgroundSecondary} ${PANEL_LAYOUT.SPACING.HORIZONTAL_SM} ${PANEL_LAYOUT.PADDING.VERTICAL_XS} ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted} flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
        <span>
          {t('toolbarStatus.tool')}: <strong className={colors.text.info}>{toolLabel}</strong>
        </span>
        <span className={colors.text.muted}>|</span>
        <span>
          {t('toolbarStatus.zoom')}: <strong className={colors.text.success}>{formatPercent(currentZoom)}</strong>
        </span>
      </div>
    );
  }

  return (
    <div className={`${getDirectionalBorder('muted', 'top')} ${colors.bg.backgroundSecondary} ${PANEL_LAYOUT.SPACING.HORIZONTAL_MD} ${PANEL_LAYOUT.PADDING.VERTICAL_XS} ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted} flex justify-between items-center`}>
      <div className={`flex items-center ${PANEL_LAYOUT.GAP.LG}`}>
        <span>
          {t('toolbarStatus.tool')}: <strong className={`${colors.text.info}`}>
            {toolLabel}
          </strong>
        </span>

        <span className={`${colors.text.muted}`}>|</span>

        <span>
          {t('toolbarStatus.zoom')}: <strong className={`${colors.text.success}`}>
            {formatPercent(currentZoom)}
          </strong>
        </span>

        <span className={`${colors.text.muted}`}>|</span>

        <span>
          {t('toolbarStatus.snap')}: <strong className={snapEnabled ? `${colors.text.success}` : `${colors.text.error}`}>
            {snapEnabled ? t('toolbarStatus.on') : t('toolbarStatus.off')}
          </strong>
        </span>
        
        {commandCount > 0 && (
          <>
            <span className={`${colors.text.muted}`}>|</span>
            <span>
              {t('toolbarStatus.commands')}: <strong className={`${colors.text.warning}`}>{commandCount}</strong>
            </span>
          </>
        )}

        {showCoordinates && (
          <>
            <span className={`${colors.text.muted}`}>|</span>
            <span>
              {t('toolbarStatus.coordinates')}:{' '}
              <ToolbarCoordinatesDisplay
                precision={precision}
                className={colors.text.accent}
              />
            </span>
          </>
        )}
      </div>
      
      {/* 🏢 ADR-082: Dynamic tool hints section */}
      <div className={`flex items-center ${PANEL_LAYOUT.GAP.SM} ${colors.text.muted}`}>
        {hasHints && isReady ? (
          <>
            {/* Current step instruction — colored to match grip dot (ADR-142) */}
            <span className="font-medium" style={{ color: stepColor }}>
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
          <span>{t('toolbarStatus.shortcutsFallback')}</span>
        )}
      </div>
    </div>
  );
};
