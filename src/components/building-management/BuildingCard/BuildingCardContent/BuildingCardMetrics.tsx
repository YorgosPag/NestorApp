'use client';

import React from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Building } from '../../BuildingsPageContent';
import { formatCurrency } from '../BuildingCardUtils';

interface BuildingCardMetricsProps {
  building: Building;
}

export function BuildingCardMetrics({ building }: BuildingCardMetricsProps) {
  return (
    <div className="grid grid-cols-2 gap-4 pt-2">
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">Επιφάνεια</p>
        <p className="text-sm font-semibold">{building.totalArea.toLocaleString('el-GR')} m²</p>
      </div>
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">Όροφοι</p>
        <p className="text-sm font-semibold">{building.floors}</p>
      </div>
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">Μονάδες</p>
        <p className="text-sm font-semibold">{building.units}</p>
      </div>
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">Αξία</p>
        <Tooltip>
          <TooltipTrigger>
            <p className="text-sm font-semibold text-green-600">
              {formatCurrency(building.totalValue || 0)}
            </p>
          </TooltipTrigger>
          <TooltipContent>
            <p>Συνολική αξία έργου</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
