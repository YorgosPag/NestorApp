'use client';

import React from 'react';
import { UnitBadge, CommonBadge } from '@/core/badges';
import { MapPin } from "lucide-react";
import { EntityDetailsHeader } from '@/core/entity-headers';
import { cn } from '@/lib/utils';
import type { Property } from '@/types/property-viewer';

interface UnitListItemHeaderProps {
  unit: Property;
  getCategoryIcon: (category: string) => React.ElementType;
  getStatusColor: (status: string) => string;
  getStatusLabel: (status: string) => string;
  getCategoryLabel: (category: string) => string;
}

export function UnitListItemHeader({
  unit,
  getCategoryIcon,
  getStatusColor,
  getStatusLabel,
  getCategoryLabel
}: UnitListItemHeaderProps) {
  const CategoryIcon = getCategoryIcon(unit.type);

  return (
    <EntityDetailsHeader
      icon={CategoryIcon}
      title={unit.name}
      badges={[
        {
          type: 'status',
          value: getStatusLabel(unit.status),
          size: 'sm'
        },
        {
          type: 'category',
          value: getCategoryLabel(unit.type),
          variant: 'outline',
          size: 'sm'
        }
      ]}
      variant="compact"
      className="mb-3 rounded-lg"
    >
      {/* Building Location Info */}
      {unit.building && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">{unit.building} - Όροφος {unit.floor}</span>
        </div>
      )}
    </EntityDetailsHeader>
  );
}