'use client';

import React from 'react';
import { PropertyBadge } from '@/core/badges';
import { MapPin } from "lucide-react";
import { EntityDetailsHeader } from '@/core/entity-headers';
import type { Property } from '@/types/property-viewer';
import { useIconSizes } from '@/hooks/useIconSizes';
import type { LucideIcon } from 'lucide-react';

interface UnitListItemHeaderProps {
  unit: Property;
  getCategoryIcon: (category: string) => LucideIcon;
  getCategoryLabel: (category: string) => string;
}

/**
 * 🏢 ENTERPRISE CARD SPEC - Header Component
 *
 * Per local_4.log final spec:
 * - Max 2 badges total (1 status + 1 type)
 * - NO customer indicators in cards (only in detail panel)
 * - Building + Floor info for context
 */
export function UnitListItemHeader({
  unit,
  getCategoryIcon,
  getCategoryLabel
}: UnitListItemHeaderProps) {
  const iconSizes = useIconSizes();
  const CategoryIcon = getCategoryIcon(unit.type);

  return (
    <EntityDetailsHeader
      icon={CategoryIcon}
      title={unit.name}
      variant="compact"
      className="mb-3 rounded-lg"
    >
      {/* 🏢 ENTERPRISE: Max 2 badges (status + type) */}
      <div className="flex items-center gap-2 mt-2 mb-2">
        <PropertyBadge status={unit.status} size="sm" />
        <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-muted text-muted-foreground rounded-full">
          {getCategoryLabel(unit.type)}
        </span>
      </div>

      {/* 🏢 ENTERPRISE: Building + Floor context */}
      {unit.building && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className={`${iconSizes.xs} flex-shrink-0`} />
          <span className="truncate">{unit.building} - Όροφος {unit.floor}</span>
        </div>
      )}
    </EntityDetailsHeader>
  );
}
