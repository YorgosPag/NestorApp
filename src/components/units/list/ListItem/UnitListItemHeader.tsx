'use client';

import React from 'react';
import { UnitBadge, CommonBadge } from '@/core/badges';
import { MapPin, User } from "lucide-react";
import { EntityDetailsHeader } from '@/core/entity-headers';
import { Badge } from '@/components/ui/badge';
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

  // ENTERPRISE: Customer ownership indicator
  const hasSoldStatus = unit.status === 'sold' || unit.status === 'rented' || unit.status === 'reserved';
  const hasCustomerLink = Boolean(unit.soldTo);
  const showCustomerIndicator = hasSoldStatus && hasCustomerLink;

  return (
    <EntityDetailsHeader
      icon={CategoryIcon}
      title={unit.name}
      variant="compact"
      className="mb-3 rounded-lg"
    >
      {/* ENTERPRISE: Badge Row with Customer Indicator */}
      <div className="flex items-center gap-2 mt-2 mb-2">
        <UnitBadge status={unit.status as any} size="sm" />
        <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-muted text-muted-foreground rounded-full">
          {getCategoryLabel(unit.type)}
        </span>

        {/* ENTERPRISE: Customer Ownership Badge (Professional Visual Indicator) */}
        {showCustomerIndicator && (
          <Badge
            variant="outline"
            className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-green-50 text-green-700 border-green-200 dark:bg-green-950/20 dark:text-green-400 dark:border-green-800"
          >
            <User className="w-3 h-3" />
            <span>Πελάτης</span>
          </Badge>
        )}
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