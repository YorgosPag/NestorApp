/**
 * MainContentSection - Enterprise-Grade Main Content Area
 *
 * ENTERPRISE FEATURES:
 * - ✅ React.memo for performance optimization
 * - ✅ Conditional debug toolbar (development only)
 * - ✅ DXFViewerLayout integration
 * - ✅ Type-safe props with comprehensive interface
 * - ✅ Responsive flex layout
 */

'use client';

import React from 'react';
import type { SceneModel } from '../types/scene';
import type { DxfViewerAppProps, Status as AppStatus } from '../types';
import type { OverlayEditorMode, OverlayKind, Status } from '../overlays/types';
import type { ViewTransform, Point2D } from '../rendering/types/Types';
import type { ToolType } from '../ui/toolbar/types';
import { DXFViewerLayout } from '../integration/DXFViewerLayout';
import { DebugToolbar } from '../debug/DebugToolbar';
import type { UnifiedTestReport } from '../debug/unified-test-runner';

// ✅ ENTERPRISE: Comprehensive type-safe props interface
interface MainContentSectionProps {
  // State from useDxfViewerState
  state: any; // TODO: Create proper DxfViewerState type

  // Scene and file handling
  currentScene: SceneModel | null;
  handleFileImportWithEncoding: (file: File, encoding?: string) => Promise<void>;

  // Transform management
  canvasTransform: { scale: number; offsetX: number; offsetY: number };
  wrappedHandleTransformChange: (transform: ViewTransform) => void;

  // Event handlers
  handleRegionClick: (regionId: string) => void;
  handleCanvasMouseMove: (screenPos: Point2D, worldPos: Point2D) => void;

  // Overlay state
  overlayMode: OverlayEditorMode;
  overlayStatus: Status;
  overlayKind: OverlayKind;
  setOverlayMode: (mode: OverlayEditorMode) => void;
  setOverlayStatus: (status: Status) => void;
  setOverlayKind: (kind: OverlayKind) => void;

  // Debug controls
  dxfCanvasVisible: boolean;
  layerCanvasVisible: boolean;
  setDxfCanvasVisible: (visible: boolean) => void;
  setLayerCanvasVisible: (visible: boolean) => void;

  // Debug toolbar props (development only)
  showCopyableNotification: (message: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
  showGrid: boolean;
  activeTool: ToolType;
  handleToolChange: (tool: ToolType) => void;
  testModalOpen: boolean;
  setTestModalOpen: (open: boolean) => void;
  testReport: UnifiedTestReport | null;
  setTestReport: (report: UnifiedTestReport | null) => void;
  formattedTestReport: string;
  setFormattedTestReport: (report: string) => void;
  panToWorldOrigin: () => void;
  showCalibration: boolean;
  handleCalibrationToggle: () => void;
}

/**
 * Main content section containing debug toolbar and canvas area
 *
 * @param props - Main content configuration and callbacks
 * @returns Rendered main content section
 */
export const MainContentSection = React.memo<MainContentSectionProps>(({
  state,
  currentScene,
  handleFileImportWithEncoding,
  canvasTransform,
  wrappedHandleTransformChange,
  handleRegionClick,
  handleCanvasMouseMove,
  overlayMode,
  overlayStatus,
  overlayKind,
  setOverlayMode,
  setOverlayStatus,
  setOverlayKind,
  dxfCanvasVisible,
  layerCanvasVisible,
  setDxfCanvasVisible,
  setLayerCanvasVisible,
  showCopyableNotification,
  showGrid,
  activeTool,
  handleToolChange,
  testModalOpen,
  setTestModalOpen,
  testReport,
  setTestReport,
  formattedTestReport,
  setFormattedTestReport,
  panToWorldOrigin,
  showCalibration,
  handleCalibrationToggle,
}) => {
  return (
    <div
      className="flex-1 flex flex-col gap-2 h-full"
      style={{
        // ✅ ENTERPRISE: Ensure pointer events work in main content
        pointerEvents: 'auto',
      }}
    >
      {/* DEBUG TOOLBAR - Development only */}
      {process.env.NODE_ENV === 'development' && (
        <DebugToolbar
          showCopyableNotification={showCopyableNotification}
          showGrid={showGrid}
          currentScene={currentScene}
          activeTool={activeTool}
          handleToolChange={handleToolChange}
          testModalOpen={testModalOpen}
          setTestModalOpen={setTestModalOpen}
          testReport={testReport}
          setTestReport={setTestReport}
          formattedTestReport={formattedTestReport}
          setFormattedTestReport={setFormattedTestReport}
          dxfCanvasVisible={dxfCanvasVisible}
          setDxfCanvasVisible={setDxfCanvasVisible}
          layerCanvasVisible={layerCanvasVisible}
          setLayerCanvasVisible={setLayerCanvasVisible}
          panToWorldOrigin={panToWorldOrigin}
          showCalibration={showCalibration}
          handleCalibrationToggle={handleCalibrationToggle}
        />
      )}

      {/* CANVAS AREA - Main DXF Viewer Layout */}
      <div className="canvas-area relative flex-1 overflow-hidden">
        <DXFViewerLayout
          {...state}
          dxfFile={null}
          status={'idle' as AppStatus}
          onClear={() => {}}
          onViewModeChange={() => {}}
          onCanvasMouseDown={() => {}}
          onCanvasMouseMove={() => {}}
          entities={[]}
          layers={[]}
          scene={currentScene || {} as SceneModel}
          handleTransformChange={wrappedHandleTransformChange}
          handleFileImport={handleFileImportWithEncoding}
          transform={canvasTransform}
          onTransformChange={wrappedHandleTransformChange}
          onRegionClick={handleRegionClick}
          onMouseMove={handleCanvasMouseMove}
          dxfCanvasVisible={dxfCanvasVisible}
          layerCanvasVisible={layerCanvasVisible}
          overlayMode={overlayMode}
          overlayStatus={overlayStatus}
          overlayKind={overlayKind}
          setOverlayMode={setOverlayMode}
          setOverlayStatus={setOverlayStatus}
          setOverlayKind={setOverlayKind}
        />
      </div>
    </div>
  );
});

// ✅ ENTERPRISE: Display name for debugging
MainContentSection.displayName = 'MainContentSection';
