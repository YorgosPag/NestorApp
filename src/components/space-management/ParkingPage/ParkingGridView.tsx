'use client';

/**
 * 🅿️ ENTERPRISE PARKING GRID VIEW
 *
 * Full-width grid view for parking spots.
 * Replaces the list+details layout when grid mode is selected.
 *
 * @fileoverview Parking grid view component (mirrors PropertyGridView pattern)
 * @enterprise Fortune 500 compliant
 * @author Enterprise Architecture Team
 * @since 2026-01-24
 */

import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Car } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import type { ParkingSpot } from '@/hooks/useFirestoreParkingSpots';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

// 🏢 ENTERPRISE: Using centralized domain card
import { ParkingGridCard } from '@/domain';

// =============================================================================
// 🏢 TYPES
// =============================================================================

interface ParkingGridViewProps {
  /** Parking spots to display */
  parkingSpots: ParkingSpot[];
  /** Currently selected parking */
  selectedParking: ParkingSpot | null;
  /** Selection handler */
  onSelectParking?: (parking: ParkingSpot) => void;
}

// =============================================================================
// 🏢 COMPONENT
// =============================================================================

export function ParkingGridView({
  parkingSpots,
  selectedParking,
  onSelectParking,
}: ParkingGridViewProps) {
  const { t } = useTranslation('building');
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();

  // Favorites state (local for now)
  const [favorites, setFavorites] = React.useState<string[]>([]);

  const toggleFavorite = (parkingId: string) => {
    setFavorites(prev =>
      prev.includes(parkingId)
        ? prev.filter(id => id !== parkingId)
        : [...prev, parkingId]
    );
  };

  // Empty state
  if (parkingSpots.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center h-full ${colors.text.muted} p-8`}>
        <Car className={`${iconSizes.xl} mb-4 text-blue-500`} />
        <h2 className="text-xl font-semibold">{t('parkings.list.noResults')}</h2>
        <p className="text-sm">{t('parkings.list.noResultsHint')}</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full flex-1">
      {/* 🏢 ENTERPRISE: Full-width responsive grid */}
      <div className="w-full p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
          {parkingSpots.map((parking) => (
            <ParkingGridCard
              key={parking.id}
              parking={parking}
              isSelected={selectedParking?.id === parking.id}
              isFavorite={favorites.includes(parking.id)}
              onSelect={() => onSelectParking?.(parking)}
              onToggleFavorite={() => toggleFavorite(parking.id)}
            />
          ))}
        </div>
      </div>
    </ScrollArea>
  );
}

export default ParkingGridView;
