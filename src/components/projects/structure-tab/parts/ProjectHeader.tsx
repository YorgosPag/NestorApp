'use client';

import React from 'react';
import { Building2 } from 'lucide-react';

interface ProjectHeaderProps {
  name: string;
  buildingsCount: number;
  totalUnits: number;
}

export function ProjectHeader({ name, buildingsCount, totalUnits }: ProjectHeaderProps) {
  return (
    <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg border">
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
