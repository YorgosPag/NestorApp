'use client';

/**
 * 🅿️ ENTERPRISE PARKINGS LIST HEADER COMPONENT
 *
 * Header για τη λίστα θέσεων στάθμευσης
 * Ακολουθεί το exact pattern από StoragesListHeader.tsx
 */

import React from 'react';
import { Car, CheckCircle, DollarSign, TrendingUp } from 'lucide-react';
import { GenericListHeader } from '@/components/shared/GenericListHeader';
import type { ParkingSpot } from '@/hooks/useFirestoreParkingSpots';
import { useIconSizes } from '@/hooks/useIconSizes';

interface ParkingsListHeaderProps {
  parkingSpots: ParkingSpot[];
  searchTerm: string;
  onSearchChange: (term: string) => void;
  showToolbar?: boolean;
  onToolbarToggle?: (show: boolean) => void;
}

export function ParkingsListHeader({
  parkingSpots,
  searchTerm,
  onSearchChange,
  showToolbar = false,
  onToolbarToggle
}: ParkingsListHeaderProps) {
  const iconSizes = useIconSizes();

  // Calculate statistics
  const availableCount = parkingSpots.filter(p => p.status === 'available').length;
  const occupiedCount = parkingSpots.filter(p => p.status === 'occupied').length;
  const soldCount = parkingSpots.filter(p => p.status === 'sold').length;
  const totalArea = parkingSpots.reduce((sum, p) => sum + (p.area || 0), 0);
  const totalValue = parkingSpots.reduce((sum, p) => sum + (p.price || 0), 0);

  return (
    <div>
      <GenericListHeader
        icon={Car}
        entityName="Θέσεις Στάθμευσης"
        itemCount={parkingSpots.length}
        searchTerm={searchTerm}
        onSearchChange={onSearchChange}
        searchPlaceholder="Αναζήτηση θέσεων..."
        showToolbar={showToolbar}
        onToolbarToggle={onToolbarToggle}
      />

      <div className="px-4 pb-4 border-b bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20">
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="flex items-center gap-1">
            <CheckCircle className={`${iconSizes.xs} text-green-600`} />
            <span className="text-muted-foreground">Διαθέσιμες:</span>
            <span className="font-medium">{availableCount}</span>
          </div>
          <div className="flex items-center gap-1">
            <TrendingUp className={`${iconSizes.xs} text-blue-600`} />
            <span className="text-muted-foreground">Πωλημένες:</span>
            <span className="font-medium">{soldCount}</span>
          </div>
          <div className="flex items-center gap-1">
            <DollarSign className={`${iconSizes.xs} text-green-600`} />
            <span className="text-muted-foreground">Συν. Αξία:</span>
            <span className="font-medium">{(totalValue / 1000).toFixed(0)}K€</span>
          </div>
          <div className="flex items-center gap-1">
            <Car className={`${iconSizes.xs} text-orange-600`} />
            <span className="text-muted-foreground">Συν. Επιφάνεια:</span>
            <span className="font-medium">{totalArea.toFixed(0)} m²</span>
          </div>
        </div>
      </div>
    </div>
  );
}
