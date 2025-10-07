// LightingCategory.tsx - Lighting category settings (Coming Soon)
// STATUS: ACTIVE - Phase 3 Step 3.7
// PURPOSE: Lighting settings UI (Specific Settings → Lighting category - Coming Soon)

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║  CROSS-REFERENCES: docs/dxf-settings/MIGRATION_CHECKLIST.md (STEP 3.7)    ║
 * ║  Parent: panels/SpecificSettingsPanel.tsx                                  ║
 * ║  Uses: settings/ComingSoonSettings.tsx                                     ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 */

import React from 'react';
import { ComingSoonSettings } from '../settings/ComingSoonSettings';

export interface LightingCategoryProps {
  className?: string;
}

export const LightingCategory: React.FC<LightingCategoryProps> = ({ className = '' }) => {
  return (
    <div className={className}>
      <ComingSoonSettings />
    </div>
  );
};

export default LightingCategory;

/**
 * MIGRATION NOTES: Extracted from DxfSettingsPanel.tsx line 2112 (default case)
 * Original: default: return <ComingSoonSettings />;
 * Status: Coming Soon (lighting category marked comingSoon: true)
 */
