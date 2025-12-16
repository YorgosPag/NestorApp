/**
 * SidebarSection - Enterprise-Grade Left Sidebar Container
 *
 * ENTERPRISE FEATURES:
 * - ✅ React.memo for performance optimization
 * - ✅ Error boundary integration ready
 * - ✅ Responsive design with fixed width
 * - ✅ Status bar with auto-save indicators
 * - ✅ Type-safe props
 */

'use client';

import React from 'react';
import type { SceneModel } from '../types/scene';
import { FloatingPanelContainer, type FloatingPanelHandle } from '../ui/FloatingPanelContainer';
import { AutoSaveStatus } from '../ui/components/AutoSaveStatus';
import { CentralizedAutoSaveStatus } from '../ui/components/CentralizedAutoSaveStatus';
import { canvasUtilities } from '@/styles/design-tokens';

// ✅ ENTERPRISE: Type-safe props interface
interface SidebarSectionProps {
  floatingRef: React.RefObject<FloatingPanelHandle>;
  currentScene: SceneModel | null;
  selectedEntityIds: string[];
  setSelectedEntityIds: (ids: string[]) => void;
  currentZoom: number;
  activeTool: string;
}

/**
 * Left sidebar section containing floating panel and status bars
 *
 * @param props - Sidebar configuration and callbacks
 * @returns Rendered sidebar section
 */
export const SidebarSection = React.memo<SidebarSectionProps>(({
  floatingRef,
  currentScene,
  selectedEntityIds,
  setSelectedEntityIds,
  currentZoom,
  activeTool,
}) => {
  return (
    <div style={canvasUtilities.overlays.dxfSidebar.container}>
      <div style={canvasUtilities.overlays.dxfSidebar.panel}>
        {/* FLOATING PANEL CONTENT AREA */}
        <div style={canvasUtilities.overlays.dxfSidebar.contentArea}>
          <FloatingPanelContainer
            ref={floatingRef}
            sceneModel={currentScene}
            selectedEntityIds={selectedEntityIds}
            onEntitySelect={setSelectedEntityIds}
            zoomLevel={currentZoom}
            currentTool={activeTool}
          />
        </div>

        {/* STATUS BAR AT BOTTOM */}
        <div
          className="space-y-2"
          style={canvasUtilities.overlays.dxfSidebar.statusBar}
        >
          {/* Scene Auto-Save Status */}
          <AutoSaveStatus />

          {/* DXF Settings Auto-Save Status */}
          <CentralizedAutoSaveStatus />

          {/* Status Info */}
          <div className="flex justify-between items-center text-xs text-gray-400">
            <span>Sidebar Status</span>
            <span>Zoom: {currentZoom}%</span>
          </div>

          {/* Storage Status (Temporarily disabled) */}
          <div className="text-xs text-gray-500">
            Storage Status (προσωρινά απενεργοποιημένο)
          </div>
        </div>
      </div>
    </div>
  );
});

// ✅ ENTERPRISE: Display name for debugging
SidebarSection.displayName = 'SidebarSection';
