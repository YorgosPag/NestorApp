
'use client';

import React from 'react';
import { Button } from "../../../../components/ui/button";
import { CommonBadge } from '../../../../core/badges';
import { RotateCcw, Minimize } from "lucide-react";
import type { DXFViewerLayoutProps } from '../../integration/types';
import { HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { CanvasSection } from './CanvasSection';
import { PANEL_LAYOUT } from '../../config/panel-tokens';
import { StandaloneStatusBar } from '../../ui/toolbar/StandaloneStatusBar';

export const FullscreenView: React.FC<DXFViewerLayoutProps> = (props) => {
  const iconSizes = useIconSizes();
  const { quick, getDirectionalBorder } = useBorderTokens();
  const colors = useSemanticColors();

  return (
  <div className={`fixed ${PANEL_LAYOUT.INSET['0']} ${PANEL_LAYOUT.Z_INDEX['50']} ${colors.bg.accent} flex flex-col`}>
    <StandaloneStatusBar
      activeTool={props.activeTool}
      onToolChange={props.onToolChange}
      onAction={props.onAction}
    />
    <div className={`flex justify-between items-center ${PANEL_LAYOUT.SPACING.SM} ${colors.bg.secondary} ${getDirectionalBorder('muted', 'bottom')}`}>
      <div className={`flex ${PANEL_LAYOUT.GAP.SM} items-center`}>
        <Button
          variant="outline"
          size="sm"
          className={`${colors.bg.muted} ${HOVER_BACKGROUND_EFFECTS.LIGHT} ${colors.text.inverted} ${quick.muted}`}
          onClick={() => props.handleAction('setViewMode', 'normal')}
        >
          <Minimize className={`${iconSizes.sm} ${PANEL_LAYOUT.MARGIN.RIGHT_SM}`} />
          Exit Fullscreen
        </Button>
        <Button
          variant="outline"
          size="sm"
          className={`${colors.bg.muted} ${HOVER_BACKGROUND_EFFECTS.LIGHT} ${colors.text.inverted} ${quick.muted}`}
          onClick={() => props.handleAction('clear')}
        >
          <RotateCcw className={`${iconSizes.sm} ${PANEL_LAYOUT.MARGIN.RIGHT_SM}`} />
          Clear
        </Button>
      </div>

      <div className={`flex ${PANEL_LAYOUT.GAP.SM} items-center`}>
        {props.currentScene && (
          <CommonBadge
            status="company"
            customLabel={`✅ DXF Active (${props.currentScene.entities.length} entities)`}
            variant="secondary"
            className={`${colors.bg.primary} ${colors.text.inverted}`}
          />
        )}

        {props.selectedEntityIds.length > 0 && (
          <CommonBadge
            status="company"
            customLabel={`🔺 Selected: ${props.selectedEntityIds.length}`}
            variant="secondary"
            className={`${colors.bg.secondary} ${colors.text.inverted}`}
          />
        )}

      </div>
    </div>

    <div className={`flex-1 flex ${PANEL_LAYOUT.OVERFLOW.HIDDEN}`}>
       <CanvasSection
          {...props}
          overlayMode="draw"
          currentStatus="for-sale"
          currentKind="property"
        />
    </div>
  </div>
  );
};
