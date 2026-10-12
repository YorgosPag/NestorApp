'use client';

/**
 * 🅿️ Κεφαλίδα λεπτομερειών θέσης στάθμευσης — τίτλος και κείμενα της θέσης πάνω στην κοινή κεφαλίδα χώρου.
 */

import { Car } from 'lucide-react';
import { SpaceDetailsHeader } from '@/components/shared/space-info/SpaceDetailsHeader';
import type { ParkingSpot } from '@/hooks/useFirestoreParkingSpots';
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface ParkingDetailsHeaderProps {
  parking: ParkingSpot;
  /** Whether inline editing is active */
  isEditing: boolean;
  /** Whether a save operation is in progress */
  isSaving: boolean;
  /** Start inline editing on the General tab */
  onStartEdit: () => void;
  /** Trigger save (delegates to ParkingGeneralTab) */
  onSave: () => void;
  /** Cancel editing and revert changes */
  onCancel: () => void;
  /** Open the Add Parking dialog */
  onNewParking?: () => void;
  /** Delete the current parking spot */
  onDelete?: () => void;
  /** Open the Parking Showcase share dialog */
  onShowcaseParking?: () => void;
}

export function ParkingDetailsHeader({ parking, onNewParking, onShowcaseParking, ...session }: ParkingDetailsHeaderProps) {
  const { t } = useTranslation(['parking', 'trash', 'showcase']);

  return (
    <SpaceDetailsHeader
      {...session}
      icon={Car}
      title={parking.number || t('header.viewParking')}
      onNew={onNewParking}
      onShowcase={onShowcaseParking}
      labels={{
        save: t('header.save'),
        saving: t('header.saving'),
        cancel: t('header.cancel'),
        showcase: t('parkingShowcase.actions.showcase', { ns: 'showcase' }),
        create: t('header.newParking'),
        edit: t('header.edit'),
        moveToTrash: t('moveToTrash', { ns: 'trash' }),
      }}
    />
  );
}
