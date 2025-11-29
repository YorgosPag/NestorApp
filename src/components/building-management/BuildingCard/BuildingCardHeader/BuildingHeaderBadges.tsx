'use client';

import React from 'react';
import { BuildingBadge, CommonBadge } from '@/core/badges';
import { cn } from '@/lib/utils';

interface BuildingHeaderBadgesProps {
  status: string;
  category: string;
  getStatusColor: (status: string) => string;
  getStatusLabel: (status: string) => string;
  getCategoryLabel: (category: string) => string;
}

export function BuildingHeaderBadges({
  status,
  category,
  getStatusColor,
  getStatusLabel,
  getCategoryLabel
}: BuildingHeaderBadgesProps) {
  return (
    <div className="flex items-center gap-2">
      <BuildingBadge
        status={status as any}
        size="sm"
        className="text-xs shadow-sm"
      />
      <CommonBadge
        status="company"
        customLabel={getCategoryLabel(category)}
        variant="secondary"
        size="sm"
        className="text-xs bg-white/90 text-gray-700 shadow-sm"
      />
    </div>
  );
}
