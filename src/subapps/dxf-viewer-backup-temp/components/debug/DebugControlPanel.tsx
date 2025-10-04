'use client';

/**
 * DEBUG CONTROL PANEL
 * Centralized debug controls for Canvas, Grid, Rulers, and Coordinate systems
 *
 * Extracted from DxfViewerContent.tsx to reduce complexity
 */

import React from 'react';
import type { ViewTransform } from '../../rendering/types/Types';

// Import all debug button components
import { CanvasVisibilityButtons } from './CanvasVisibilityButtons';
import { CanvasTestButton } from './CanvasTestButton';
import { LayeringWorkflowTestButton } from './LayeringWorkflowTestButton';
import { InspectDOMButton } from './InspectDOMButton';
import { CursorCrosshairTestButton } from './CursorCrosshairTestButton';
import { OriginMarkersToggleButton } from './OriginMarkersToggleButton';
import { PanToOriginButton } from './PanToOriginButton';
import { RulerDebugButton } from './RulerDebugButton';
import { SyncTestButton } from './SyncTestButton';
import { GridTestButton } from './GridTestButton';
import { MasterDiagnosticButton } from './MasterDiagnosticButton';
import { MarkPointsButton } from './MarkPointsButton';
import { FullReportButton } from './FullReportButton';

interface DebugControlPanelProps {
  // Notification system
  onNotify: (message: string, type: 'success' | 'info' | 'warning' | 'error') => void;

  // Canvas visibility controls
  dxfCanvasVisible: boolean;
  layerCanvasVisible: boolean;
  onDxfToggle: () => void;
  onLayerToggle: () => void;

  // Transform state
  canvasTransform: { scale: number; offsetX: number; offsetY: number };
  onTransformChange: (transform: ViewTransform) => void;
}

export const DebugControlPanel: React.FC<DebugControlPanelProps> = ({
  onNotify,
  dxfCanvasVisible,
  layerCanvasVisible,
  onDxfToggle,
  onLayerToggle,
  canvasTransform,
  onTransformChange
}) => {
  return (
    <div className="flex gap-2 flex-wrap items-center p-3 bg-gradient-to-r from-gray-800 to-gray-900 border-b border-gray-700">
      {/* Canvas Test Buttons */}
      <CanvasTestButton onNotify={onNotify} />

      <LayeringWorkflowTestButton onNotify={onNotify} />

      <InspectDOMButton onNotify={onNotify} />

      {/* Canvas Visibility Controls */}
      <CanvasVisibilityButtons
        dxfCanvasVisible={dxfCanvasVisible}
        layerCanvasVisible={layerCanvasVisible}
        onDxfToggle={onDxfToggle}
        onLayerToggle={onLayerToggle}
      />

      {/* Cursor & Coordinate Tests */}
      <CursorCrosshairTestButton onNotify={onNotify} />

      <OriginMarkersToggleButton onNotify={onNotify} />

      <PanToOriginButton
        onNotify={onNotify}
        onTransformChange={onTransformChange}
      />

      {/* Grid & Ruler Tests */}
      <RulerDebugButton
        onNotify={onNotify}
        canvasTransform={canvasTransform}
      />

      <SyncTestButton
        onNotify={onNotify}
        canvasTransform={canvasTransform}
      />

      <GridTestButton onNotify={onNotify} />

      {/* Diagnostic & Debug Tools */}
      <MarkPointsButton
        onNotify={onNotify}
        canvasTransform={canvasTransform}
      />

      <MasterDiagnosticButton
        onNotify={onNotify}
        canvasTransform={canvasTransform}
      />

      <FullReportButton canvasTransform={canvasTransform} />

      {/* Label */}
      <div className="text-xs bg-gray-700 text-white px-2 py-1 rounded">
        Canvas Debug Tools
      </div>
    </div>
  );
};
