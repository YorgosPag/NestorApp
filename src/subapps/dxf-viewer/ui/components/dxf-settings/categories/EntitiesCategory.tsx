// EntitiesCategory.tsx - Entities settings category (extracted from DxfSettingsPanel)
// STATUS: ACTIVE - Phase 3 Step 3.6
// PURPOSE: Entities settings UI (Specific Settings → Entities category)

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║  CROSS-REFERENCES: docs/dxf-settings/MIGRATION_CHECKLIST.md (STEP 3.6)    ║
 * ║  Parent: panels/SpecificSettingsPanel.tsx                                  ║
 * ║  Uses: settings/special/EntitiesSettings.tsx                               ║
 * ║  ADR: docs/dxf-settings/DECISION_LOG.md (ADR-006)                         ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 */

import React from 'react';
import { EntitiesSettings } from '../settings/special/EntitiesSettings';

export interface EntitiesCategoryProps {
  className?: string;
}

export const EntitiesCategory: React.FC<EntitiesCategoryProps> = ({ className = '' }) => {
  return (
    <div className={className}>
      <EntitiesSettings />
    </div>
  );
};

export default EntitiesCategory;

/**
 * MIGRATION NOTES: Extracted from DxfSettingsPanel.tsx line 2106
 * Original: case 'entities': return <EntitiesSettings />;
 * Note: EntitiesSettings is 560 lines (may need future refactoring)
 */
