'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
// 🏢 ENTERPRISE: Using centralized entity config for Building icon
import { NAVIGATION_ENTITIES } from '@/components/navigation/config/navigation-entities';
import { cn } from '@/lib/utils';
import { UnitNode } from './UnitNode';
import { HOVER_BACKGROUND_EFFECTS, TRANSITION_PRESETS } from '@/components/ui/effects';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import type { BuildingModel } from '../types';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

/** Unit model for type safety */
interface UnitData {
  id: string;
  status?: string;
  area?: number;
  [key: string]: unknown;
}

export const BuildingNode = ({ building }: { building: BuildingModel }) => {
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('projects');
  const [isExpanded, setIsExpanded] = useState(true);
  const { quick } = useBorderTokens();
  const colors = useSemanticColors();

  const units = building.units as UnitData[];
  const soldUnits = units.filter((u) => u.status === 'sold').length;
  const totalUnits = units.length;
  const totalArea = units.reduce((sum: number, u) => sum + (u.area || 0), 0);
  const soldArea = units.filter((u) => u.status === 'sold').reduce((sum: number, u) => sum + (u.area || 0), 0);

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
        <NAVIGATION_ENTITIES.building.icon className={cn(NAVIGATION_ENTITIES.building.color)} size={20} />
        <div className="flex-1">
          <div className={`font-semibold ${colors.text.foreground}`}>{building.name}</div>
          <div className={`text-sm ${colors.text.muted}`}>
            {totalUnits} {t('structure.units')} • {totalArea.toFixed(1)} m² • {soldUnits}/{totalUnits} {t('structure.soldUnits')}
          </div>
        </div>
        <div className="text-right text-sm">
          <div className={`font-semibold ${colors.text.success}`}>
            {totalUnits > 0 ? ((soldUnits / totalUnits) * 100).toFixed(1) : 0}% {t('structure.salesPercentage')}
          </div>
          <div className={`${colors.text.muted}`}>
            {soldArea.toFixed(1)} m² {t('structure.soldArea')}
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
