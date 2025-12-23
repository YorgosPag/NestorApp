'use client';

import React from 'react';
import { UnitBadge, CommonBadge } from '@/core/badges';
import { Star } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
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
  const iconSizes = useIconSizes();
  return (
    <div className="absolute bottom-3 left-3 right-3 z-10 flex justify-between items-end">
      <div className='flex items-center gap-2'>
        <UnitBadge
          status={unit.status as any}
          size="sm"
          className="text-xs text-white shadow-sm pointer-events-none"
        />
        <CommonBadge
          status="company"
          customLabel={getTypeLabel(unit.type)}
          variant="outline"
          size="sm"
          className="text-xs pointer-events-none"
        />
      </div>
      {isFavorite && (
        <Star className={`${iconSizes.md} text-yellow-400 fill-yellow-400 filter drop-shadow-sm`} />
      )}
    </div>
  );
}
