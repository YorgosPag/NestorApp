// EntitiesCategory.tsx - Entities category settings
// STATUS: PLACEHOLDER - Phase 1 Step 1.2
// TODO: Implement in Phase 3 (STEP 3.4)

import React from 'react';

/**
 * EntitiesCategory - Entities settings category
 *
 * Contains:
 * - EntitiesSettings component (entity rendering, colors, etc.)
 *
 * State:
 * - useEntitiesSettingsFromProvider()
 *
 * @see docs/dxf-settings/COMPONENT_GUIDE.md#EntitiesCategory
 */

export interface EntitiesCategoryProps {
  className?: string;
}

export const EntitiesCategory: React.FC<EntitiesCategoryProps> = ({
  className = '',
}) => {
  return (
    <div className={`entities-category ${className}`}>
      <h4>Entities Category (Placeholder)</h4>
      <p>🚧 Under Construction - Phase 3 Step 3.4</p>
    </div>
  );
};

export default EntitiesCategory;
