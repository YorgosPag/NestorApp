'use client';

/**
 * 🅿️ ENTERPRISE PARKING LIST ITEM COMPONENT
 *
 * Εμφάνιση μιας θέσης στάθμευσης στη λίστα
 * Ακολουθεί το exact pattern από StorageListItem.tsx
 */

import React from 'react';
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/hooks/useSemanticColors';
import { useIconSizes } from '@/hooks/useIconSizes';
import { Star, Edit2, Car, MapPin, Ruler, Euro } from 'lucide-react';
import type { ParkingSpot } from '@/hooks/useFirestoreParkingSpots';
import { PARKING_TYPE_LABELS, PARKING_STATUS_LABELS } from '@/components/core/AdvancedFilters/configs/parkingFiltersConfig';

interface ParkingListItemProps {
  parking: ParkingSpot;
  isSelected: boolean;
  isFavorite: boolean;
  onSelect: () => void;
  onToggleFavorite: () => void;
}

export function ParkingListItem({
  parking,
  isSelected,
  isFavorite,
  onSelect,
  onToggleFavorite
}: ParkingListItemProps) {
  const { quick, getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();
  const iconSizes = useIconSizes();

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'text-green-600 bg-green-100 dark:bg-green-900/30';
      case 'occupied': return 'text-blue-600 bg-blue-100 dark:bg-blue-900/30';
      case 'reserved': return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30';
      case 'sold': return 'text-purple-600 bg-purple-100 dark:bg-purple-900/30';
      case 'maintenance': return 'text-red-600 bg-red-100 dark:bg-red-900/30';
      default: return 'text-gray-600 bg-gray-100 dark:bg-gray-900/30';
    }
  };

  // Get type icon
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'handicapped': return '♿';
      case 'motorcycle': return '🏍️';
      case 'electric': return '⚡';
      case 'visitor': return '👤';
      default: return '🚗';
    }
  };

  return (
    <TooltipProvider>
      <div
        className={cn(
          `relative p-3 ${quick.card} border cursor-pointer group`,
          INTERACTIVE_PATTERNS.CARD_STANDARD,
          isSelected
            ? `${getStatusBorder('info')} ${colors.bg.info} shadow-sm`
            : cn('border-border bg-card', INTERACTIVE_PATTERNS.BORDER_BLUE, INTERACTIVE_PATTERNS.ACCENT_HOVER_SUBTLE)
        )}
        onClick={onSelect}
      >
        {/* Actions */}
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
                className={cn(
                  'p-1 rounded-md transition-colors',
                  isFavorite ? 'text-yellow-500' : 'text-muted-foreground hover:text-yellow-500'
                )}
              >
                <Star className={cn(iconSizes.sm, isFavorite && 'fill-current')} />
              </button>
            </TooltipTrigger>
            <TooltipContent>{isFavorite ? 'Αφαίρεση από αγαπημένα' : 'Προσθήκη στα αγαπημένα'}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={(e) => { e.stopPropagation(); console.log('Edit parking'); }}
                className="p-1 rounded-md text-muted-foreground hover:text-primary transition-colors"
              >
                <Edit2 className={iconSizes.sm} />
              </button>
            </TooltipTrigger>
            <TooltipContent>Επεξεργασία</TooltipContent>
          </Tooltip>
        </div>

        {/* Header */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg">{getTypeIcon(parking.type || 'standard')}</span>
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-sm truncate">{parking.number}</h4>
            <p className="text-xs text-muted-foreground truncate">
              {PARKING_TYPE_LABELS[parking.type as keyof typeof PARKING_TYPE_LABELS] || parking.type}
            </p>
          </div>
          <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', getStatusColor(parking.status || 'available'))}>
            {PARKING_STATUS_LABELS[parking.status as keyof typeof PARKING_STATUS_LABELS] || parking.status}
          </span>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-1 text-muted-foreground">
            <MapPin className={iconSizes.xs} />
            <span className="truncate">{parking.floor || 'N/A'}</span>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <Ruler className={iconSizes.xs} />
            <span>{parking.area ? `${parking.area} m²` : 'N/A'}</span>
          </div>
          {parking.price !== undefined && parking.price > 0 && (
            <div className="flex items-center gap-1 text-muted-foreground col-span-2">
              <Euro className={iconSizes.xs} />
              <span className="font-medium">{parking.price.toLocaleString('el-GR')} €</span>
            </div>
          )}
        </div>

        {/* Location */}
        {parking.location && (
          <p className="mt-2 text-xs text-muted-foreground truncate">
            📍 {parking.location}
          </p>
        )}

        {/* Selection indicator */}
        {isSelected && (
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r-full" />
        )}
      </div>
    </TooltipProvider>
  );
}
