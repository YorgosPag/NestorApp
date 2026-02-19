'use client';

import React from 'react';
import { StorageCard } from '../StorageCard';
import type { StorageUnit, StorageType, StorageStatus } from '@/types/storage';

interface StorageCardsViewProps {
  units: StorageUnit[];
  selectedUnits: string[];
  onSelectUnit: (unitId: string) => void;
  onEdit: (unit: StorageUnit) => void;
  onDelete: (unitId: string) => void;
  getStatusColor: (status: StorageStatus) => string;
  getStatusLabel: (status: StorageStatus) => string;
  getTypeIcon: (type: StorageType) => React.ElementType;
  getTypeLabel: (type: StorageType) => string;
}

export function StorageCardsView({
  units,
  selectedUnits,
  onSelectUnit,
  onEdit,
  onDelete,
  getStatusColor,
  getStatusLabel,
  getTypeIcon,
  getTypeLabel
}: StorageCardsViewProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
      {units.map((unit) => (
        <StorageCard
          key={unit.id}
          unit={unit}
          isSelected={selectedUnits.includes(unit.id)}
          onSelect={() => onSelectUnit(unit.id)}
          onEdit={() => onEdit(unit)}
          onDelete={() => onDelete(unit.id)}
          getStatusColor={getStatusColor}
          getStatusLabel={getStatusLabel}
          getTypeIcon={getTypeIcon}
          getTypeLabel={getTypeLabel}
        />
      ))}
    </div>
  );
}
