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
 * ============================================================================
 * ADR-724 Φ1 — ΤΟ ΠΛΑΤΟΣ ΔΕΝ ΑΝΗΚΕΙ ΠΛΕΟΝ ΕΔΩ
 * ============================================================================
 *
 * Μέχρι το ADR-724 αυτό το αρχείο κλείδωνε το πλάτος σε `min = max = 384` + `flex-shrink-0`.
 * Ήταν το **μοναδικό** εμπόδιο για την αλλαγή μεγέθους: η υπόλοιπη flexbox ήταν ήδη σωστή
 * (`min-w-0` στο `MainContentSection`). Τώρα η παλέτα γεμίζει ό,τι της δώσει ο γονέας της:
 *
 * - **desktop** → `WorkspaceSplitLayout` (panel με όρια σε pixels, διαχωριστικό, πληκτρολόγιο)
 * - **tablet/mobile** → `MobileSidebarDrawer` (Sheet, `w-[85vw] max-w-[384px]`)
 *
 * Δύο γονείς, **ένας** κανόνας εδώ: «γέμισε τον χώρο σου». Γι' αυτό έφυγε και το `variant`
 * prop — μετά την απελευθέρωση του πλάτους οι δύο κλάδοι του παρήγαγαν **ταυτόσημο** markup,
 * δηλαδή θα ήταν διακόπτης που δεν ανάβει τίποτα. Επιστρέφει στη Φ3, όταν η αιωρούμενη
 * λειτουργία του δώσει πραγματικό νόημα.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/aside
 * @see ./WorkspaceSplitLayout — ο κάτοχος του πλάτους στο desktop
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
import { WorkspacePaletteHeader } from './WorkspacePaletteHeader';
import { useBorderTokens } from '../../../hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { PANEL_LAYOUT } from '../config/panel-tokens';  // ✅ ENTERPRISE: Centralized spacing tokens
// ADR-040 Phase XXII.B: ZoomStore subscription lives in a 1-fiber leaf (SidebarZoomLeaf),
// NOT in the SidebarSection orchestrator. Subscribing in the orchestrator re-rendered the
// whole sidebar subtree (~426 fibers) on every wheel notch — the #3 wheel-zoom freeze root cause.
// 🏢 ADR-418: real view-scale (1:N) instead of pixel-%
import { useViewScale } from '../systems/zoom/hooks/useViewScale';

// ============================================================================
// 📋 TYPE DEFINITIONS
// ============================================================================

/** Props interface for SidebarSection component */
interface SidebarSectionProps {
  floatingRef: React.RefObject<FloatingPanelHandle>;
  currentScene: SceneModel | null;
  activeTool: string;
  // ADR-309 Phase 2: Wizard button in LevelPanel
  onSceneImported?: (file: File, encoding?: string, saveContext?: DxfSaveContext, targetLevelId?: string) => void;
  // ADR-358 Phase 8 sidebar dock — Properties tab scope.
  projectId?: string;
  floorplanId?: string;
}

// ============================================================================
// 🍃 MICRO-LEAF (ADR-040)
// ============================================================================

/**
 * SidebarZoomLeaf — sole zoom subscriber in the sidebar footer.
 *
 * ADR-040 Cardinal Rule #1: high-frequency stores (zoom/transform) must be
 * subscribed ONLY by leaf renderers, never by orchestrators. Isolating the
 * `useViewScale()` subscription here means a wheel notch re-renders this single
 * `<span>` (1 fiber) instead of the whole SidebarSection subtree (~426 fibers).
 *
 * 🏢 ADR-418: shows the real drawing scale (e.g. "1:69") instead of a pixel-%.
 */
const SidebarZoomLeaf = React.memo(function SidebarZoomLeaf() {
  const { label } = useViewScale();
  return <span>{label}</span>;
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
  floatingRef,
  currentScene,
  activeTool,
  onSceneImported,
  projectId,
  floorplanId,
}) => {
  const { quick, getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();
  const { t } = useTranslation('dxf-viewer-shell');
  // ADR-532 Stage C — SidebarSection no longer subscribes to the selection set.
  // The Properties palette (BimPropertiesShell) self-subscribes via
  // usePrimarySelectedId(), so this orchestrator-level sidebar stops re-rendering
  // (and re-rendering FloatingPanelContainer) on every click.

  return (
    <aside
      className={`w-full h-full ${PANEL_LAYOUT.POINTER_EVENTS.AUTO}`}
      aria-label={t('workspaceDock.sidebarLabel')}
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
          ADR-724 Φ2 — Γραμμή τίτλου: ονομάζει την παλέτα, φιλοξενεί το μενού αγκύρωσης, και
          θα είναι η λαβή του dock⇄float στη Φ3. Πρώτο παιδί του `<section>`, όπως σε κάθε
          παλέτα Revit/ArchiCAD/C4D.
        */}
        <WorkspacePaletteHeader />

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
            <span>{t('workspaceDock.statusLabel')}</span>
            <SidebarZoomLeaf />
          </div>
        </footer>
      </section>
    </aside>
  );
});

// ✅ ENTERPRISE: Display name for React DevTools
SidebarSection.displayName = 'SidebarSection';
