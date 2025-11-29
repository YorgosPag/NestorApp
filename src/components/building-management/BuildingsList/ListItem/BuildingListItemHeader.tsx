'use client';

import React from 'react';
import { BuildingBadge } from "@/core/badges";
import { MapPin } from "lucide-react";
import { cn } from '@/lib/utils';
import type { Building } from '../../BuildingsPageContent';
import { getStatusColor, getStatusLabel, getCategoryIcon, getCategoryLabel } from '../../BuildingCard/BuildingCardUtils';

interface BuildingListItemHeaderProps {
  building: Building;
}

export function BuildingListItemHeader({ building }: BuildingListItemHeaderProps) {
  const CategoryIcon = getCategoryIcon(building.category || 'mixed');

  return (
    <div className="mb-3">
      <div className="flex items-start gap-2 mb-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <CategoryIcon className="w-4 h-4 text-muted-foreground" />
          <h4 className="font-medium text-sm text-foreground leading-tight line-clamp-2">
            {building.name}
          </h4>
        </div>
      </div>
      
      <div className="flex items-center gap-2 mb-2">
        <BuildingBadge
          status={building.status as any}
          variant="secondary"
          className={cn("text-xs text-white", getStatusColor(building.status))}
        />
        <BuildingBadge
          status="planning"
          customLabel={getCategoryLabel(building.category || 'mixed')}
          variant="outline"
          className="text-xs"
        />
      </div>

      {building.address && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
          <MapPin className="w-3 h-3" />
          <span className="truncate">{building.address}</span>
        </div>
      )}
    </div>
  );
}
