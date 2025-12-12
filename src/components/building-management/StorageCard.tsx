'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import type { StorageUnit, StorageType, StorageStatus } from '@/types/storage';
import { cn } from '@/lib/utils';
import { StorageCardHeader } from './StorageCard/StorageCardHeader';
import { StorageCardContent } from './StorageCard/StorageCardContent';
import { StorageCardOverlay } from './StorageCard/StorageCardOverlay';
import { CORE_HOVER_TRANSFORMS, HOVER_SHADOWS, TRANSITION_PRESETS } from '@/components/ui/effects';

interface StorageCardProps {
  unit: StorageUnit;
  isSelected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  getStatusColor: (status: StorageStatus) => string;
  getStatusLabel: (status: StorageStatus) => string;
  getTypeIcon: (type: StorageType) => React.ElementType;
  getTypeLabel: (type: StorageType) => string;
}

export function StorageCard({ 
  unit, 
  isSelected,
  onSelect,
  onEdit, 
  onDelete,
  getStatusColor,
  getStatusLabel,
  getTypeIcon,
  getTypeLabel
}: StorageCardProps) {
  const [isFavorite, setIsFavorite] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  return (
    <Card 
      className={cn(
        `relative overflow-hidden cursor-pointer ${TRANSITION_PRESETS.SMOOTH_ALL} group border`,
        isSelected ? "ring-2 ring-primary shadow-lg border-primary" : "hover:border-primary/50",
        CORE_HOVER_TRANSFORMS.SCALE_UP_TINY,
        HOVER_SHADOWS.ENHANCED
      )}
      onClick={onSelect}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <StorageCardHeader 
        unit={unit}
        isSelected={isSelected}
        isFavorite={isFavorite}
        onSelect={onSelect}
        onEdit={onEdit}
        onDelete={onDelete}
        onToggleFavorite={() => setIsFavorite(!isFavorite)}
        getStatusColor={getStatusColor}
        getStatusLabel={getStatusLabel}
        getTypeLabel={getTypeLabel}
      />

      <StorageCardContent 
        unit={unit}
        getTypeIcon={getTypeIcon}
      />
      
      <StorageCardOverlay isHovered={isHovered} />
    </Card>
  );
}
