'use client';

import React from 'react';
import { Layers } from 'lucide-react';
import type { SceneModel } from '../../../../types/scene';

interface LayersHeaderProps {
  scene: SceneModel | null;
}

export const LayersHeader = ({ scene }: LayersHeaderProps) => {
  return (
    <div className="flex items-center justify-between">
      <h3 className="text-sm font-medium text-green-400 flex items-center gap-2">
        <Layers className="w-4 h-4" />
        DXF Layers ({Object.keys(scene?.layers || {}).length})
      </h3>
      <div className="text-xs text-gray-400">
        Κλικ για επιλογή
      </div>
    </div>
  );
};