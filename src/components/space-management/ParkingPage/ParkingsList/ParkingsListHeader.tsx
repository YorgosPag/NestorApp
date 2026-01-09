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
        hideSearch={true}  // 🏢 ENTERPRISE: Κρύβουμε το search - χρησιμοποιούμε το CompactToolbar search
      />
    </div>
  );
}
