'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getTypeColor } from './StorageCardUtils';
import type { StorageUnit, StorageType, StorageStatus } from '@/types/storage';

interface Props {
  unit: StorageUnit;
  isFavorite: boolean;
  getStatusColor: (status: StorageStatus) => string;
  getStatusLabel: (status: StorageStatus) => string;
  getTypeLabel: (type: StorageType) => string;
}

export function StorageCardStatus({ unit, isFavorite, getStatusColor, getStatusLabel, getTypeLabel }: Props) {
  return (
    <div className="absolute bottom-3 left-3 right-3 z-10 flex justify-between items-end">
      <div className='flex items-center gap-2'>
        <Badge
          className={cn(
            "text-xs text-white shadow-sm pointer-events-none",
            getStatusColor(unit.status)
          )}
        >
          {getStatusLabel(unit.status)}
        </Badge>
        <Badge variant="outline" className={cn("text-xs pointer-events-none", getTypeColor(unit.type))}>
          {getTypeLabel(unit.type)}
        </Badge>
      </div>
      {isFavorite && (
        <Star className="w-5 h-5 text-yellow-400 fill-yellow-400 filter drop-shadow-sm" />
      )}
    </div>
  );
}
