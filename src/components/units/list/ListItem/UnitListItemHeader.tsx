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
  getCategoryLabel: (category: string) => string;
}

export function UnitListItemHeader({
  unit,
  getCategoryIcon,
  getCategoryLabel
}: UnitListItemHeaderProps) {
  const CategoryIcon = getCategoryIcon(unit.type);

  return (
    <EntityDetailsHeader
      icon={CategoryIcon}
      title={unit.name}
      variant="compact"
      className="mb-3 rounded-lg"
    >
      {/* Centralized UnitBadge */}
      <div className="flex gap-2 mt-2 mb-2">
        <UnitBadge status={unit.status as any} size="sm" />
        <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-muted text-muted-foreground rounded-full">
          {getCategoryLabel(unit.type)}
        </span>
      </div>

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