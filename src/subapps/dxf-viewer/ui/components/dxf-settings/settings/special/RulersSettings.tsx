// RulersSettings.tsx - Rulers settings router with 4 sub-tabs
// STATUS: ACTIVE - Phase 3 Step 3.3b5
// PURPOSE: Router for Rulers settings (4 sub-tabs: Background, Lines, Text, Units)

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║  CROSS-REFERENCES: docs/dxf-settings/MIGRATION_CHECKLIST.md (STEP 3.3b5)  ║
 * ║  Parent: categories/GridCategory.tsx (Rulers tab)                          ║
 * ║  Uses: rulers/RulerBackgroundSettings.tsx (Background tab)                 ║
 * ║        rulers/RulerLinesSettings.tsx (Lines tab with Major/Minor nested)   ║
 * ║        rulers/RulerTextSettings.tsx (Text tab)                             ║
 * ║        rulers/RulerUnitsSettings.tsx (Units tab)                           ║
 * ║  Hooks: hooks/useTabNavigation.ts (tab state management)                   ║
 * ║  UI: ui/TabNavigation.tsx (tab navigation component)                       ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 */

import React from 'react';
import { useTabNavigation } from '../../../hooks/useTabNavigation';
import { TabNavigation } from '../../../ui/TabNavigation';
import { RulerBackgroundSettings } from './rulers/RulerBackgroundSettings';
import { RulerLinesSettings } from './rulers/RulerLinesSettings';
import { RulerTextSettings } from './rulers/RulerTextSettings';
import { RulerUnitsSettings } from './rulers/RulerUnitsSettings';

/**
 * RulersSettings - Rulers settings router with 4 sub-tabs
 *
 * Purpose:
 * - Router for Rulers settings (4 sub-tabs)
 * - Background: Visibility, color, opacity, width
 * - Lines: Major/Minor lines (nested sub-tabs) - visibility, color, opacity, thickness
 * - Text: Text color, font size, visibility
 * - Units: Units type, visibility, font size, color
 *
 * Architecture:
 * - Uses useTabNavigation hook (ADR-005)
 * - Uses TabNavigation UI component (ADR-004)
 * - All sub-tabs render specialized components
 *
 * State:
 * - Tab state managed by useTabNavigation hook
 * - Settings state managed by child components (via useRulersGridContext)
 *
 * @see docs/dxf-settings/COMPONENT_GUIDE.md#RulersSettings
 * @see docs/dxf-settings/ARCHITECTURE.md - Tab navigation pattern
 *
 * @example
 * ```tsx
 * // In GridCategory.tsx
 * <Suspense fallback={<div>Loading...</div>}>
 *   <RulersSettings />
 * </Suspense>
 * ```
 */

// ============================================================================
// TYPES
// ============================================================================

export interface RulersSettingsProps {
  /**
   * Optional CSS class
   */
  className?: string;
  /**
   * Default active sub-tab
   */
  defaultTab?: RulerSubTab;
}

/**
 * Ruler sub-tabs union type
 */
export type RulerSubTab = 'background' | 'lines' | 'text' | 'units';

// ============================================================================
// COMPONENT
// ============================================================================

export const RulersSettings: React.FC<RulersSettingsProps> = ({
  className = '',
  defaultTab = 'background'
}) => {
  // ============================================================================
  // HOOKS
  // ============================================================================

  // Tab navigation state (ADR-005)
  const { activeTab, setActiveTab } = useTabNavigation<RulerSubTab>(defaultTab);

  // ============================================================================
  // TAB CONFIGURATION
  // ============================================================================

  const tabs = [
    { id: 'background' as const, label: '📦 Φόντο' },
    { id: 'lines' as const, label: '📏 Γραμμές' },
    { id: 'text' as const, label: '📝 Κείμενα' },
    { id: 'units' as const, label: '📐 Μονάδες' }
  ];

  // ============================================================================
  // RENDER TAB CONTENT
  // ============================================================================

  const renderTabContent = () => {
    switch (activeTab) {
      case 'background':
        return <RulerBackgroundSettings />;
      case 'lines':
        return <RulerLinesSettings />;
      case 'text':
        return <RulerTextSettings />;
      case 'units':
        return <RulerUnitsSettings />;
      default:
        return <RulerBackgroundSettings />;
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className={className}>
      {/* Tab Navigation */}
      <div className="border-b border-gray-600 mb-4">
        <TabNavigation
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          className="px-2 pb-2"
        />
      </div>

      {/* Tab Content */}
      <div className="px-4">
        {renderTabContent()}
      </div>
    </div>
  );
};

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default RulersSettings;

/**
 * MIGRATION NOTES: Extracted from DxfSettingsPanel.tsx lines 1442-2101
 *
 * Original code:
 * ```tsx
 * // Rulers Settings Tab
 * <div className="space-y-4">
 *   {/* Ruler Sub-tabs *\/}
 *   <div className="flex gap-1 mb-4 border-b border-gray-600 pb-2">
 *     <button onClick={() => setActiveRulerTab('background')}>📦 Φόντο</button>
 *     <button onClick={() => setActiveRulerTab('lines')}>📏 Γραμμές</button>
 *     <button onClick={() => setActiveRulerTab('text')}>📝 Κείμενα</button>
 *     <button onClick={() => setActiveRulerTab('units')}>📐 Μονάδες</button>
 *   </div>
 *   {activeRulerTab === 'background' ? (
 *     <div>{/* Inline Background UI (147 lines) *\/}</div>
 *   ) : activeRulerTab === 'lines' ? (
 *     <div>{/* Inline Lines UI with nested Major/Minor (269 lines) *\/}</div>
 *   ) : activeRulerTab === 'text' ? (
 *     <div>{/* Inline Text UI (81 lines) *\/}</div>
 *   ) : activeRulerTab === 'units' ? (
 *     <div>{/* Inline Units UI (107 lines) *\/}</div>
 *   ) : null}
 * </div>
 * ```
 *
 * Changes:
 * - ✅ Extracted all 4 inline UIs to specialized components (604 lines total)
 * - ✅ Created RulersSettings router with tab navigation
 * - ✅ Integrated useTabNavigation hook (ADR-005)
 * - ✅ Integrated TabNavigation UI component (ADR-004)
 * - ✅ Clean separation of concerns (routing vs UI)
 *
 * Benefits:
 * - ✅ Single Responsibility (RulersSettings = Routing only)
 * - ✅ Reusable specialized components (4 sub-components)
 * - ✅ Testable in isolation
 * - ✅ Consistent pattern with other routers
 * - ✅ Cleaner parent component (GridCategory)
 */
