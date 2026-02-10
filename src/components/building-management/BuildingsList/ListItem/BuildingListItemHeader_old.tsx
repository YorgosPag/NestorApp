'use client';

import React from 'react';
import { BuildingBadge } from "@/core/badges";
import { MapPin } from "lucide-react";
import { useIconSizes } from '@/hooks/useIconSizes';
import type { Building } from '../../BuildingsPageContent';
import { getCategoryIcon, getCategoryLabel } from '../../BuildingCard/BuildingCardUtils';
import { EntityDetailsHeader } from '@/core/entity-headers';

interface BuildingListItemHeaderProps {
  building: Building;
}

export function BuildingListItemHeader({ building }: BuildingListItemHeaderProps) {
  const iconSizes = useIconSizes();
  const CategoryIcon = getCategoryIcon(building.category || 'mixed');

  return (
    <EntityDetailsHeader
      icon={CategoryIcon}
      title={building.name}
      variant="compact"
      className="mb-3"
    >
      {/* Centralized BuildingBadge */}
      <div className="flex gap-2 mt-2 mb-2">
        <BuildingBadge status={building.status} size="sm" />
        <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-muted text-muted-foreground rounded-full">
          {getCategoryLabel(building.category || 'mixed')}
        </span>
        <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-secondary text-secondary-foreground rounded-full">
          {building.progress}% ολοκληρωμένο
        </span>
      </div>

      {/* Address inside EntityDetailsHeader */}
      {building.address && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className={iconSizes.xs} />
          <span className="truncate">{building.address}</span>
        </div>
      )}
    </EntityDetailsHeader>
  );
}
