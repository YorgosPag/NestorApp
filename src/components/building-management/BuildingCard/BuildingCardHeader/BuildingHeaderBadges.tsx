'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
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
      <Badge className={cn("text-xs shadow-sm", getStatusColor(status).replace('bg-', 'bg-') + ' text-white')}>
        {getStatusLabel(status)}
      </Badge>
      <Badge variant="secondary" className="text-xs bg-white/90 text-gray-700 shadow-sm">
        {getCategoryLabel(category)}
      </Badge>
    </div>
  );
}
