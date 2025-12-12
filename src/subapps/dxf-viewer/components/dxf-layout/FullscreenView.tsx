
'use client';

import React from 'react';
import { Button } from "../../../../components/ui/button";
import { CommonBadge } from '../../../../core/badges';
import { RotateCcw, Minimize } from "lucide-react";
import type { DXFViewerLayoutProps } from '../../integration/types';
import { HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';
import { ToolbarSection } from './ToolbarSection';
import { CanvasSection } from './CanvasSection';

/**
 * Renders the DXF viewer in a fullscreen, immersive layout.
 */
export const FullscreenView: React.FC<DXFViewerLayoutProps> = (props) => (
  <div className="fixed inset-0 z-50 bg-gray-900 flex flex-col">
    <ToolbarSection {...props} />
    <div className="flex justify-between items-center p-2 bg-gray-800 border-b border-gray-600">
      <div className="flex gap-2 items-center">
        <Button
          variant="outline"
          size="sm"
          className={`bg-gray-700 ${HOVER_BACKGROUND_EFFECTS.LIGHT} text-white border-gray-600`}
          onClick={() => props.handleAction('setViewMode', 'normal')}
        >
          <Minimize className="w-4 h-4 mr-2" />
          Exit Fullscreen
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          className={`bg-gray-700 ${HOVER_BACKGROUND_EFFECTS.LIGHT} text-white border-gray-600`}
          onClick={() => props.handleAction('clear')}
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Clear
        </Button>
      </div>
      
      <div className="flex gap-2 items-center">
        {props.currentScene && (
          <CommonBadge
            status="company"
            customLabel={`✅ DXF Active (${props.currentScene.entities.length} entities)`}
            variant="secondary"
            className="bg-green-600 text-white"
          />
        )}
        
        {props.selectedEntityIds.length > 0 && (
          <CommonBadge
            status="company"
            customLabel={`🔺 Selected: ${props.selectedEntityIds.length}`}
            variant="secondary"
            className="bg-blue-600 text-white"
          />
        )}
        
      </div>
    </div>
    
    <div className="flex-1 flex overflow-hidden">
       <CanvasSection {...props} />
    </div>
  </div>
);
