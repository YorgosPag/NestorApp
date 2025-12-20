'use client';

import React from 'react';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from '@/lib/utils';
import type { Property } from '@/types/property-viewer';
import { brandClasses } from '@/styles/design-tokens';

import { UnitListItemHeader } from './ListItem/UnitListItemHeader';
import { UnitListItemStats } from './ListItem/UnitListItemStats';
import { UnitListItemProgress } from './ListItem/UnitListItemProgress';
import { UnitListItemFooter } from './ListItem/UnitListItemFooter';
import { UnitListItemActions } from './ListItem/UnitListItemActions';
import { getPropertyTypeIcon, getPropertyTypeLabel } from './ListItem/UnitListItemUtils';
import { getStatusColor, getStatusLabel } from '@/constants/property-statuses-enterprise';

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
                    "relative p-3 rounded-lg border cursor-pointer group",
                    INTERACTIVE_PATTERNS.CARD_STANDARD,
                    isSelected
                    ? `${brandClasses.primary.border} ${brandClasses.primary.bg} dark:bg-blue-950/20 shadow-sm`
                    : "border-border bg-card"
                )}
                onClick={() => onSelect(false)}
            >
                <div className="w-full">
                    <UnitListItemActions
                        isFavorite={isFavorite}
                        onToggleFavorite={onToggleFavorite}
                        onEdit={() => console.log('Edit unit:', unit.id)}
                    />
                    
                    <UnitListItemHeader
                        unit={unit}
                        getCategoryIcon={getPropertyTypeIcon}
                        getCategoryLabel={getPropertyTypeLabel}
                    />

                    <UnitListItemProgress progress={fakeProgress} />
                    
                    <UnitListItemStats unit={unit} />

                    <UnitListItemFooter unit={unit} />
                </div>

                {isSelected && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r-full" />
                )}
            </div>
        </TooltipProvider>
    );
}
