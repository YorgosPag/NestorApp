
'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { Building } from './BuildingsPageContent';

import { BuildingCardHeader } from './BuildingCard/BuildingCardHeader';
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
  const [isFavorite, setIsFavorite] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  return (
    <Card 
      className={cn(
        "relative overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-xl group border-2",
        isSelected 
          ? "border-blue-500 shadow-lg ring-2 ring-blue-200 dark:ring-blue-800" 
          : "border-border hover:border-blue-300 hover:shadow-lg",
        "transform hover:scale-[1.02]"
      )}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <BuildingCardHeader
        building={building}
        isFavorite={isFavorite}
        setIsFavorite={setIsFavorite}
        isHovered={isHovered}
        getStatusColor={getStatusColor}
        getStatusLabel={getStatusLabel}
        getCategoryLabel={getCategoryLabel}
        getCategoryIcon={getCategoryIcon}
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
