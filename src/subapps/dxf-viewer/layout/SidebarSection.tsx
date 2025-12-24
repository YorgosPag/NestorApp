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
import { useBorderTokens } from '@/hooks/useBorderTokens';

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
  const { quick } = useBorderTokens();

  return (
    <div className="w-96 min-w-[384px] max-w-[384px] h-full flex-shrink-0 relative overflow-hidden pointer-events-auto">
      <div className={`absolute inset-0 w-96 h-full overflow-hidden bg-gray-800 ${quick.card} shadow-xl border-gray-500`}>
        {/* FLOATING PANEL CONTENT AREA */}
        <div className="absolute inset-x-0 top-0 bottom-[120px] overflow-hidden">
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
        <div className="absolute bottom-0 inset-x-0 space-y-2 rounded-b-lg bg-gray-800 border-t border-gray-500 p-4">
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
