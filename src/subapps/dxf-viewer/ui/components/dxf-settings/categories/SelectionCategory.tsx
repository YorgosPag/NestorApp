// SelectionCategory.tsx - Selection settings category (extracted from DxfSettingsPanel)
// STATUS: ACTIVE - Phase 3 Step 3.1
// PURPOSE: Selection settings UI (Specific Settings → Selection category)

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║                        CROSS-REFERENCES (Documentation)                    ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * 📋 Migration Checklist:
 *    - docs/dxf-settings/MIGRATION_CHECKLIST.md (STEP 3.1 - Implementation)
 *
 * 🏗️ Architecture:
 *    - docs/dxf-settings/ARCHITECTURE.md (§4 Categories - SelectionCategory)
 *
 * 📖 Component Guide:
 *    - docs/dxf-settings/COMPONENT_GUIDE.md (§4.1 SelectionCategory)
 *
 * 📊 State Management:
 *    - docs/dxf-settings/STATE_MANAGEMENT.md (§4.1 Selection Settings State)
 *
 * 📝 Decision Log:
 *    - docs/dxf-settings/DECISION_LOG.md (ADR-006: Keep Settings Components Unchanged)
 *
 * 📚 Roadmap:
 *    - docs/REFACTORING_ROADMAP_ColorPalettePanel.md (Phase 3, Step 3.1)
 *
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║                      RELATED CODE FILES                                    ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Parent:
 *    - panels/SpecificSettingsPanel.tsx (lazy loaded)
 *
 * Uses (Settings Components):
 *    - settings/special/SelectionSettings.tsx (selection properties UI)
 *
 * Uses (Provider):
 *    - providers/DxfSettingsProvider.tsx (selection settings)
 *
 * Extracted from:
 *    - ui/components/DxfSettingsPanel.tsx (line 1186, originally ColorPalettePanel)
 */

import React from 'react';
import { SelectionSettings } from '../settings/special/SelectionSettings';

/**
 * SelectionCategory - Selection settings category for Specific settings
 *
 * Purpose:
 * - Display SelectionSettings component (window/crossing selection colors, styles)
 * - Simple wrapper - all logic lives in SelectionSettings
 *
 * Architecture Decision (ADR-006):
 * - Keep SelectionSettings.tsx unchanged (already well-structured)
 * - SelectionCategory is just a thin wrapper for routing
 *
 * State:
 * - NO local state (all state in DxfSettingsProvider via SelectionSettings)
 * - Selection settings accessed inside SelectionSettings.tsx
 *
 * @see docs/dxf-settings/COMPONENT_GUIDE.md#SelectionCategory
 * @see docs/dxf-settings/STATE_MANAGEMENT.md - State ownership
 * @see docs/dxf-settings/DECISION_LOG.md - ADR-006
 *
 * @example
 * ```tsx
 * // In SpecificSettingsPanel.tsx
 * <Suspense fallback={<div>Loading...</div>}>
 *   <SelectionCategory />
 * </Suspense>
 * ```
 */

// ============================================================================
// TYPES
// ============================================================================

export interface SelectionCategoryProps {
  /**
   * Optional CSS class
   */
  className?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const SelectionCategory: React.FC<SelectionCategoryProps> = ({
  className = '',
}) => {
  // ============================================================================
  // NO LOCAL STATE
  // ============================================================================
  // All state management happens inside SelectionSettings component.
  //
  // This follows the Single Responsibility Principle:
  // - SelectionCategory: Routing/UI wrapper
  // - SelectionSettings: Business logic + state
  // - DxfSettingsProvider: Data storage

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className={className}>
      {/* Selection Settings Component */}
      <SelectionSettings />
    </div>
  );
};

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default SelectionCategory;

/**
 * MIGRATION NOTES (από DxfSettingsPanel.tsx):
 *
 * Original code (line 1186):
 * ```tsx
 * case 'selection':
 *   return <SelectionSettings />;
 * ```
 *
 * Changes:
 * - ✅ Extracted conditional rendering to parent (SpecificSettingsPanel)
 * - ✅ Wrapped SelectionSettings in SelectionCategory component
 * - ✅ NO changes to SelectionSettings.tsx (ADR-006)
 * - ✅ Lazy loading via LazyComponents.tsx
 *
 * Benefits:
 * - ✅ Single Responsibility (SelectionCategory = Selection UI only)
 * - ✅ Testable in isolation
 * - ✅ Lazy loadable (performance)
 * - ✅ No state duplication
 * - ✅ Same pattern as General tabs (consistency)
 */
