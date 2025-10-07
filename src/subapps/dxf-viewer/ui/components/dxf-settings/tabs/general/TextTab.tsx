// TextTab.tsx - Text settings tab (extracted from ColorPalettePanel)
// STATUS: PLACEHOLDER - Phase 1 Step 1.2
// TODO: Implement in Phase 2 (STEP 2.2)

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║                        CROSS-REFERENCES (Documentation)                    ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * 📋 Migration Checklist:
 *    - docs/dxf-settings/MIGRATION_CHECKLIST.md (STEP 1.2 - Placeholder)
 *    - docs/dxf-settings/MIGRATION_CHECKLIST.md (STEP 2.2 - Implementation)
 *
 * 🏗️ Architecture:
 *    - docs/dxf-settings/ARCHITECTURE.md (§3.2 General Tabs - TextTab)
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
 *    - panels/GeneralSettingsPanel.tsx
 *
 * Uses (Settings Components):
 *    - settings/core/TextSettings.tsx
 *
 * Uses (Hooks):
 *    - hooks/useSettingsPreview.ts (useTextPreview)
 */

import React from 'react';

/**
 * TextTab - Text settings tab for General settings
 *
 * Contains:
 * - TextSettings component (color, font, size)
 * - TextPreview component (if needed)
 *
 * State:
 * - useTextSettingsFromProvider() - text color, font, size
 *
 * @see docs/dxf-settings/COMPONENT_GUIDE.md#TextTab
 * @see docs/dxf-settings/STATE_MANAGEMENT.md - State ownership
 */

export interface TextTabProps {
  className?: string;
}

export const TextTab: React.FC<TextTabProps> = ({ className = '' }) => {
  return (
    <div className={`text-tab ${className}`}>
      <h4>Text Tab (Placeholder)</h4>
      <p>Settings: Color | Font | Size</p>
      <p>🚧 Under Construction - Phase 2 Step 2.2</p>
    </div>
  );
};

export default TextTab;
