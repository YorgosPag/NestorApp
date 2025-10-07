// DrawingCategory.tsx - Χάραξη (Drawing) category settings
// STATUS: PLACEHOLDER - Phase 1 Step 1.2
// TODO: Implement in Phase 3 (STEP 3.6)

import React from 'react';

/**
 * DrawingCategory - Χάραξη (Drawing) settings category
 *
 * Contains:
 * - Drawing tools, snap settings, etc.
 *
 * State:
 * - useDrawingSettingsFromProvider()
 *
 * @see docs/dxf-settings/COMPONENT_GUIDE.md#DrawingCategory
 */

export interface DrawingCategoryProps {
  className?: string;
}

export const DrawingCategory: React.FC<DrawingCategoryProps> = ({
  className = '',
}) => {
  return (
    <div className={`drawing-category ${className}`}>
      <h4>Χάραξη (Drawing) Category (Placeholder)</h4>
      <p>🚧 Under Construction - Phase 3 Step 3.6</p>
    </div>
  );
};

export default DrawingCategory;
