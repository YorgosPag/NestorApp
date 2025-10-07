// TextTab.tsx - Text settings tab (extracted from DxfSettingsPanel)
// STATUS: ACTIVE - Phase 2 Step 2.2
// PURPOSE: Text settings UI (General Settings → Text tab)

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║                        CROSS-REFERENCES (Documentation)                    ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * 📋 Migration Checklist:
 *    - docs/dxf-settings/MIGRATION_CHECKLIST.md (STEP 2.2 - Implementation)
 *
 * 🏗️ Architecture:
 *    - docs/dxf-settings/ARCHITECTURE.md (§3.1 General Tabs - TextTab)
 *
 * 📖 Component Guide:
 *    - docs/dxf-settings/COMPONENT_GUIDE.md (§3.2 TextTab)
 *
 * 📊 State Management:
 *    - docs/dxf-settings/STATE_MANAGEMENT.md (§3.2 Text Settings State)
 *
 * 📝 Decision Log:
 *    - docs/dxf-settings/DECISION_LOG.md (ADR-006: Keep Settings Components Unchanged)
 *
 * 📚 Roadmap:
 *    - docs/REFACTORING_ROADMAP_ColorPalettePanel.md (Phase 2, Step 2.2)
 *
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║                      RELATED CODE FILES                                    ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Parent:
 *    - panels/GeneralSettingsPanel.tsx (lazy loaded)
 *
 * Uses (Settings Components):
 *    - settings/core/TextSettings.tsx (text properties UI)
 *
 * Uses (Provider):
 *    - providers/DxfSettingsProvider.tsx (useTextSettingsFromProvider)
 *
 * Extracted from:
 *    - ui/components/DxfSettingsPanel.tsx (lines 2214-2216, originally ColorPalettePanel)
 */

import React from 'react';
import { TextSettings } from '../../settings/core/TextSettings';

/**
 * TextTab - Text settings tab for General settings
 *
 * Purpose:
 * - Display TextSettings component (font, size, color, style)
 * - Simple wrapper - all logic lives in TextSettings
 *
 * Architecture Decision (ADR-006):
 * - Keep TextSettings.tsx unchanged (already well-structured)
 * - TextTab is just a thin wrapper for routing
 *
 * State:
 * - NO local state (all state in DxfSettingsProvider via TextSettings)
 * - useTextSettingsFromProvider() called inside TextSettings.tsx
 *
 * @see docs/dxf-settings/COMPONENT_GUIDE.md#TextTab
 * @see docs/dxf-settings/STATE_MANAGEMENT.md - State ownership
 * @see docs/dxf-settings/DECISION_LOG.md - ADR-006
 *
 * @example
 * ```tsx
 * // In GeneralSettingsPanel.tsx
 * <Suspense fallback={<div>Loading...</div>}>
 *   <TextTab />
 * </Suspense>
 * ```
 */

// ============================================================================
// TYPES
// ============================================================================

export interface TextTabProps {
  /**
   * Optional CSS class
   */
  className?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const TextTab: React.FC<TextTabProps> = ({ className = '' }) => {
  // ============================================================================
  // NO LOCAL STATE
  // ============================================================================
  // All state management happens inside TextSettings component via
  // useTextSettingsFromProvider() hook.
  //
  // This follows the Single Responsibility Principle:
  // - TextTab: Routing/UI wrapper
  // - TextSettings: Business logic + state
  // - DxfSettingsProvider: Data storage

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className={className}>
      {/* Text Settings Component */}
      <TextSettings />
    </div>
  );
};

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default TextTab;

/**
 * MIGRATION NOTES (από DxfSettingsPanel.tsx):
 *
 * Original code (lines 2214-2216):
 * ```tsx
 * {activeGeneralTab === 'text' && (
 *   <TextSettings />
 * )}
 * ```
 *
 * Changes:
 * - ✅ Extracted conditional rendering to parent (GeneralSettingsPanel)
 * - ✅ Wrapped TextSettings in TextTab component
 * - ✅ NO changes to TextSettings.tsx (ADR-006)
 * - ✅ Lazy loading via LazyComponents.tsx
 *
 * Benefits:
 * - ✅ Single Responsibility (TextTab = Text UI only)
 * - ✅ Testable in isolation
 * - ✅ Lazy loadable (performance)
 * - ✅ No state duplication
 * - ✅ Same pattern as LinesTab (consistency)
 */
