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
import { useAuth } from '@/auth/hooks/useAuth';
import { UnifiedShareDialog } from '@/components/sharing/UnifiedShareDialog';

interface ParkingDetailsProps {
  parking: ParkingSpot | null;
  /** Open the Add Parking dialog */
  onNewParking?: () => void;
  /** Delete the current parking spot */
  onDelete?: () => void;
}

export function ParkingDetails({ parking, onNewParking, onDelete }: ParkingDetailsProps) {
  const emptyStateMessages = useEmptyStateMessages();
  const { user } = useAuth();

  // Inline editing state (lifted for header ↔ tab coordination)
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showcaseDialogOpen, setShowcaseDialogOpen] = useState(false);

  // Save delegation ref — ParkingGeneralTab registers its handleSave here
  const saveRef = useRef<(() => Promise<boolean>) | null>(null);

  const handleStartEdit = useCallback(() => {
    setIsEditing(true);
  }, []);

  const handleShowcaseParking = useCallback(() => {
    setShowcaseDialogOpen(true);
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
    <>
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
              onNewParking={onNewParking}
              onDelete={onDelete}
              onShowcaseParking={!parking?.id ? undefined : handleShowcaseParking}
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
        onCreateAction={onNewParking}
        emptyStateProps={{
          icon: Car,
          ...emptyStateMessages.parking
        }}
      />
      {parking?.id && user?.companyId && user?.uid && (
        <UnifiedShareDialog
          open={showcaseDialogOpen}
          onOpenChange={setShowcaseDialogOpen}
          entityType="parking_showcase"
          entityId={parking.id}
          entityTitle={parking.number}
          companyId={user.companyId}
          userId={user.uid}
        />
      )}
    </>
  );
}
