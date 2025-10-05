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
    <div
      style={{
        width: '384px',
        minWidth: '384px',
        maxWidth: '384px',
        height: '100%',
        flexShrink: 0,
        position: 'relative',
        overflow: 'hidden',
        // ✅ ENTERPRISE: Ensure pointer events work even in layering mode
        pointerEvents: 'auto',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '384px',
          height: '100%',
          overflow: 'hidden',
          backgroundColor: '#111827',
          borderRadius: '8px',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
          border: '1px solid #6B7280',
        }}
      >
        {/* FLOATING PANEL CONTENT AREA */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: '120px', // Reserve space for status bar
            overflow: 'hidden',
          }}
        >
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
          className="border-t border-gray-500 px-4 py-3 bg-gray-800 space-y-2"
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            borderBottomLeftRadius: '8px',
            borderBottomRightRadius: '8px',
          }}
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
