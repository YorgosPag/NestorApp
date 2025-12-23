'use client';

import React from 'react';
import { Button } from "../../../../components/ui/button";
import { CommonBadge } from '../../../../core/badges';
import { Eye, Maximize, RotateCcw } from "lucide-react";
import type { DXFViewerLayoutProps } from '../../integration/types';
import { HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';
import { useIconSizes } from '@/hooks/useIconSizes';

type StatusBarProps = Pick<
  DXFViewerLayoutProps,
  'status' | 'entities' | 'selectedEntityIds' | 'drawingState' |
  'activeTool' | 'snapEnabled' | 'measurements' | 'onViewModeChange' | 'onClear'
>;

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
  return (
  <div className="flex gap-2 p-2 items-center bg-gray-800 border-b border-gray-600">
    <Button
      variant="outline"
      size="sm"
      className={`bg-gray-700 ${HOVER_BACKGROUND_EFFECTS.LIGHT} text-white border-gray-600`}
      onClick={() => onViewModeChange('normal')}
    >
      <Eye className={`${iconSizes.sm} mr-2`} />
      Normal
    </Button>
    <Button
      variant="outline"
      size="sm"
      className={`bg-gray-700 ${HOVER_BACKGROUND_EFFECTS.LIGHT} text-white border-gray-600`}
      onClick={() => onViewModeChange('fullscreen')}
    >
      <Maximize className={`${iconSizes.sm} mr-2`} />
      Fullscreen
    </Button>
    <Button 
      variant="outline" 
      size="sm" 
      className={`bg-gray-700 ${HOVER_BACKGROUND_EFFECTS.LIGHT} text-white border-gray-600`}
      onClick={onClear}
    >
      <RotateCcw className={`${iconSizes.sm} mr-2`} />
      Clear
    </Button>
    
    <div className="w-px h-6 bg-gray-700 mx-2" />
    
    {/* Status indicators */}
    <div className="flex-1 flex gap-2 items-center">
        {status === 'success' && (
          <CommonBadge
            status="company"
            customLabel={`✅ DXF (${entities.length} entities)`}
            variant="secondary"
            className="bg-green-600 text-white"
          />
        )}
        
        {selectedEntityIds.length > 0 && (
          <CommonBadge
            status="company"
            customLabel={`🔺 Selected: ${selectedEntityIds.length}`}
            variant="secondary"
            className="bg-blue-600 text-white"
          />
        )}
        
        {drawingState.isDrawing && (
          <CommonBadge
            status="company"
            customLabel={`✏️ Drawing ${activeTool}...${drawingState.currentPoints.length > 0 ? ` (${drawingState.currentPoints.length} points)` : ''}`}
            variant="secondary"
            className="bg-yellow-600 text-white"
          />
        )}
        
        {activeTool.startsWith('measure') && (
          <CommonBadge
            status="company"
            customLabel="📏 Ruler active"
            variant="secondary"
            className="bg-purple-600 text-white"
          />
        )}
        
        {activeTool === 'zoom-window' && (
          <CommonBadge
            status="company"
            customLabel="🔹 Zoom Window"
            variant="secondary"
            className="bg-orange-600 text-white"
          />
        )}
        
        {snapEnabled && drawingState.snapPoint && (
          <CommonBadge
            status="company"
            customLabel={`🧲 Snap: ${drawingState.snapType}`}
            variant="secondary"
            className="bg-green-600 text-white"
          />
        )}
        
        {measurements.length > 0 && (
          <CommonBadge
            status="company"
            customLabel={`📏 Measurements: ${measurements.length}`}
            variant="secondary"
            className="bg-indigo-600 text-white"
          />
        )}
    </div>

    {activeTool === 'select' && (
        <div className="text-xs text-gray-400">
            <strong>SELECT</strong> - Ctrl/Shift + Click για πολλαπλή επιλογή
        </div>
    )}
  </div>
  );
};
