// LayersCategory.tsx - Layers settings category (extracted from DxfSettingsPanel)
// STATUS: ACTIVE - Phase 3 Step 3.5
// PURPOSE: Layers settings UI (Specific Settings → Layers category)

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║  CROSS-REFERENCES: docs/dxf-settings/MIGRATION_CHECKLIST.md (STEP 3.5)    ║
 * ║  Parent: panels/SpecificSettingsPanel.tsx                                  ║
 * ║  Uses: settings/special/LayersSettings.tsx                                 ║
 * ║  ADR: docs/dxf-settings/DECISION_LOG.md (ADR-006)                         ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 */

import React from 'react';
import { LayersSettings } from '../settings/special/LayersSettings';

export interface LayersCategoryProps {
  className?: string;
}

export const LayersCategory: React.FC<LayersCategoryProps> = ({ className = '' }) => {
  return (
    <div className={className}>
      <LayersSettings />
    </div>
  );
};

export default LayersCategory;

/**
 * MIGRATION NOTES: Extracted from DxfSettingsPanel.tsx line 2109
 * Original: case 'layers': return <LayersSettings />;
 */
