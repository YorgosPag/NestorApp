'use client';

import React from 'react';
import { Layers } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import type { SceneModel } from '../../../../types/scene';

interface LayersHeaderProps {
  scene: SceneModel | null;
}

export const LayersHeader = ({ scene }: LayersHeaderProps) => {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  return (
    <div className="flex items-center justify-between">
      <h3 className={`text-sm font-medium ${colors.text.success} flex items-center gap-2`}>
        <Layers className={iconSizes.sm} />
        DXF Layers ({Object.keys(scene?.layers || {}).length})
      </h3>
      <div className={`text-xs ${colors.text.muted}`}>
        Κλικ για επιλογή
      </div>
    </div>
  );
};