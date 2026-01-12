'use client';

import React from 'react';
import { Button } from "../../../../components/ui/button";
import { CommonBadge } from '../../../../core/badges';
import { Eye, Maximize, RotateCcw } from "lucide-react";
import type { DXFViewerLayoutProps } from '../../integration/types';
import { HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { PANEL_LAYOUT } from '../../config/panel-tokens';  // ✅ ENTERPRISE: Centralized spacing tokens

// 🏢 ENTERPRISE: Type-safe measurement structure
interface Measurement {
  id: string;
  type: 'distance' | 'area' | 'angle';
  value: number;
  unit: string;
  label?: string;
}

type StatusBarProps = Pick<
  DXFViewerLayoutProps,
  'status' | 'entities' | 'selectedEntityIds' | 'drawingState' |
  'activeTool' | 'snapEnabled' | 'onViewModeChange' | 'onClear'
> & {
  measurements?: Measurement[];
};

/**
 * Renders the status bar below the toolbar, displaying contextual information.
 */
export const StatusBar: React.FC<StatusBarProps> = ({
  status,
  entities,
  selectedEntityIds,
  drawingState,
  activeTool,
  snapEnabled,
  measurements,
  onViewModeChange,
  onClear
}) => {
  const iconSizes = useIconSizes();
  const { getStatusBorder, getDirectionalBorder } = useBorderTokens();
  const colors = useSemanticColors();
  return (
  <div className={`flex ${PANEL_LAYOUT.GAP.SM} ${PANEL_LAYOUT.SPACING.SM} items-center ${colors.bg.secondary} ${getDirectionalBorder('muted', 'bottom')}`}>
    <Button
      variant="outline"
      size="sm"
      className={`${colors.bg.muted} ${HOVER_BACKGROUND_EFFECTS.LIGHT} ${colors.text.inverted} ${getStatusBorder('muted')}`}
      onClick={() => onViewModeChange('normal')}
    >
      <Eye className={`${iconSizes.sm} ${PANEL_LAYOUT.MARGIN.RIGHT_SM}`} />
      Normal
    </Button>
    <Button
      variant="outline"
      size="sm"
      className={`${colors.bg.muted} ${HOVER_BACKGROUND_EFFECTS.LIGHT} ${colors.text.inverted} ${getStatusBorder('muted')}`}
      onClick={() => onViewModeChange('fullscreen')}
    >
      <Maximize className={`${iconSizes.sm} ${PANEL_LAYOUT.MARGIN.RIGHT_SM}`} />
      Fullscreen
    </Button>
    <Button 
      variant="outline" 
      size="sm" 
      className={`${colors.bg.muted} ${HOVER_BACKGROUND_EFFECTS.LIGHT} ${colors.text.inverted} ${getStatusBorder('muted')}`}
      onClick={onClear}
    >
      <RotateCcw className={`${iconSizes.sm} ${PANEL_LAYOUT.MARGIN.RIGHT_SM}`} />
      Clear
    </Button>
    
    <div className={`w-px ${PANEL_LAYOUT.HEIGHT.LG} ${colors.bg.muted} ${PANEL_LAYOUT.MARGIN.X_SM}`} /> {/* w-px: Semantic separator dimensions */}
    
    {/* Status indicators */}
    <div className={`flex-1 flex ${PANEL_LAYOUT.GAP.SM} items-center`}>
        {status === 'success' && (
          <CommonBadge
            status="company"
            customLabel={`✅ DXF (${entities.length} entities)`}
            variant="secondary"
            className={`${colors.bg.success} ${colors.text.inverted}`}
          />
        )}
        
        {selectedEntityIds.length > 0 && (
          <CommonBadge
            status="company"
            customLabel={`🔺 Selected: ${selectedEntityIds.length}`}
            variant="secondary"
            className={`${colors.bg.info} ${colors.text.inverted}`}
          />
        )}
        
        {drawingState.isDrawing && (
          <CommonBadge
            status="company"
            customLabel={`✏️ Drawing ${activeTool}...${drawingState.currentPoints.length > 0 ? ` (${drawingState.currentPoints.length} points)` : ''}`}
            variant="secondary"
            className={`${colors.bg.warning} ${colors.text.inverted}`}
          />
        )}
        
        {activeTool.startsWith('measure') && (
          <CommonBadge
            status="company"
            customLabel="📏 Ruler active"
            variant="secondary"
            className={`${colors.bg.accent} ${colors.text.inverted}`}
          />
        )}
        
        {activeTool === 'zoom-window' && (
          <CommonBadge
            status="company"
            customLabel="🔹 Zoom Window"
            variant="secondary"
            className={`${colors.bg.warning} ${colors.text.inverted}`}
          />
        )}
        
        {snapEnabled && drawingState.snapPoint && (
          <CommonBadge
            status="company"
            customLabel={`🧲 Snap: ${drawingState.snapType}`}
            variant="secondary"
            className={`${colors.bg.success} ${colors.text.inverted}`}
          />
        )}
        
        {measurements && measurements.length > 0 && (
          <CommonBadge
            status="company"
            customLabel={`📏 Measurements: ${measurements.length}`}
            variant="secondary"
            className={`${colors.bg.info} ${colors.text.inverted}`}
          />
        )}
    </div>

    {activeTool === 'select' && (
        <div className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted}`}>
            <strong>SELECT</strong> - Ctrl/Shift + Click για πολλαπλή επιλογή
        </div>
    )}
  </div>
  );
};
