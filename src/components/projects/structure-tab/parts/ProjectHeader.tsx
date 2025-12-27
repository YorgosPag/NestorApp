'use client';

import React from 'react';
import { Building2 } from 'lucide-react';
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
      <Building2 className="text-primary" size={24} />
      <div>
        <div className="font-semibold text-foreground">{name}</div>
        <div className="text-sm text-muted-foreground">
          {buildingsCount} κτίρια • {totalUnits} μονάδες
        </div>
      </div>
    </div>
  );
}
