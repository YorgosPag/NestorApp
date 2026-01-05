'use client';

import React from 'react';
import { Layers } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { PANEL_LAYOUT } from '../../../../config/panel-tokens';
import type { SceneModel } from '../../../../types/scene';

interface LayersHeaderProps {
  scene: SceneModel | null;
}

export const LayersHeader = ({ scene }: LayersHeaderProps) => {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  return (
    <div className="flex items-center justify-between">
      <h3 className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.success} flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
        <Layers className={iconSizes.sm} />
        DXF Layers ({Object.keys(scene?.layers || {}).length})
      </h3>
      <div className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted}`}>
        Κλικ για επιλογή
      </div>
    </div>
  );
};