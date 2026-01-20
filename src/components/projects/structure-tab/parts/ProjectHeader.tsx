'use client';

import React from 'react';
// 🏢 ENTERPRISE: Using centralized entity config for Building icon
import { NAVIGATION_ENTITIES } from '@/components/navigation/config/navigation-entities';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface ProjectHeaderProps {
  name: string;
  buildingsCount: number;
  totalUnits: number;
}

export function ProjectHeader({ name, buildingsCount, totalUnits }: ProjectHeaderProps) {
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('projects');
  const colors = useSemanticColors();

  return (
    <div className={`flex items-center gap-3 p-4 ${colors.bg.infoSubtle} dark:bg-blue-900/30 rounded-lg border`}>
      <NAVIGATION_ENTITIES.building.icon className={cn(NAVIGATION_ENTITIES.building.color)} size={24} />
      <div>
        <div className="font-semibold text-foreground">{name}</div>
        <div className="text-sm text-muted-foreground">
          {t('structure.buildingsCount', { count: buildingsCount })} • {t('structure.unitsCount', { count: totalUnits })}
        </div>
      </div>
    </div>
  );
}
