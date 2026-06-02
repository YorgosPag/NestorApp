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
import type { DxfSaveContext } from '../services/dxf-firestore.service';
import { FloatingPanelContainer, type FloatingPanelHandle } from '../ui/FloatingPanelContainer';
import { AutoSaveStatus } from '../ui/components/AutoSaveStatus';
import { CentralizedAutoSaveStatus } from '../ui/components/CentralizedAutoSaveStatus';
import { useBorderTokens } from '../../../hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { PANEL_LAYOUT } from '../config/panel-tokens';  // ✅ ENTERPRISE: Centralized spacing tokens
// ADR-040 Phase XXII.B: ZoomStore subscription lives in a 1-fiber leaf (SidebarZoomLeaf),
// NOT in the SidebarSection orchestrator. Subscribing in the orchestrator re-rendered the
// whole sidebar subtree (~426 fibers) on every wheel notch — the #3 wheel-zoom freeze root cause.
import { useCurrentZoom } from '../systems/zoom/ZoomStore';

// ============================================================================
// 🎯 LAYOUT CONSTANTS - Centralized, maintainable
// ============================================================================

/** Sidebar width tokens - uses PANEL_LAYOUT.LAYOUT_DIMENSIONS (ENTERPRISE) */
const SIDEBAR_LAYOUT = {
  WIDTH: PANEL_LAYOUT.WIDTH.PANEL_LG,                        // w-96 (384px)
  MIN_WIDTH: PANEL_LAYOUT.LAYOUT_DIMENSIONS.SIDEBAR_MIN_WIDTH, // min-w-[384px]
  MAX_WIDTH: PANEL_LAYOUT.LAYOUT_DIMENSIONS.SIDEBAR_MAX_WIDTH, // max-w-[384px]
} as const;

// ============================================================================
// 📋 TYPE DEFINITIONS
// ============================================================================

/** ADR-176: Sidebar display variant */
type SidebarVariant = 'inline' | 'drawer';

/** Props interface for SidebarSection component */
interface SidebarSectionProps {
  /** ADR-176: 'inline' (default desktop) or 'drawer' (mobile Sheet) */
  variant?: SidebarVariant;
  floatingRef: React.RefObject<FloatingPanelHandle>;
  currentScene: SceneModel | null;
  activeTool: string;
  // ADR-309 Phase 2: Wizard button in LevelPanel
  onSceneImported?: (file: File, encoding?: string, saveContext?: DxfSaveContext) => void;
  // ADR-358 Phase 8 sidebar dock — Properties tab scope.
  projectId?: string;
  floorplanId?: string;
  /** Universal-selection primary id (≠ selectedEntityIds[0] for some flows). */
  primarySelectedId?: string | null;
}

// ============================================================================
// 🍃 MICRO-LEAF (ADR-040)
// ============================================================================

/**
 * SidebarZoomLeaf — sole ZoomStore subscriber in the sidebar footer.
 *
 * ADR-040 Cardinal Rule #1: high-frequency stores (zoom/transform) must be
 * subscribed ONLY by leaf renderers, never by orchestrators. Isolating the
 * `useCurrentZoom()` subscription here means a wheel notch re-renders this single
 * `<span>` (1 fiber) instead of the whole SidebarSection subtree (~426 fibers).
 */
const SidebarZoomLeaf = React.memo(function SidebarZoomLeaf() {
  const currentZoom = useCurrentZoom();
  return <span>Zoom: {Math.round(currentZoom * 100)}%</span>;
});
SidebarZoomLeaf.displayName = 'SidebarZoomLeaf';

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
  variant = 'inline',
  floatingRef,
  currentScene,
  activeTool,
  onSceneImported,
  projectId,
  floorplanId,
  primarySelectedId,
}) => {
  const { quick, getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();

  // ADR-176: Drawer variant uses full width, inline uses fixed 384px
  const isDrawer = variant === 'drawer';

  return (
    <aside
      className={`
        ${isDrawer ? 'w-full' : SIDEBAR_LAYOUT.WIDTH}
        ${isDrawer ? '' : SIDEBAR_LAYOUT.MIN_WIDTH}
        ${isDrawer ? '' : SIDEBAR_LAYOUT.MAX_WIDTH}
        h-full
        ${isDrawer ? '' : 'flex-shrink-0'}
        ${PANEL_LAYOUT.POINTER_EVENTS.AUTO}
      `}
      aria-label="DXF Viewer Sidebar"
    >
      {/*
        Inner container with Flexbox column layout
        - flex flex-col: Vertical stacking
        - h-full: Fill parent height
      */}
      {/* 🏢 ENTERPRISE: bg.card for consistency with ListCard backgrounds */}
      <section
        className={`
          h-full
          flex flex-col
          ${colors.bg.card}
          ${quick.card}
          ${PANEL_LAYOUT.SHADOW.XL}
          ${getStatusBorder('default')}
        `}
      >
        {/*
          MAIN CONTENT AREA - Scrollable
          - flex-1: Take remaining space
          - min-h-0: CRITICAL for Flexbox scroll (allows shrinking below content height)
          - overflow-y-auto: Enable vertical scrolling
        */}
        <main className={`flex-1 ${PANEL_LAYOUT.FLEX_UTILS.ALLOW_SCROLL} ${PANEL_LAYOUT.OVERFLOW.Y_AUTO}`}>
          <FloatingPanelContainer
            ref={floatingRef}
            sceneModel={currentScene}
            currentTool={activeTool as ToolType}
            onSceneImported={onSceneImported}
            projectId={projectId}
            floorplanId={floorplanId}
            primarySelectedId={primarySelectedId}
          />
        </main>

        {/*
          STATUS BAR - Fixed at bottom
          - flex-shrink-0: Never shrink, always visible
        */}
        {/* 🏢 ENTERPRISE: bg.card for consistency with ListCard backgrounds */}
        <footer
          className={`
            flex-shrink-0
            ${PANEL_LAYOUT.SPACING.GAP_SM}
            ${PANEL_LAYOUT.ROUNDED.BOTTOM_LG}
            ${colors.bg.card}
            ${quick.separatorH}
            ${PANEL_LAYOUT.SPACING.SM}
          `}
        >
          <AutoSaveStatus />
          <CentralizedAutoSaveStatus />

          <div className={`flex justify-between items-center ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted}`}>
            <span>Sidebar Status</span>
            <SidebarZoomLeaf />
          </div>
        </footer>
      </section>
    </aside>
  );
});

// ✅ ENTERPRISE: Display name for React DevTools
SidebarSection.displayName = 'SidebarSection';
