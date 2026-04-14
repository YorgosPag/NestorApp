// GridCategory.tsx - Grid category with 2 main tabs (Grid, Rulers)
// STATUS: ACTIVE - Phase 3 Step 3.3c
// PURPOSE: Grid & Rulers settings UI (Specific Settings → Grid category with 2 main tabs)

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║  CROSS-REFERENCES: docs/dxf-settings/MIGRATION_CHECKLIST.md (STEP 3.3c)   ║
 * ║  Parent: panels/SpecificSettingsPanel.tsx                                  ║
 * ║  Uses: settings/special/GridSettings.tsx (Grid tab - Major/Minor nested)   ║
 * ║        settings/special/RulersSettings.tsx (Rulers tab - 4 sub-tabs)       ║
 * ║  Hooks: hooks/useTabNavigation.ts (tab state management)                   ║
 * ║  UI: ui/TabNavigation.tsx (tab navigation component)                       ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 */

import React from 'react';
import { useTranslation } from '@/i18n';
import { useTabNavigation } from '../hooks/useTabNavigation';
// 🏢 ENTERPRISE: Import centralized tabs system (same as Contacts/ΓΕΜΗ/PanelTabs/DxfSettingsPanel/etc.)
import { TabsOnlyTriggers, type TabDefinition } from '@/components/ui/navigation/TabsComponents';
// 🏢 ENTERPRISE: Lucide icons for tabs (replacing emojis 📋 and 📏)
import { Grid3X3, Ruler } from 'lucide-react';
import { GridSettings } from '../settings/special/GridSettings';
import { RulersSettings } from '../settings/special/RulersSettings';
import { useBorderTokens } from '@/hooks/useBorderTokens';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { PANEL_LAYOUT } from '../../../../config/panel-tokens';

/**
 * GridCategory - Grid & Rulers settings category with 2 main tabs
 *
 * Purpose:
 * - Router for Grid & Rulers settings (2 main tabs)
 * - Grid: Grid visibility, size, style, Major/Minor lines (nested sub-tabs)
 * - Rulers: Background, Lines (nested Major/Minor), Text, Units (4 sub-tabs)
 *
 * Architecture:
 * - Uses useTabNavigation hook (ADR-005)
 * - Uses TabNavigation UI component (ADR-004)
 * - Both tabs render specialized router components (GridSettings, RulersSettings)
 *
 * State:
 * - Tab state managed by useTabNavigation hook
 * - Settings state managed by child components (via useRulersGridContext)
 *
 * @see docs/dxf-settings/COMPONENT_GUIDE.md#GridCategory
 * @see docs/dxf-settings/ARCHITECTURE.md - Tab navigation pattern
 *
 * @example
 * ```tsx
 * // In SpecificSettingsPanel.tsx
 * <Suspense fallback={<div>Loading...</div>}>
 *   <GridCategory />
 * </Suspense>
 * ```
 */

// ============================================================================
// TYPES
// ============================================================================

export interface GridCategoryProps {
  /**
   * Optional CSS class
   */
  className?: string;
  /**
   * Default active main tab ('grid' | 'rulers')
   */
  defaultTab?: GridMainTab;
}

/**
 * Grid main tabs union type
 */
export type GridMainTab = 'grid' | 'rulers';

// ============================================================================
// COMPONENT
// ============================================================================

export const GridCategory: React.FC<GridCategoryProps> = ({
  className = '',
  defaultTab = 'grid'
}) => {
  const { getStatusBorder, getDirectionalBorder } = useBorderTokens();
  // ============================================================================
  // HOOKS
  // ============================================================================

  // Tab navigation state (ADR-005)
  const { activeTab, setActiveTab } = useTabNavigation<GridMainTab>(defaultTab);
  const { t } = useTranslation(['dxf-viewer', 'dxf-viewer-settings', 'dxf-viewer-wizard', 'dxf-viewer-guides', 'dxf-viewer-panels', 'dxf-viewer-shell']);

  // ============================================================================
  // TAB CONFIGURATION - 🏢 ENTERPRISE: Using centralized TabDefinition interface
  // ============================================================================

  const gridTabs: TabDefinition[] = [
    {
      id: 'grid',
      label: t('settings.gridTabs.grid'),
      icon: Grid3X3,
      content: null, // Content rendered separately below
    },
    {
      id: 'rulers',
      label: t('settings.gridTabs.rulers'),
      icon: Ruler,
      content: null, // Content rendered separately below
    },
  ];

  // 🏢 ENTERPRISE: Handle tab change - convert string to GridMainTab
  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId as GridMainTab);
  };

  // ============================================================================
  // RENDER TAB CONTENT
  // ============================================================================

  const renderTabContent = () => {
    switch (activeTab) {
      case 'grid':
        return <GridSettings />;
      case 'rulers':
        return <RulersSettings />;
      default:
        return <GridSettings />;
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className={className}>
      {/* 🏢 ENTERPRISE: Tab Navigation - Using centralized TabsOnlyTriggers */}
      <div className={`${getDirectionalBorder('default', 'bottom')} ${PANEL_LAYOUT.MARGIN.BOTTOM_LG}`}>
        <TabsOnlyTriggers
          tabs={gridTabs}
          value={activeTab}
          onTabChange={handleTabChange}
          theme="dark"
          alwaysShowLabels
        />
      </div>

      {/* Tab Content - 🏢 ENTERPRISE: Padding now handled by SpecificSettingsPanel.CONTENT_WRAPPER */}
      {renderTabContent()}
    </div>
  );
};

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default GridCategory;

/**
 * MIGRATION NOTES: Extracted from DxfSettingsPanel.tsx lines 1188-2103
 *
 * Original code:
 * ```tsx
 * case 'grid':
 *   return (
 *     <div className="p-4">
 *       {/* Sub-navigation tabs *\/}
 *       <div className="flex gap-1 mb-4 border-b {getStatusBorder('default')} pb-2">
 *         <button onClick={() => setActiveGridTab('grid')}>📋 Πλέγμα (Grid)</button>
 *         <button onClick={() => setActiveGridTab('rulers')}>📏 Χάρακες (Rulers)</button>
 *       </div>
 *       {activeGridTab === 'grid' ? (
 *         <div>{/* Inline Grid UI (226 lines) with nested Major/Minor *\/}</div>
 *       ) : (
 *         <div>{/* Inline Rulers UI (660 lines) with 4 sub-tabs *\/}</div>
 *       )}
 *     </div>
 *   );
 * ```
 *
 * Changes:
 * - ✅ Extracted inline Grid UI to GridSettings.tsx (378 lines)
 * - ✅ Extracted inline Rulers UI to RulersSettings.tsx (189 lines) with 4 sub-components
 * - ✅ Created GridCategory router with tab navigation
 * - ✅ Integrated useTabNavigation hook (ADR-005)
 * - ✅ Integrated TabNavigation UI component (ADR-004)
 * - ✅ Clean 3-level hierarchy: GridCategory → GridSettings/RulersSettings → specialized sub-components
 *
 * Component Hierarchy:
 * ```
 * GridCategory (router)
 *   ├─ Grid tab → GridSettings (router)
 *   │   ├─ Common: visibility, size, style
 *   │   └─ Nested tabs: Major Lines, Minor Lines
 *   └─ Rulers tab → RulersSettings (router)
 *       ├─ Background tab → RulerBackgroundSettings
 *       ├─ Lines tab → RulerLinesSettings (nested Major/Minor)
 *       ├─ Text tab → RulerTextSettings
 *       └─ Units tab → RulerUnitsSettings
 * ```
 *
 * Benefits:
 * - ✅ Single Responsibility (GridCategory = Top-level routing only)
 * - ✅ Reusable specialized components (6 sub-components total)
 * - ✅ Testable in isolation
 * - ✅ Consistent pattern with CursorCategory
 * - ✅ Cleaner parent component (SpecificSettingsPanel)
 * - ✅ Lazy loadable (performance)
 */

