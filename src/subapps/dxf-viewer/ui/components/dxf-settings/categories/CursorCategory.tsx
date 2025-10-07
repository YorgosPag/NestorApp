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
import { useTabNavigation } from '../../hooks/useTabNavigation';
import { TabNavigation } from '../../ui/TabNavigation';
import { CrosshairSettings } from '../settings/special/CrosshairSettings';
import { CursorSettings } from '../settings/special/CursorSettings';

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
  // ============================================================================
  // HOOKS
  // ============================================================================

  // Tab navigation state (ADR-005)
  const { activeTab, setActiveTab } = useTabNavigation<CursorSubTab>(defaultTab);

  // ============================================================================
  // TAB CONFIGURATION
  // ============================================================================

  const tabs = [
    { id: 'crosshair' as const, label: 'Ρυθμίσεις Σταυρονήματος' },
    { id: 'cursor' as const, label: 'Ρυθμίσεις Κέρσορα' }
  ];

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
 *       <div className="flex gap-1 mb-4 border-b border-gray-600 pb-2">
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
