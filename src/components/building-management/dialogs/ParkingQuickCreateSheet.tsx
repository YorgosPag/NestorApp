'use client';

/**
 * ParkingQuickCreateSheet — Sheet wrapping the canonical ParkingGeneralTab in
 * create mode, identical to the creation panel in /spaces/parking.
 *
 * Το κέλυφος (Sheet + κεφαλίδα + αποθήκευση/ακύρωση) είναι το κοινό `SpaceQuickCreateSheet`
 * (ADR-777 §8.60.20)· εδώ μένει μόνο ό,τι είναι της θέσης.
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Car } from 'lucide-react';
import { ParkingGeneralTab } from '@/components/space-management/ParkingPage/ParkingDetails/tabs/ParkingGeneralTab';
import type { ParkingSpot } from '@/types/parking';
import { NEW_SPACE_STATUSES } from '@/lib/spaces/space-status-split';
import { SpaceQuickCreateSheet } from './SpaceQuickCreateSheet';

export interface ParkingQuickCreateSheetProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly buildingId: string;
  readonly projectId: string;
  readonly onParkingCreated?: () => void;
}

export function ParkingQuickCreateSheet({
  open,
  onOpenChange,
  buildingId,
  projectId,
  onParkingCreated,
}: ParkingQuickCreateSheetProps) {
  const { t: tParking } = useTranslation('parking');

  const emptyParking: ParkingSpot = {
    id: '',
    number: '',
    type: 'standard',
    // ADR-777 §8.60.20 — νέα εγγραφή: ζωντανή, λειτουργικά «πρόχειρο» (ίδιος κανόνας με τα ακίνητα).
    ...NEW_SPACE_STATUSES,
    floor: '',
    buildingId,
    projectId: projectId || undefined,
  };

  return (
    <SpaceQuickCreateSheet
      open={open}
      onOpenChange={onOpenChange}
      icon={Car}
      labels={{
        title: tParking('header.newParking'),
        save: tParking('form.create'),
        cancel: tParking('form.cancel'),
      }}
      onCreated={onParkingCreated}
      renderForm={({ saveRef, onCreated }) => (
        <ParkingGeneralTab parking={emptyParking} isEditing createMode onSaveRef={saveRef} onCreated={onCreated} />
      )}
    />
  );
}
