'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Building2 } from 'lucide-react';
import { UnitNode } from './UnitNode';
import { HOVER_BACKGROUND_EFFECTS, TRANSITION_PRESETS } from '@/components/ui/effects';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import type { BuildingModel } from '../types';

export const BuildingNode = ({ building }: { building: BuildingModel }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const { quick } = useBorderTokens();
  const colors = useSemanticColors();

  const soldUnits = building.units.filter((u: any) => u.status === 'sold').length;
  const totalUnits = building.units.length;
  const totalArea = building.units.reduce((sum: number, u: any) => sum + (u.area || 0), 0);
  const soldArea = building.units.filter((u: any) => u.status === 'sold').reduce((sum: number, u: any) => sum + (u.area || 0), 0);

  return (
    <div className={`ml-4 pl-4 border-l-2 ${quick.muted}`}>
      <div
        className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer border ${colors.bg.primary} ${HOVER_BACKGROUND_EFFECTS.LIGHT} ${TRANSITION_PRESETS.STANDARD_COLORS}`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {isExpanded ? 
          <ChevronDown size={20} className={`${colors.text.muted}`} /> :
          <ChevronRight size={20} className={`${colors.text.muted}`} />
        }
        <Building2 className={`${colors.text.info}`} size={20} />
        <div className="flex-1">
          <div className={`font-semibold ${colors.text.foreground}`}>{building.name}</div>
          <div className={`text-sm ${colors.text.muted}`}>
            {totalUnits} μονάδες • {totalArea.toFixed(1)} m² • {soldUnits}/{totalUnits} πωλημένες
          </div>
        </div>
        <div className="text-right text-sm">
          <div className={`font-semibold ${colors.text.success}`}>
            {totalUnits > 0 ? ((soldUnits / totalUnits) * 100).toFixed(1) : 0}% πωλήσεις
          </div>
          <div className={`${colors.text.muted}`}>
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
