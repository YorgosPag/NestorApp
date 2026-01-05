// GeneralSettingsPanel.tsx - Container for General settings (Lines, Text, Grips)
// STATUS: ACTIVE - Phase 2 Step 2.4
// PURPOSE: Router για General Settings tabs (Lines, Text, Grips)

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║                        CROSS-REFERENCES (Documentation)                    ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * 📋 Migration Checklist:
 *    - docs/dxf-settings/MIGRATION_CHECKLIST.md (STEP 2.4 - Implementation)
 *
 * 🏗️ Architecture:
 *    - docs/dxf-settings/ARCHITECTURE.md (§2 Component Hierarchy - Panels)
 *    - docs/dxf-settings/ARCHITECTURE.md (§4.2 GeneralSettingsPanel Structure)
 *
 * 📖 Component Guide:
 *    - docs/dxf-settings/COMPONENT_GUIDE.md (§2.2 GeneralSettingsPanel)
 *
 * 📊 State Management:
 *    - docs/dxf-settings/STATE_MANAGEMENT.md (§2.2 Tab Navigation State)
 *
 * 📝 Decision Log:
 *    - docs/dxf-settings/DECISION_LOG.md (ADR-003: Separate General vs Specific Settings)
 *    - docs/dxf-settings/DECISION_LOG.md (ADR-005: Use Custom Hooks for Navigation State)
 *
 * 📚 Roadmap:
 *    - docs/REFACTORING_ROADMAP_ColorPalettePanel.md (Phase 2, Step 2.4)
 *
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║                      RELATED CODE FILES                                    ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Parent:
 *    - panels/DxfSettingsPanel.tsx (main router)
 *
 * Children (Tabs - Lazy Loaded):
 *    - tabs/general/LinesTab.tsx (via LazyLinesTab)
 *    - tabs/general/TextTab.tsx (via LazyTextTab)
 *    - tabs/general/GripsTab.tsx (via LazyGripsTab)
 *
 * Infrastructure:
 *    - LazyComponents.tsx (lazy loading exports)
 *    - hooks/useTabNavigation.ts (tab state management)
 *    - shared/TabNavigation.tsx (tab UI component)
 *
 * Extracted from:
 *    - ui/components/DxfSettingsPanel.tsx (lines 2146-2222, originally ColorPalettePanel)
 */

import React, { Suspense } from 'react';
import { useTabNavigation } from '../hooks/useTabNavigation';
import { PANEL_TOKENS } from '../../../../config/panel-tokens';
// 🏢 ENTERPRISE: Import centralized tabs system (same as Contacts/ΓΕΜΗ/PanelTabs/DxfSettingsPanel/SelectionSettings)
import { TabsOnlyTriggers, type TabDefinition } from '@/components/ui/navigation/TabsComponents';
// 🏢 ENTERPRISE: Lucide icons for tabs
import { Minus, Type, GripVertical } from 'lucide-react';
import { LazyLinesTab, LazyTextTab, LazyGripsTab } from '../LazyComponents';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { PANEL_LAYOUT } from '../../../../config/panel-tokens';
import { LinePreview } from '../settings/shared/LinePreview';
import { CurrentSettingsDisplay } from '../settings/shared/CurrentSettingsDisplay';
import {
  useLineSettingsFromProvider,
  useTextSettingsFromProvider,
  useGripSettingsFromProvider
} from '../../../../settings-provider';

/**
 * GeneralSettingsPanel - Container για General settings tabs
 *
 * Purpose:
 * - Route between 3 General tabs (Lines, Text, Grips)
 * - Render tab navigation UI
 * - Lazy load active tab only
 *
 * Architecture:
 * - Single Responsibility: Tab routing ONLY
 * - NO business logic (lives in tab components)
 * - NO settings state (lives in DxfSettingsProvider)
 *
 * State:
 * - activeTab: 'lines' | 'text' | 'grips' (via useTabNavigation hook)
 *
 * @see docs/dxf-settings/COMPONENT_GUIDE.md#GeneralSettingsPanel
 * @see docs/dxf-settings/ARCHITECTURE.md - Data flow
 * @see docs/dxf-settings/DECISION_LOG.md - ADR-003, ADR-005
 *
 * @example
 * ```tsx
 * // In DxfSettingsPanel.tsx
 * {activeMainTab === 'general' && (
 *   <Suspense fallback={<div>Loading...</div>}>
 *     <GeneralSettingsPanel />
 *   </Suspense>
 * )}
 * ```
 */

// ============================================================================
// TYPES
// ============================================================================

export type GeneralTab = 'lines' | 'text' | 'grips';

export interface GeneralSettingsPanelProps {
  /**
   * Default active tab (default: 'lines')
   */
  defaultTab?: GeneralTab;

  /**
   * Optional CSS class
   */
  className?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const GeneralSettingsPanel: React.FC<GeneralSettingsPanelProps> = ({
  defaultTab = 'lines',
  className = '',
}) => {
  // ============================================================================
  // STATE - Tab Navigation
  // ============================================================================

  const { activeTab, setActiveTab } = useTabNavigation<GeneralTab>(defaultTab);

  // ============================================================================
  // HOOKS - Settings από DxfSettingsProvider
  // ============================================================================

  const lineSettings = useLineSettingsFromProvider();
  const textSettings = useTextSettingsFromProvider();
  const gripSettings = useGripSettingsFromProvider();

  // ✅ FIX (ChatGPT-5): Guard against undefined settings during Enterprise Provider initialization
  if (!lineSettings?.settings || !textSettings?.settings || !gripSettings?.settings) {
    console.warn('⚠️ GeneralSettingsPanel: Settings not loaded yet', {
      lineSettings: lineSettings?.settings,
      textSettings: textSettings?.settings,
      gripSettings: gripSettings?.settings
    });
    return (
      <div className={`${className} ${PANEL_TOKENS.GENERAL_SETTINGS.FALLBACK_CONTENT.BASE}`}>
        Φόρτωση ρυθμίσεων...
      </div>
    );
  }

  // 🔍 DEBUG: Log settings για να δούμε τι περνάει στο Preview
  console.log('✅ GeneralSettingsPanel: Settings loaded', {
    lineSettings: lineSettings.settings,
    textSettings: textSettings.settings,
    gripSettings: gripSettings.settings
  });

  // ============================================================================
  // TAB CONFIGURATION - 🏢 ENTERPRISE: Using centralized TabDefinition interface
  // ============================================================================

  const generalTabs: TabDefinition[] = [
    {
      id: 'lines',
      label: 'Γραμμές',
      icon: Minus,
      content: null, // Content rendered separately below
    },
    {
      id: 'text',
      label: 'Κείμενο',
      icon: Type,
      content: null, // Content rendered separately below
    },
    {
      id: 'grips',
      label: 'Grips',
      icon: GripVertical,
      content: null, // Content rendered separately below
    },
  ];

  // 🏢 ENTERPRISE: Handle tab change - convert string to GeneralTab
  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId as GeneralTab);
  };

  // ============================================================================
  // RENDER TAB CONTENT (Lazy Loaded)
  // ============================================================================

  const renderTabContent = () => {
    switch (activeTab) {
      case 'lines':
        return <LazyLinesTab />;
      case 'text':
        return <LazyTextTab />;
      case 'grips':
        return <LazyGripsTab />;
      default:
        return <LazyLinesTab />; // Fallback
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className={className}>
      {/* Preview and Current Settings Display - 🏢 ENTERPRISE: Centralized spacing */}
      <div className={`${PANEL_LAYOUT.CONTAINER.PADDING} ${PANEL_LAYOUT.MARGIN.BOTTOM_LG} ${PANEL_LAYOUT.SPACING.GAP_LG}`}>
        {/* Line Preview Canvas */}
        <LinePreview
          lineSettings={lineSettings.settings}
          textSettings={textSettings.settings}
          gripSettings={gripSettings.settings}
        />

        {/* Current Settings Display */}
        <CurrentSettingsDisplay
          activeTab={activeTab}
          lineSettings={lineSettings.settings}
          textSettings={textSettings.settings}
          gripSettings={{
            showGrips: gripSettings.settings.enabled,
            gripSize: gripSettings.settings.gripSize,
            gripShape: 'square' as const,
            showFill: true,
            colors: gripSettings.settings.colors
          }}
        />
      </div>

      {/* 🏢 ENTERPRISE: Tab Navigation - Using centralized TabsOnlyTriggers */}
      <div className={PANEL_TOKENS.GENERAL_SETTINGS.TAB_NAVIGATION.CONTAINER}>
        <TabsOnlyTriggers
          tabs={generalTabs}
          value={activeTab}
          onTabChange={handleTabChange}
          theme="dark"
          alwaysShowLabels={true}
        />
      </div>

      {/* Tab Content (Lazy Loaded) */}
      <Suspense
        fallback={
          <div className={PANEL_TOKENS.GENERAL_SETTINGS.LOADING_STATE.BASE}>
            Φόρτωση...
          </div>
        }
      >
        <div className={PANEL_LAYOUT.CONTAINER.PADDING}>{renderTabContent()}</div>
      </Suspense>
    </div>
  );
};

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default GeneralSettingsPanel;

/**
 * MIGRATION NOTES (από DxfSettingsPanel.tsx):
 *
 * Original code (lines 2146-2222):
 * ```tsx
 * {activeMainTab === 'general' && (
 *   <div className="min-h-[850px] max-h-[96vh] overflow-y-auto">
 *     // Preview and Current Settings Display
 *     <div className="px-4 mb-6 space-y-4">
 *       <LinePreview ... />
 *       <CurrentSettingsDisplay ... />
 *     </div>
 *
 *     // General Settings Sub-tabs Navigation
 *     <div className="border-b border-gray-600 mb-4">
 *       <nav className="flex gap-1 px-2 pb-2">
 *         <button onClick={() => setActiveGeneralTab('lines')} ...>Γραμμές</button>
 *         <button onClick={() => setActiveGeneralTab('text')} ...>Κείμενο</button>
 *         <button onClick={() => setActiveGeneralTab('grips')} ...>Grips</button>
 *       </nav>
 *     </div>
 *
 *     // General Settings Content
 *     <div className="px-4">
 *       {activeGeneralTab === 'lines' && <LineSettings />}
 *       {activeGeneralTab === 'text' && <TextSettings />}
 *       {activeGeneralTab === 'grips' && <GripSettings />}
 *     </div>
 *   </div>
 * )}
 * ```
 *
 * Changes:
 * - ✅ Extracted tab navigation → TabNavigation component (reusable)
 * - ✅ Extracted tab state → useTabNavigation hook (reusable)
 * - ✅ Extracted tab routing → renderTabContent() method
 * - ✅ Added Suspense boundaries για lazy loading
 * - ✅ Removed Preview/CurrentSettingsDisplay (will be added back in Phase 2.5 if needed)
 * - ✅ Tab buttons → Generic TabNavigation component
 * - ✅ Conditional rendering → Lazy loaded components
 *
 * Benefits:
 * - ✅ Single Responsibility (routing only)
 * - ✅ Reusable TabNavigation component
 * - ✅ Lazy loading (performance boost)
 * - ✅ Testable in isolation
 * - ✅ Clean separation of concerns
 *
 * Note: Preview & CurrentSettingsDisplay removed for now (ADR-007: Keep It Simple).
 * Can be added back later if needed in Phase 2.5 or later.
 */
