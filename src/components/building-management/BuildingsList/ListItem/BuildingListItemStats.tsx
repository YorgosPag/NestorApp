'use client';

import React from 'react';
import { formatCurrency } from '@/lib/intl-utils';
import type { Building } from '../../BuildingsPageContent';

interface BuildingListItemStatsProps {
  building: Building;
}

export function BuildingListItemStats({ building }: BuildingListItemStatsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 text-xs">
      <div>
        <p className="text-muted-foreground">Επιφάνεια</p>
        <p className="font-medium">{building.totalArea.toLocaleString('el-GR')} m²</p>
      </div>
      <div>
        <p className="text-muted-foreground">Όροφοι</p>
        <p className="font-medium">{building.floors}</p>
      </div>
      <div>
        <p className="text-muted-foreground">Μονάδες</p>
        <p className="font-medium">{building.units}</p>
      </div>
      <div>
        <p className="text-muted-foreground">Αξία</p>
        <p className="font-medium">{formatCurrency(building.totalValue || 0)}</p>
      </div>
    </div>
  );
}
