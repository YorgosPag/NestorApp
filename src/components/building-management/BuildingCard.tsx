
'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Star } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import type { Building } from './BuildingsPageContent';
import { COMPLEX_HOVER_EFFECTS } from '@/components/ui/effects';
import { useBorderTokens } from '@/hooks/useBorderTokens';

import { EntityDetailsHeader } from '@/core/entity-headers';
import { BuildingCardContent } from './BuildingCard/BuildingCardContent';
import { BuildingCardTimeline } from './BuildingCard/BuildingCardTimeline';
import { getStatusColor, getStatusLabel, getCategoryLabel, getCategoryIcon } from './BuildingCard/BuildingCardUtils';


interface BuildingCardProps {
  building: Building;
  isSelected: boolean;
  onClick: () => void;
}

export function BuildingCard({
  building,
  isSelected,
  onClick,
}: BuildingCardProps) {
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();
  const [isFavorite, setIsFavorite] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const CategoryIcon = getCategoryIcon(building.category || 'mixed');

  return (
    <Card
      className={cn(
        `relative overflow-hidden cursor-pointer group ${quick.card}`,
        // Override default border with thicker one
        "border-2",
        COMPLEX_HOVER_EFFECTS.FEATURE_CARD,
        isSelected
          ? "border-blue-500 shadow-lg ring-2 ring-blue-200 dark:ring-blue-800"
          : "border-border"
      )}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* EntityDetailsHeader instead of complex visual header */}
      <EntityDetailsHeader
        icon={CategoryIcon}
        title={building.name}
        badges={[
          {
            type: 'status',
            value: getStatusLabel(building.status),
            size: 'sm'
          },
          {
            type: 'progress',
            value: `${building.progress}% ολοκληρωμένο`,
            variant: 'secondary',
            size: 'sm'
          }
        ]}
        actions={[
          {
            icon: Star,
            onClick: () => {
              setIsFavorite(!isFavorite);
            },
            variant: 'ghost',
            className: cn(
              `${iconSizes.lg} p-0`,
              isFavorite ? 'text-yellow-500 fill-current' : 'text-gray-400'
            )
          }
        ]}
        variant="compact"
        className={quick.borderB}
      />
      
      <BuildingCardContent
        building={building}
      />

      <BuildingCardTimeline
        building={building}
      />

      {/* Hover overlay effect */}
      <div className={cn(
        "absolute inset-0 bg-gradient-to-t from-blue-500/5 to-transparent pointer-events-none transition-opacity duration-300",
        isHovered ? "opacity-100" : "opacity-0"
      )} />

      {/* Selected indicator */}
      {isSelected && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-purple-600" />
      )}
    </Card>
  );
}
