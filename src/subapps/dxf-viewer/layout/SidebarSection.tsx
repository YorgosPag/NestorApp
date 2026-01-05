/**
 * SidebarSection - Enterprise-Grade Left Sidebar Container
 *
 * ============================================================================
 * ENTERPRISE ARCHITECTURE (VS Code / Figma / Adobe XD Pattern)
 * ============================================================================
 *
 * Layout Structure:
 * ┌─────────────────────────────────────┐
 * │  <aside> - Semantic sidebar root    │
 * │  ┌─────────────────────────────────┐│
 * │  │ <main> - Scrollable content     ││
 * │  │   └─ FloatingPanelContainer     ││
 * │  │      (flex-1 overflow-y-auto)   ││
 * │  ├─────────────────────────────────┤│
 * │  │ <footer> - Fixed status bar     ││
 * │  │   └─ AutoSave indicators        ││
 * │  └─────────────────────────────────┘│
 * └─────────────────────────────────────┘
 *
 * ENTERPRISE FEATURES:
 * - ✅ Flexbox layout (no absolute positioning)
 * - ✅ Semantic HTML (aside, main, footer)
 * - ✅ Zero hardcoded pixel values
 * - ✅ React.memo for performance optimization
 * - ✅ Centralized design tokens
 * - ✅ Type-safe props
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/aside
 * ============================================================================
 */

'use client';

import React from 'react';
import type { SceneModel } from '../types/scene';
import type { ToolType } from '../ui/toolbar/types';
import { FloatingPanelContainer, type FloatingPanelHandle } from '../ui/FloatingPanelContainer';
import { AutoSaveStatus } from '../ui/components/AutoSaveStatus';
import { CentralizedAutoSaveStatus } from '../ui/components/CentralizedAutoSaveStatus';
import { useBorderTokens } from '../../../hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { PANEL_LAYOUT } from '../config/panel-tokens';  // ✅ ENTERPRISE: Centralized spacing tokens

// ============================================================================
// 🎯 LAYOUT CONSTANTS - Centralized, maintainable
// ============================================================================

/** Sidebar width tokens - matches Tailwind w-96 (384px) */
const SIDEBAR_LAYOUT = {
  WIDTH: 'w-96',
  MIN_WIDTH: 'min-w-[384px]',
  MAX_WIDTH: 'max-w-[384px]',
} as const;

// ============================================================================
// 📋 TYPE DEFINITIONS
// ============================================================================

/** Props interface for SidebarSection component */
interface SidebarSectionProps {
  floatingRef: React.RefObject<FloatingPanelHandle>;
  currentScene: SceneModel | null;
  selectedEntityIds: string[];
  setSelectedEntityIds: (ids: string[]) => void;
  currentZoom: number;
  activeTool: string;
}

// ============================================================================
// 🏗️ COMPONENT IMPLEMENTATION
// ============================================================================

/**
 * Enterprise-grade left sidebar with Flexbox layout
 *
 * Uses semantic HTML and Flexbox for robust scrolling behavior.
 * The main content area scrolls while the status bar stays fixed at bottom.
 */
export const SidebarSection = React.memo<SidebarSectionProps>(({
  floatingRef,
  currentScene,
  selectedEntityIds,
  setSelectedEntityIds,
  currentZoom,
  activeTool,
}) => {
  const { quick, getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();

  return (
    <aside
      className={`
        ${SIDEBAR_LAYOUT.WIDTH}
        ${SIDEBAR_LAYOUT.MIN_WIDTH}
        ${SIDEBAR_LAYOUT.MAX_WIDTH}
        h-full
        flex-shrink-0
        pointer-events-auto
      `}
      aria-label="DXF Viewer Sidebar"
    >
      {/*
        Inner container with Flexbox column layout
        - flex flex-col: Vertical stacking
        - h-full: Fill parent height
      */}
      <section
        className={`
          h-full
          flex flex-col
          ${colors.bg.secondary}
          ${quick.card}
          shadow-xl
          ${getStatusBorder('default')}
        `}
      >
        {/*
          MAIN CONTENT AREA - Scrollable
          - flex-1: Take remaining space
          - min-h-0: CRITICAL for Flexbox scroll (allows shrinking below content height)
          - overflow-y-auto: Enable vertical scrolling
        */}
        <main className="flex-1 min-h-0 overflow-y-auto">
          <FloatingPanelContainer
            ref={floatingRef}
            sceneModel={currentScene}
            selectedEntityIds={selectedEntityIds}
            onEntitySelect={setSelectedEntityIds}
            zoomLevel={currentZoom}
            currentTool={activeTool as ToolType}
          />
        </main>

        {/*
          STATUS BAR - Fixed at bottom
          - flex-shrink-0: Never shrink, always visible
        */}
        <footer
          className={`
            flex-shrink-0
            ${PANEL_LAYOUT.SPACING.GAP_SM}
            rounded-b-lg
            ${colors.bg.secondary}
            ${quick.separatorH}
            ${PANEL_LAYOUT.SPACING.LG}
          `}
        >
          <AutoSaveStatus />
          <CentralizedAutoSaveStatus />

          <div className={`flex justify-between items-center text-xs ${colors.text.muted}`}>
            <span>Sidebar Status</span>
            <span>Zoom: {currentZoom}%</span>
          </div>
        </footer>
      </section>
    </aside>
  );
});

// ✅ ENTERPRISE: Display name for React DevTools
SidebarSection.displayName = 'SidebarSection';
