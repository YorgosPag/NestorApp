// LinesTab.tsx - Lines settings tab (extracted from DxfSettingsPanel)
// STATUS: ACTIVE - Phase 2 Step 2.1
// PURPOSE: Lines settings UI (General Settings → Lines tab)

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║                        CROSS-REFERENCES (Documentation)                    ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * 📋 Migration Checklist:
 *    - docs/dxf-settings/MIGRATION_CHECKLIST.md (STEP 2.1 - Implementation)
 *
 * 🏗️ Architecture:
 *    - docs/dxf-settings/ARCHITECTURE.md (§3.1 General Tabs - LinesTab)
 *
 * 📖 Component Guide:
 *    - docs/dxf-settings/COMPONENT_GUIDE.md (§3.1 LinesTab)
 *
 * 📊 State Management:
 *    - docs/dxf-settings/STATE_MANAGEMENT.md (§3.1 Line Settings State)
 *
 * 📝 Decision Log:
 *    - docs/dxf-settings/DECISION_LOG.md (ADR-006: Keep Settings Components Unchanged)
 *
 * 📚 Roadmap:
 *    - docs/REFACTORING_ROADMAP_ColorPalettePanel.md (Phase 2, Step 2.1)
 *
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║                      RELATED CODE FILES                                    ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Parent:
 *    - panels/GeneralSettingsPanel.tsx (lazy loaded)
 *
 * Uses (Settings Components):
 *    - settings/core/LineSettings.tsx (line properties UI)
 *
 * Uses (Provider):
 *    - providers/DxfSettingsProvider.tsx (useLineSettingsFromProvider)
 *
 * Extracted from:
 *    - ui/components/DxfSettingsPanel.tsx (lines 2210-2212, originally ColorPalettePanel)
 */

import React from 'react';
import { LineSettings } from '../../settings/core/LineSettings';

/**
 * LinesTab - Lines settings tab for General settings
 *
 * Purpose:
 * - Display LineSettings component (color, width, style)
 * - Simple wrapper - all logic lives in LineSettings
 *
 * Architecture Decision (ADR-006):
 * - Keep LineSettings.tsx unchanged (already well-structured)
 * - LinesTab is just a thin wrapper for routing
 *
 * State:
 * - NO local state (all state in DxfSettingsProvider via LineSettings)
 * - useLineSettingsFromProvider() called inside LineSettings.tsx
 *
 * @see docs/dxf-settings/COMPONENT_GUIDE.md#LinesTab
 * @see docs/dxf-settings/STATE_MANAGEMENT.md - State ownership
 * @see docs/dxf-settings/DECISION_LOG.md - ADR-006
 *
 * @example
 * ```tsx
 * // In GeneralSettingsPanel.tsx
 * <Suspense fallback={<div>Loading...</div>}>
 *   <LinesTab />
 * </Suspense>
 * ```
 */

// ============================================================================
// TYPES
// ============================================================================

export interface LinesTabProps {
  /**
   * Optional CSS class
   */
  className?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const LinesTab: React.FC<LinesTabProps> = ({ className = '' }) => {
  // ============================================================================
  // NO LOCAL STATE
  // ============================================================================
  // All state management happens inside LineSettings component via
  // useLineSettingsFromProvider() hook.
  //
  // This follows the Single Responsibility Principle:
  // - LinesTab: Routing/UI wrapper
  // - LineSettings: Business logic + state
  // - DxfSettingsProvider: Data storage

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className={className}>
      {/* Line Settings Component */}
      <LineSettings />
    </div>
  );
};

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default LinesTab;

/**
 * MIGRATION NOTES (από DxfSettingsPanel.tsx):
 *
 * Original code (lines 2210-2212):
 * ```tsx
 * {activeGeneralTab === 'lines' && (
 *   <LineSettings />
 * )}
 * ```
 *
 * Changes:
 * - ✅ Extracted conditional rendering to parent (GeneralSettingsPanel)
 * - ✅ Wrapped LineSettings in LinesTab component
 * - ✅ NO changes to LineSettings.tsx (ADR-006)
 * - ✅ Lazy loading via LazyComponents.tsx
 *
 * Benefits:
 * - ✅ Single Responsibility (LinesTab = Lines UI only)
 * - ✅ Testable in isolation
 * - ✅ Lazy loadable (performance)
 * - ✅ No state duplication
 */
