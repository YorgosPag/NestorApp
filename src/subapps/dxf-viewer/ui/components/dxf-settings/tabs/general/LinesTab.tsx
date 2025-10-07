// LinesTab.tsx - Lines settings tab (extracted from ColorPalettePanel)
// STATUS: PLACEHOLDER - Phase 1 Step 1.2
// TODO: Implement in Phase 2 (STEP 2.1)

import React from 'react';

/**
 * LinesTab - Lines settings tab for General settings
 *
 * Contains:
 * - LineSettings component (color, width, style)
 * - LinePreview component
 *
 * State:
 * - useLineSettingsFromProvider() - line color, width, style
 * - Local state: selected line type
 *
 * @see docs/dxf-settings/COMPONENT_GUIDE.md#LinesTab
 * @see docs/dxf-settings/STATE_MANAGEMENT.md - State ownership
 */

export interface LinesTabProps {
  className?: string;
}

export const LinesTab: React.FC<LinesTabProps> = ({ className = '' }) => {
  return (
    <div className={`lines-tab ${className}`}>
      <h4>Lines Tab (Placeholder)</h4>
      <p>Settings: Color | Width | Style</p>
      <p>🚧 Under Construction - Phase 2 Step 2.1</p>
    </div>
  );
};

export default LinesTab;
