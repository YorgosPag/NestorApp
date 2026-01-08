'use client';

/**
 * 🅿️ ENTERPRISE PARKING DETAILS COMPONENT
 *
 * Λεπτομέρειες θέσης στάθμευσης
 * Ακολουθεί το exact pattern από StorageDetails.tsx
 */

import React from 'react';
import { Car } from 'lucide-react';
import { useEmptyStateMessages } from '@/hooks/useEnterpriseMessages';
import type { ParkingSpot } from '@/hooks/useFirestoreParkingSpots';
import { ParkingDetailsHeader } from './ParkingDetailsHeader';
import { ParkingTabs } from './ParkingTabs';
import { DetailsContainer } from '@/core/containers';

interface ParkingDetailsProps {
  parking: ParkingSpot | null;
}

export function ParkingDetails({ parking }: ParkingDetailsProps) {
  const emptyStateMessages = useEmptyStateMessages();

  // Custom empty state message for parking
  const parkingEmptyState = {
    title: 'Επιλέξτε θέση στάθμευσης',
    description: 'Επιλέξτε μια θέση από τη λίστα για να δείτε τις λεπτομέρειες'
  };

  return (
    <DetailsContainer
      selectedItem={parking}
      header={parking ? <ParkingDetailsHeader parking={parking} /> : null}
      tabsRenderer={parking ? <ParkingTabs parking={parking} /> : null}
      emptyStateProps={{
        icon: Car,
        ...parkingEmptyState
      }}
    />
  );
}
