// CursorCategory.tsx - Cursor category with sub-tabs (Crosshair, Cursor)
// STATUS: ACTIVE - Phase 3 Step 3.2
// PURPOSE: Cursor settings UI (Specific Settings → Cursor category with 2 tabs)

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║  CROSS-REFERENCES: docs/dxf-settings/MIGRATION_CHECKLIST.md (STEP 3.2)    ║
 * ║  Parent: panels/SpecificSettingsPanel.tsx                                  ║
 * ║  Uses: settings/special/CrosshairSettings.tsx (Crosshair tab)              ║
 * ║        settings/special/CursorSettings.tsx (Cursor tab)                    ║
 * ║  Hooks: hooks/useTabNavigation.ts (tab state management)                   ║
 * ║  UI: ui/TabNavigation.tsx (tab navigation component)                       ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 */

import React, { Suspense } from 'react';
import { useTabNavigation } from '../hooks/useTabNavigation';
// 🏢 ENTERPRISE: Import centralized tabs system (same as Contacts/ΓΕΜΗ/PanelTabs/DxfSettingsPanel/SelectionSettings/GeneralSettingsPanel)
import { TabsOnlyTriggers, type TabDefinition } from '@/components/ui/navigation/TabsComponents';
// 🏢 ENTERPRISE: Lucide icons for tabs
import { Crosshair, MousePointer2 } from 'lucide-react';
import { CrosshairSettings } from '../settings/special/CrosshairSettings';
import { CursorSettings } from '../settings/special/CursorSettings';
import { useBorderTokens } from '@/hooks/useBorderTokens';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { PANEL_LAYOUT } from '../../../../config/panel-tokens';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from 'react-i18next';

/**
 * CursorCategory - Cursor settings category with sub-tabs
 *
 * Purpose:
 * - Router for Cursor settings (2 sub-tabs: Crosshair, Cursor)
 * - Crosshair: Visual appearance (color, style, size, opacity)
 * - Cursor: Cursor shape and behavior
 *
 * Architecture:
 * - Uses useTabNavigation hook (ADR-005)
 * - Uses TabNavigation UI component (ADR-004)
 * - Sub-tabs rendered directly (no lazy loading needed - both simple)
 *
 * State:
 * - Tab state managed by useTabNavigation hook
 * - Settings state managed by child components (CrosshairSettings, CursorSettings)
 *
 * @see docs/dxf-settings/COMPONENT_GUIDE.md#CursorCategory
 * @see docs/dxf-settings/ARCHITECTURE.md - Tab navigation pattern
 *
 * @example
 * ```tsx
 * // In SpecificSettingsPanel.tsx
 * <Suspense fallback={<div>Loading...</div>}>
 *   <CursorCategory />
 * </Suspense>
 * ```
 */

// ============================================================================
// TYPES
// ============================================================================

export interface CursorCategoryProps {
  /**
   * Optional CSS class
   */
  className?: string;
  /**
   * Default active sub-tab ('crosshair' | 'cursor')
   */
  defaultTab?: CursorSubTab;
}

/**
 * Cursor sub-tabs union type
 */
export type CursorSubTab = 'crosshair' | 'cursor';

// ============================================================================
// COMPONENT
// ============================================================================

export const CursorCategory: React.FC<CursorCategoryProps> = ({
  className = '',
  defaultTab = 'crosshair'
}) => {
  const { t } = useTranslation('dxf-viewer');
  const { getStatusBorder, getDirectionalBorder } = useBorderTokens();
  // ============================================================================
  // HOOKS
  // ============================================================================

  // Tab navigation state (ADR-005)
  const { activeTab, setActiveTab } = useTabNavigation<CursorSubTab>(defaultTab);

  // ============================================================================
  // TAB CONFIGURATION - 🏢 ENTERPRISE: Using centralized TabDefinition interface
  // ============================================================================

  const cursorTabs: TabDefinition[] = [
    {
      id: 'crosshair',
      label: t('crosshairSettings.title'),
      icon: Crosshair,
      content: null, // Content rendered separately below
    },
    {
      id: 'cursor',
      label: t('cursorSettings.title'),
      icon: MousePointer2,
      content: null, // Content rendered separately below
    },
  ];

  // 🏢 ENTERPRISE: Handle tab change - convert string to CursorSubTab
  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId as CursorSubTab);
  };

  // ============================================================================
  // RENDER TAB CONTENT
  // ============================================================================

  const renderTabContent = () => {
    switch (activeTab) {
      case 'crosshair':
        return <CrosshairSettings />;
      case 'cursor':
        return <CursorSettings />;
      default:
        return <CrosshairSettings />;
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <section className={className}>
      {/* 🏢 ENTERPRISE: Tab Navigation - Using centralized TabsOnlyTriggers */}
      <nav className={`${getDirectionalBorder('default', 'bottom')} ${PANEL_LAYOUT.MARGIN.BOTTOM_LG}`}>
        <TabsOnlyTriggers
          tabs={cursorTabs}
          value={activeTab}
          onTabChange={handleTabChange}
          theme="dark"
          alwaysShowLabels={true}
        />
      </nav>

      {/* Tab Content - 🏢 ENTERPRISE: Padding now handled by SpecificSettingsPanel.CONTENT_WRAPPER */}
      {renderTabContent()}
    </section>
  );
};

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default CursorCategory;

/**
 * MIGRATION NOTES: Extracted from DxfSettingsPanel.tsx lines 801-1183
 *
 * Original code:
 * ```tsx
 * case 'cursor':
 *   return (
 *     <div className="p-4">
 *       {/* Sub-navigation tabs *\/}
 *       <div className="flex gap-1 mb-4 border-b {getStatusBorder('default')} pb-2">
 *         <button onClick={() => setActiveCursorTab('crosshair')}>Ρυθμίσεις Σταυρονήματος</button>
 *         <button onClick={() => setActiveCursorTab('cursor')}>Ρυθμίσεις Κέρσορα</button>
 *       </div>
 *       {activeCursorTab === 'crosshair' ? (
 *         <div className="space-y-4">
 *           {/* Inline Crosshair UI (400+ lines) *\/}
 *         </div>
 *       ) : (
 *         <CursorSettings />
 *       )}
 *     </div>
 *   );
 * ```
 *
 * Changes:
 * - ✅ Extracted inline Crosshair UI to CrosshairSettings.tsx (400+ lines)
 * - ✅ Created CursorCategory router with tab navigation
 * - ✅ Integrated useTabNavigation hook (ADR-005)
 * - ✅ Integrated TabNavigation UI component (ADR-004)
 * - ✅ Clean separation of concerns (routing vs UI)
 *
 * Benefits:
 * - ✅ Single Responsibility (CursorCategory = Routing only)
 * - ✅ Reusable CrosshairSettings component
 * - ✅ Testable in isolation
 * - ✅ Consistent pattern with GeneralSettingsPanel
 * - ✅ Cleaner parent component (SpecificSettingsPanel)
 */
