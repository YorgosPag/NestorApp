
'use client';

import React from 'react';
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from '@/lib/utils';
import type { Building } from '../BuildingsPageContent';

import { BuildingListItemHeader } from './ListItem/BuildingListItemHeader';
import { BuildingListItemStats } from './ListItem/BuildingListItemStats';
import { BuildingListItemProgress } from './ListItem/BuildingListItemProgress';
import { BuildingListItemFooter } from './ListItem/BuildingListItemFooter';
import { BuildingListItemActions } from './ListItem/BuildingListItemActions';

interface BuildingListItemProps {
  building: Building;
  isSelected: boolean;
  isFavorite: boolean;
  onSelect: () => void;
  onToggleFavorite: () => void;
}

export function BuildingListItem({
    building,
    isSelected,
    isFavorite,
    onSelect,
    onToggleFavorite
}: BuildingListItemProps) {

    return (
        <TooltipProvider>
            <div
                className={cn(
                    "relative p-3 rounded-lg border cursor-pointer transition-all duration-200 hover:shadow-md group",
                    isSelected
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20 shadow-sm"
                    : "border-border hover:border-blue-300 bg-card hover:bg-accent/50"
                )}
                onClick={onSelect}
            >
                <BuildingListItemActions
                    isFavorite={isFavorite}
                    onToggleFavorite={onToggleFavorite}
                    onEdit={() => console.log('Edit clicked')}
                />
                
                <BuildingListItemHeader building={building} />

                <BuildingListItemProgress progress={building.progress} />
                
                <BuildingListItemStats building={building} />

                <BuildingListItemFooter completionDate={building.completionDate} />

                {isSelected && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 rounded-r-full" />
                )}
            </div>
        </TooltipProvider>
    );
}
