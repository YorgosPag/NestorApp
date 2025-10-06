'use client';

import React from 'react';
import { Button } from "../../../../components/ui/button";
import { Badge } from '../../../../components/ui/badge';
import { Eye, Maximize, RotateCcw } from "lucide-react";
import type { DXFViewerLayoutProps } from '../../integration/types';

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
}) => (
  <div className="flex gap-2 p-2 items-center bg-gray-800 border-b border-gray-600">
    <Button
      variant="outline"
      size="sm"
      className="bg-gray-700 hover:bg-gray-600 text-white border-gray-600"
      onClick={() => onViewModeChange('normal')}
    >
      <Eye className="w-4 h-4 mr-2" />
      Normal
    </Button>
    <Button
      variant="outline"
      size="sm"
      className="bg-gray-700 hover:bg-gray-600 text-white border-gray-600"
      onClick={() => onViewModeChange('fullscreen')}
    >
      <Maximize className="w-4 h-4 mr-2" />
      Fullscreen
    </Button>
    <Button 
      variant="outline" 
      size="sm" 
      className="bg-gray-700 hover:bg-gray-600 text-white border-gray-600"
      onClick={onClear}
    >
      <RotateCcw className="w-4 h-4 mr-2" />
      Clear
    </Button>
    
    <div className="w-px h-6 bg-gray-700 mx-2" />
    
    {/* Status indicators */}
    <div className="flex-1 flex gap-2 items-center">
        {status === 'success' && (
          <Badge variant="secondary" className="bg-green-600 text-white">
            ✅ DXF ({entities.length} entities)
          </Badge>
        )}
        
        {selectedEntityIds.length > 0 && (
          <Badge variant="secondary" className="bg-blue-600 text-white">
            🔺 Selected: {selectedEntityIds.length}
          </Badge>
        )}
        
        {drawingState.isDrawing && (
          <Badge variant="secondary" className="bg-yellow-600 text-white">
            ✏️ Drawing {activeTool}... {drawingState.currentPoints.length > 0 && `(${drawingState.currentPoints.length} points)`}
          </Badge>
        )}
        
        {activeTool.startsWith('measure') && (
          <Badge variant="secondary" className="bg-purple-600 text-white">
            📏 Ruler active
          </Badge>
        )}
        
        {activeTool === 'zoom-window' && (
          <Badge variant="secondary" className="bg-orange-600 text-white">
            🔹 Zoom Window
          </Badge>
        )}
        
        {snapEnabled && drawingState.snapPoint && (
          <Badge variant="secondary" className="bg-green-600 text-white">
            🧲 Snap: {drawingState.snapType}
          </Badge>
        )}
        
        {measurements.length > 0 && (
          <Badge variant="secondary" className="bg-indigo-600 text-white">
            📏 Measurements: {measurements.length}
          </Badge>
        )}
    </div>

    {activeTool === 'select' && (
        <div className="text-xs text-gray-400">
            <strong>SELECT</strong> - Ctrl/Shift + Click για πολλαπλή επιλογή
        </div>
    )}
  </div>
);
