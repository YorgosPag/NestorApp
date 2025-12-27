'use client';

import React from 'react';
import { useTypography } from '@/hooks/useTypography';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Building } from '../../BuildingsPageContent';
import { formatCurrency } from '@/lib/intl-utils';

interface BuildingCardMetricsProps {
  building: Building;
}

export function BuildingCardMetrics({ building }: BuildingCardMetricsProps) {
  // 🏢 ENTERPRISE: Centralized systems
  const typography = useTypography();
  const colors = useSemanticColors();

  return (
    <div className="grid grid-cols-2 gap-4 pt-2">
      <div className="space-y-1">
        <p className={typography.special.tertiary}>Επιφάνεια</p>
        <p className={typography.heading.sm}>{building.totalArea.toLocaleString('el-GR')} m²</p>
      </div>
      <div className="space-y-1">
        <p className={typography.special.tertiary}>Όροφοι</p>
        <p className={typography.heading.sm}>{building.floors}</p>
      </div>
      <div className="space-y-1">
        <p className={typography.special.tertiary}>Μονάδες</p>
        <p className={typography.heading.sm}>{building.units}</p>
      </div>
      <div className="space-y-1">
        <p className={typography.special.tertiary}>Αξία</p>
        <Tooltip>
          <TooltipTrigger>
            <p className={`${typography.heading.sm} ${colors.text.price}`}>
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
