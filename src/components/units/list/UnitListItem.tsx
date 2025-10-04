'use client';

import React from 'react';
import { TooltipProvider } from "@/components/ui/tooltip";
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import type { Property } from '@/types/property-viewer';

import { UnitListItemHeader } from './ListItem/UnitListItemHeader';
import { UnitListItemStats } from './ListItem/UnitListItemStats';
import { UnitListItemProgress } from './ListItem/UnitListItemProgress';
import { UnitListItemFooter } from './ListItem/UnitListItemFooter';
import { UnitListItemActions } from './ListItem/UnitListItemActions';
import { getStatusColor, getStatusLabel, getPropertyTypeIcon, getPropertyTypeLabel } from './ListItem/UnitListItemUtils';

interface UnitListItemProps {
  unit: Property;
  isSelected: boolean;
  isFavorite: boolean;
  onSelect: (isShift: boolean) => void;
  onToggleFavorite: () => void;
}

export function UnitListItem({
    unit,
    isSelected,
    isFavorite,
    onSelect,
    onToggleFavorite
}: UnitListItemProps) {
    const fakeProgress = unit.status === 'sold' ? 100 : 
                        unit.status === 'reserved' ? 85 : 
                        unit.status === 'rented' ? 100 :
                        ((unit.area || 0) * 1.5) % 100;

    return (
        <TooltipProvider>
            <div
                className={cn(
                    "relative p-3 rounded-lg border cursor-pointer transition-all duration-200 hover:shadow-md group flex items-start gap-3",
                    isSelected
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20 shadow-sm"
                    : "border-border hover:border-blue-300 bg-card hover:bg-accent/50"
                )}
                onClick={() => onSelect(false)}
            >
                <div className="pt-1">
                    <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) => onSelect(true)}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Select unit ${unit.name}`}
                    />
                </div>

                <div className="flex-1">
                    <UnitListItemActions
                        isFavorite={isFavorite}
                        onToggleFavorite={onToggleFavorite}
                        onEdit={() => console.log('Edit unit:', unit.id)}
                    />
                    
                    <UnitListItemHeader 
                        unit={unit} 
                        getCategoryIcon={getPropertyTypeIcon}
                        getStatusColor={getStatusColor}
                        getStatusLabel={getStatusLabel}
                        getCategoryLabel={getPropertyTypeLabel}
                    />

                    <UnitListItemProgress progress={fakeProgress} />
                    
                    <UnitListItemStats unit={unit} />

                    <UnitListItemFooter unit={unit} />
                </div>

                {isSelected && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 rounded-r-full" />
                )}
            </div>
        </TooltipProvider>
    );
}
