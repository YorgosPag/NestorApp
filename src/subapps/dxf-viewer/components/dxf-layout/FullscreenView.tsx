
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
import { ToolbarSection } from './ToolbarSection';
import { CanvasSection } from './CanvasSection';

/**
 * Renders the DXF viewer in a fullscreen, immersive layout.
 */
export const FullscreenView: React.FC<DXFViewerLayoutProps> = (props) => {
  const iconSizes = useIconSizes();
  const { quick, getDirectionalBorder } = useBorderTokens();
  const colors = useSemanticColors();
  return (
  <div className={`fixed inset-0 z-50 ${colors.bg.accent} flex flex-col`}>
    <ToolbarSection {...props} />
    <div className={`flex justify-between items-center p-2 ${colors.bg.secondary} ${getDirectionalBorder('muted', 'bottom')}`}>
      <div className="flex gap-2 items-center">
        <Button
          variant="outline"
          size="sm"
          className={`${colors.bg.muted} ${HOVER_BACKGROUND_EFFECTS.LIGHT} ${colors.text.inverted} ${quick.muted}`}
          onClick={() => props.handleAction('setViewMode', 'normal')}
        >
          <Minimize className={`${iconSizes.sm} mr-2`} />
          Exit Fullscreen
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          className={`${colors.bg.muted} ${HOVER_BACKGROUND_EFFECTS.LIGHT} ${colors.text.inverted} ${quick.muted}`}
          onClick={() => props.handleAction('clear')}
        >
          <RotateCcw className={`${iconSizes.sm} mr-2`} />
          Clear
        </Button>
      </div>
      
      <div className="flex gap-2 items-center">
        {props.currentScene && (
          <CommonBadge
            status="company"
            customLabel={`✅ DXF Active (${props.currentScene.entities.length} entities)`}
            variant="secondary"
            className={`${colors.bg.success} ${colors.text.inverted}`}
          />
        )}
        
        {props.selectedEntityIds.length > 0 && (
          <CommonBadge
            status="company"
            customLabel={`🔺 Selected: ${props.selectedEntityIds.length}`}
            variant="secondary"
            className={`${colors.bg.info} ${colors.text.inverted}`}
          />
        )}
        
      </div>
    </div>
    
    <div className="flex-1 flex overflow-hidden">
       <CanvasSection {...props} />
    </div>
  </div>
  );
};
