'use client';

import React from 'react';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { cn } from '@/lib/utils';
import type { Property } from '@/types/property-viewer';
import { brandClasses } from '@/styles/design-tokens';
import { useBorderTokens } from '@/hooks/useBorderTokens';

import { UnitListItemHeader } from './ListItem/UnitListItemHeader';
import { UnitListItemStats } from './ListItem/UnitListItemStats';
// 🏢 ENTERPRISE CARD SPEC (local_4.log): Removed Progress and Footer from cards
// These belong ONLY in the detail panel (right side)
import { getPropertyTypeIcon, getPropertyTypeLabel } from './ListItem/UnitListItemUtils';

interface UnitListItemProps {
  unit: Property;
  isSelected: boolean;
  isFavorite: boolean;
  onSelect: (isShift: boolean) => void;
  onToggleFavorite: () => void;
}

/**
 * 🏢 ENTERPRISE CARD SPEC - Unit List Item
 *
 * Per local_4.log final spec:
 * - Cards are for recognition, not comprehension
 * - Max 2 badges (type + status)
 * - Only: Name, Type, Status, Building, Floor, Area, Price
 * - NO: Progress, Customer info, Dates, Actions, Descriptions
 */
export function UnitListItem({
    unit,
    isSelected,
    isFavorite,
    onSelect,
    onToggleFavorite
}: UnitListItemProps) {
    const { quick } = useBorderTokens();

    return (
        <div
            className={cn(
                `relative p-3 ${quick.card} cursor-pointer group`,
                INTERACTIVE_PATTERNS.CARD_STANDARD,
                isSelected
                ? `${brandClasses.primary.border} ${brandClasses.primary.bg} dark:bg-blue-950/20 shadow-sm`
                : "border-border bg-card"
            )}
            onClick={() => onSelect(false)}
        >
            {/* 🏢 ENTERPRISE: Minimal card structure per spec */}
            <UnitListItemHeader
                unit={unit}
                getCategoryIcon={getPropertyTypeIcon}
                getCategoryLabel={getPropertyTypeLabel}
            />

            <UnitListItemStats unit={unit} />

            {/* Selection indicator */}
            {isSelected && (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r-full" />
            )}
        </div>
    );
}
