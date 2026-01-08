'use client';

import React from 'react';
// 🏢 ENTERPRISE: Using centralized entity config for Building icon
import { NAVIGATION_ENTITIES } from '@/components/navigation/config/navigation-entities';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

interface ProjectHeaderProps {
  name: string;
  buildingsCount: number;
  totalUnits: number;
}

export function ProjectHeader({ name, buildingsCount, totalUnits }: ProjectHeaderProps) {
  const colors = useSemanticColors();

  return (
    <div className={`flex items-center gap-3 p-4 ${colors.bg.infoSubtle} dark:bg-blue-900/30 rounded-lg border`}>
      <NAVIGATION_ENTITIES.building.icon className={cn(NAVIGATION_ENTITIES.building.color)} size={24} />
      <div>
        <div className="font-semibold text-foreground">{name}</div>
        <div className="text-sm text-muted-foreground">
          {buildingsCount} κτίρια • {totalUnits} μονάδες
        </div>
      </div>
    </div>
  );
}
