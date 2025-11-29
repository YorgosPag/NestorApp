'use client';

import React from 'react';
import { BuildingBadge } from "@/core/badges";
import { MapPin } from "lucide-react";
import { cn } from '@/lib/utils';
import type { Building } from '../../BuildingsPageContent';
import { getStatusColor, getStatusLabel, getCategoryIcon, getCategoryLabel } from '../../BuildingCard/BuildingCardUtils';
import { EntityDetailsHeader } from '@/core/entity-headers';

interface BuildingListItemHeaderProps {
  building: Building;
}

export function BuildingListItemHeader({ building }: BuildingListItemHeaderProps) {
  const CategoryIcon = getCategoryIcon(building.category || 'mixed');

  return (
    <EntityDetailsHeader
      icon={CategoryIcon}
      title={building.name}
      badges={[
        {
          type: 'status',
          value: getStatusLabel(building.status),
          size: 'sm'
        },
        {
          type: 'category',
          value: getCategoryLabel(building.category || 'mixed'),
          variant: 'outline',
          size: 'sm'
        },
        {
          type: 'progress',
          value: `${building.progress}% ολοκληρωμένο`,
          variant: 'secondary',
          size: 'sm'
        }
      ]}
      variant="compact"
      className="mb-3"
    >
      {/* Address inside EntityDetailsHeader */}
      {building.address && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
          <MapPin className="w-3 h-3" />
          <span className="truncate">{building.address}</span>
        </div>
      )}
    </EntityDetailsHeader>
  );
}
