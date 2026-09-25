'use client';

/**
 * 🅿️ ENTERPRISE PARKING DETAILS COMPONENT
 *
 * Λεπτομέρειες θέσης στάθμευσης
 * Ακολουθεί το exact pattern από BuildingDetails.tsx
 * Supports inline editing via lifted state + saveRef delegation.
 */

import { Car } from 'lucide-react';
import { useEmptyStateMessages } from '@/hooks/useEnterpriseMessages';
import type { ParkingSpot } from '@/hooks/useFirestoreParkingSpots';
import { ParkingDetailsHeader } from './ParkingDetailsHeader';
import { ParkingTabs } from './ParkingTabs';
import { DetailsContainer } from '@/core/containers';
import { useAuth } from '@/auth/hooks/useAuth';
import { UnifiedShareDialog } from '@/components/sharing/UnifiedShareDialog';
import { useInlineEditSession } from '@/hooks/useInlineEditSession';
import { useShowcaseDialog } from '@/hooks/useShowcaseDialog';

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

  // Inline editing (header ↔ tab), reset when the selection changes — ParkingGeneralTab registers its save in saveRef
  const edit = useInlineEditSession(parking?.id);
  const showcase = useShowcaseDialog();

  return (
    <>
      <DetailsContainer
        selectedItem={parking}
        header={
          parking ? (
            <ParkingDetailsHeader
              parking={parking}
              isEditing={edit.isEditing}
              isSaving={edit.isSaving}
              onStartEdit={edit.startEdit}
              onSave={edit.handleSave}
              onCancel={edit.cancelEdit}
              onNewParking={onNewParking}
              onDelete={onDelete}
              onShowcaseParking={!parking?.id ? undefined : showcase.openDialog}
            />
          ) : null
        }
        tabsRenderer={
          parking ? (
            <ParkingTabs
              parking={parking}
              isEditing={edit.isEditing}
              onEditingChange={edit.setIsEditing}
              saveRef={edit.saveRef}
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
          open={showcase.open}
          onOpenChange={showcase.setOpen}
          entityType="parking_showcase"
          entityId={parking.id}
          entityTitle={parking.number}
          companyId={user.companyId}
        />
      )}
    </>
  );
}
