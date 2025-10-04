'use client';

import React from 'react';
import type { Building } from '../BuildingsPageContent';

import { BuildingHeaderBackground } from './BuildingCardHeader/BuildingHeaderBackground';
import { BuildingHeaderLogo } from './BuildingCardHeader/BuildingHeaderLogo';
import { BuildingHeaderActions } from './BuildingCardHeader/BuildingHeaderActions';
import { BuildingHeaderBadges } from './BuildingCardHeader/BuildingHeaderBadges';
import { BuildingHeaderProgress } from './BuildingCardHeader/BuildingHeaderProgress';

interface BuildingCardHeaderProps {
    building: Building;
    isFavorite: boolean;
    setIsFavorite: (isFavorite: boolean) => void;
    isHovered: boolean;
    getStatusColor: (status: string) => string;
    getStatusLabel: (status: string) => string;
    getCategoryLabel: (category: string) => string;
    getCategoryIcon: (category: string) => React.ElementType;
}

export function BuildingCardHeader({
    building,
    isFavorite,
    setIsFavorite,
    isHovered,
    getStatusColor,
    getStatusLabel,
    getCategoryLabel,
    getCategoryIcon
}: BuildingCardHeaderProps) {
  return (
    <div className="relative h-48 bg-gradient-to-br from-blue-100 via-purple-50 to-blue-50 dark:from-blue-950 dark:via-purple-950 dark:to-blue-900 overflow-hidden">
      <BuildingHeaderBackground />

      <BuildingHeaderLogo 
        category={building.category || 'mixed'}
        getCategoryIcon={getCategoryIcon}
      />
      
      <BuildingHeaderActions
        isHovered={isHovered}
        isFavorite={isFavorite}
        setIsFavorite={setIsFavorite}
      />

      <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between z-10">
        <BuildingHeaderBadges
          status={building.status}
          category={building.category || 'mixed'}
          getStatusColor={getStatusColor}
          getStatusLabel={getStatusLabel}
          getCategoryLabel={getCategoryLabel}
        />
        <BuildingHeaderProgress
          isFavorite={isFavorite}
          progress={building.progress}
          status={building.status}
          getStatusColor={getStatusColor}
        />
      </div>
    </div>
  );
}
