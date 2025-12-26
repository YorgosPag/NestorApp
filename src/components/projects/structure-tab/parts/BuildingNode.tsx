'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Building2 } from 'lucide-react';
import { UnitNode } from './UnitNode';
import { HOVER_BACKGROUND_EFFECTS, TRANSITION_PRESETS } from '@/components/ui/effects';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import type { BuildingModel } from '../types';

export const BuildingNode = ({ building }: { building: BuildingModel }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const { quick } = useBorderTokens();

  const soldUnits = building.units.filter((u: any) => u.status === 'sold').length;
  const totalUnits = building.units.length;
  const totalArea = building.units.reduce((sum: number, u: any) => sum + (u.area || 0), 0);
  const soldArea = building.units.filter((u: any) => u.status === 'sold').reduce((sum: number, u: any) => sum + (u.area || 0), 0);

  return (
    <div className={`ml-4 pl-4 border-l-2 ${quick.muted}`}>
      <div
        className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer border bg-white dark:bg-gray-800/50 ${HOVER_BACKGROUND_EFFECTS.LIGHT} ${TRANSITION_PRESETS.STANDARD_COLORS}`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {isExpanded ? 
          <ChevronDown size={20} className="text-gray-600 dark:text-gray-400" /> : 
          <ChevronRight size={20} className="text-gray-600 dark:text-gray-400" />
        }
        <Building2 className="text-blue-600 dark:text-blue-400" size={20} />
        <div className="flex-1">
          <div className="font-semibold text-gray-800 dark:text-gray-200">{building.name}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {totalUnits} μονάδες • {totalArea.toFixed(1)} m² • {soldUnits}/{totalUnits} πωλημένες
          </div>
        </div>
        <div className="text-right text-sm">
          <div className="font-semibold text-green-600">
            {totalUnits > 0 ? ((soldUnits / totalUnits) * 100).toFixed(1) : 0}% πωλήσεις
          </div>
          <div className="text-gray-500">
            {soldArea.toFixed(1)} m² πωληθέντα
          </div>
        </div>
      </div>
      {isExpanded && (
        <div className="ml-8 mt-2 space-y-2">
          {building.units.map(unit => <UnitNode key={unit.id} unit={unit} />)}
        </div>
      )}
    </div>
  );
};
