'use client';

/**
 * 🅿️ ENTERPRISE PARKING DETAILS COMPONENT
 *
 * Λεπτομέρειες θέσης στάθμευσης
 * Ακολουθεί το exact pattern από BuildingDetails.tsx
 * Supports inline editing via lifted state + saveRef delegation.
 */

import React, { useState, useCallback, useRef } from 'react';
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

  // Inline editing state (lifted for header ↔ tab coordination)
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Save delegation ref — ParkingGeneralTab registers its handleSave here
  const saveRef = useRef<(() => Promise<boolean>) | null>(null);

  const handleStartEdit = useCallback(() => {
    setIsEditing(true);
  }, []);

  const handleSave = useCallback(async () => {
    if (!saveRef.current) return;
    setIsSaving(true);
    try {
      await saveRef.current();
    } finally {
      setIsSaving(false);
    }
  }, []);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
  }, []);

  // Reset editing state when parking selection changes
  React.useEffect(() => {
    setIsEditing(false);
  }, [parking?.id]);

  return (
    <DetailsContainer
      selectedItem={parking}
      header={
        parking ? (
          <ParkingDetailsHeader
            parking={parking}
            isEditing={isEditing}
            isSaving={isSaving}
            onStartEdit={handleStartEdit}
            onSave={handleSave}
            onCancel={handleCancel}
          />
        ) : null
      }
      tabsRenderer={
        parking ? (
          <ParkingTabs
            parking={parking}
            isEditing={isEditing}
            onEditingChange={setIsEditing}
            saveRef={saveRef}
          />
        ) : null
      }
      emptyStateProps={{
        icon: Car,
        ...parkingEmptyState
      }}
    />
  );
}
