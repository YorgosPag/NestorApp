'use client';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║  DxfSettingsPanel - Main settings panel with General/Specific tabs        ║
 * ║  STATUS: REFACTORED - Phase 4 Complete (2025-10-07)                       ║
 * ║  PURPOSE: Top-level router for DXF settings (General/Specific)            ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * ARCHITECTURE:
 * - Main panel with 2 tabs: General, Specific
 * - General tab → GeneralSettingsPanel (handles Lines, Text, Grips)
 * - Specific tab → SpecificSettingsPanel (handles 7 categories)
 *
 * REFACTORING HISTORY:
 * - Phase 1: Created infrastructure (hooks, UI components, icons)
 * - Phase 2: Extracted General Settings (Lines, Text, Grips)
 * - Phase 3: Extracted Specific Settings (7 categories)
 * - Phase 4: Integrated panel routers, removed 2000+ lines of inline code
 *
 * BEFORE REFACTORING: 2157 lines (monolithic, all inline)
 * AFTER REFACTORING: ~90 lines (clean, modular)
 *
 * CROSS-REFERENCES:
 * - docs/dxf-settings/ARCHITECTURE.md - Complete architecture overview
 * - docs/dxf-settings/COMPONENT_GUIDE.md - Component-by-component guide
 * - docs/dxf-settings/MIGRATION_CHECKLIST.md - Full migration checklist
 * - panels/GeneralSettingsPanel.tsx - General settings router
 * - panels/SpecificSettingsPanel.tsx - Specific settings router
 */

import React, { useState } from 'react';
import { GeneralSettingsPanel } from './dxf-settings/panels/GeneralSettingsPanel';
import { SpecificSettingsPanel } from './dxf-settings/panels/SpecificSettingsPanel';

/**
 * DxfSettingsPanelProps - Props for DxfSettingsPanel
 */
export interface DxfSettingsPanelProps {
  /**
   * Optional CSS class for styling
   */
  className?: string;
}

/**
 * MainTab - Union type for main tabs
 */
type MainTab = 'general' | 'specific';

/**
 * DxfSettingsPanel - Main settings panel component
 *
 * Purpose:
 * - Top-level router for DXF settings
 * - 2 main tabs: General (Lines, Text, Grips), Specific (7 categories)
 * - Clean separation of concerns - NO inline settings UI
 *
 * Architecture:
 * - Uses GeneralSettingsPanel for General tab
 * - Uses SpecificSettingsPanel for Specific tab
 * - Local state for active main tab (useState)
 * - NO settings state management (delegated to child panels)
 *
 * State:
 * - activeMainTab: Currently selected main tab (general | specific)
 *
 * @see docs/dxf-settings/COMPONENT_GUIDE.md#DxfSettingsPanel
 * @see docs/dxf-settings/ARCHITECTURE.md - Panel routing pattern
 *
 * @example
 * ```tsx
 * // In parent component
 * <DxfSettingsPanel className="w-full h-full" />
 * ```
 */
export function DxfSettingsPanel({ className = '' }: DxfSettingsPanelProps) {
  // ============================================================================
  // STATE
  // ============================================================================

  /**
   * Active main tab state
   * - Default: 'specific' (most used tab)
   */
  const [activeMainTab, setActiveMainTab] = useState<MainTab>('specific');

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className={`bg-gray-800 text-white ${className}`}>
      {/* Main Tabs - General/Specific */}
      <div className="border-b border-gray-600 mb-4">
        <nav className="flex gap-1 p-2">
          <button
            onClick={() => setActiveMainTab('general')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeMainTab === 'general'
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            Γενικές Ρυθμίσεις
          </button>
          <button
            onClick={() => setActiveMainTab('specific')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeMainTab === 'specific'
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            Ειδικές Ρυθμίσεις
          </button>
        </nav>
      </div>

      {/* Content based on active main tab */}
      {activeMainTab === 'general' && (
        <GeneralSettingsPanel className="min-h-[850px] max-h-[96vh] overflow-y-auto" />
      )}

      {activeMainTab === 'specific' && (
        <SpecificSettingsPanel />
      )}
    </div>
  );
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * REFACTORING NOTES
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * BEFORE (Phase 0 - Monolithic):
 * - 2157 lines total
 * - All settings inline (General + Specific)
 * - Multiple useState for every setting
 * - Complex nested structure
 * - Hard to maintain, test, and extend
 *
 * AFTER (Phase 4 - Modular):
 * - ~90 lines (96% reduction!)
 * - Clean separation of concerns
 * - Single Responsibility (DxfSettingsPanel = Main routing only)
 * - GeneralSettingsPanel handles General settings
 * - SpecificSettingsPanel handles Specific settings
 * - Easy to maintain, test, and extend
 *
 * EXTRACTED COMPONENTS:
 *
 * General Settings (Phase 2):
 * - panels/GeneralSettingsPanel.tsx (router)
 * - settings/core/LineSettings.tsx (already existed)
 * - settings/core/TextSettings.tsx (already existed)
 * - settings/core/GripSettings.tsx (already existed)
 * - settings/shared/LinePreview.tsx (already existed)
 * - settings/shared/CurrentSettingsDisplay.tsx (already existed)
 *
 * Specific Settings (Phase 3):
 * - panels/SpecificSettingsPanel.tsx (router)
 * - categories/SelectionCategory.tsx (wrapper)
 * - categories/CursorCategory.tsx (router with 2 sub-tabs)
 * - categories/GridCategory.tsx (router with 2 main tabs)
 * - categories/LayersCategory.tsx (wrapper)
 * - categories/EntitiesCategory.tsx (wrapper)
 * - categories/GripsCategory.tsx (coming soon)
 * - categories/LightingCategory.tsx (coming soon)
 * - settings/special/CrosshairSettings.tsx (560 lines)
 * - settings/special/GridSettings.tsx (378 lines)
 * - settings/special/RulersSettings.tsx (router with 4 sub-tabs)
 * - settings/special/rulers/RulerBackgroundSettings.tsx (324 lines)
 * - settings/special/rulers/RulerLinesSettings.tsx (485 lines)
 * - settings/special/rulers/RulerTextSettings.tsx (196 lines)
 * - settings/special/rulers/RulerUnitsSettings.tsx (268 lines)
 *
 * BENEFITS:
 * ✅ Single Responsibility (main routing only)
 * ✅ Clean separation of concerns
 * ✅ Lazy loading support (performance)
 * ✅ Easy to test in isolation
 * ✅ Easy to extend (add new tabs/categories)
 * ✅ Consistent architecture across all panels
 * ✅ 96% code reduction in main panel
 * ✅ Improved maintainability
 *
 * TECHNICAL PATTERNS:
 * - ADR-001: Component Extraction Strategy
 * - ADR-002: State Management Strategy
 * - ADR-003: Keep existing Settings components
 * - ADR-004: Create thin wrappers/routers
 * - ADR-005: Tab navigation pattern (useTabNavigation hook)
 * - ADR-006: Lazy loading for categories (React.lazy + Suspense)
 *
 * TESTING:
 * - All General settings work (Lines, Text, Grips)
 * - All Specific categories work (Selection, Cursor, Grid, etc.)
 * - Tab navigation works correctly
 * - Settings persistence works (localStorage)
 * - Live preview works (cursor, grid, rulers)
 *
 * RELATED DOCUMENTATION:
 * - docs/dxf-settings/ARCHITECTURE.md - Complete architecture overview
 * - docs/dxf-settings/COMPONENT_GUIDE.md - Component-by-component guide
 * - docs/dxf-settings/MIGRATION_CHECKLIST.md - Full migration checklist
 * - docs/dxf-settings/TESTING_CHECKLIST.md - Testing checklist
 *
 * @see panels/GeneralSettingsPanel.tsx - General settings router
 * @see panels/SpecificSettingsPanel.tsx - Specific settings router
 * @see hooks/useTabNavigation.ts - Tab navigation hook (ADR-005)
 * @see ui/TabNavigation.tsx - Tab navigation component (ADR-004)
 */
