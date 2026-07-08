/**
 * ParkingPhotosTab — Photos tab for the parking spot detail view.
 *
 * Thin binding over the shared {@link EntityMediaFilesTab} shell (ADR-588).
 *
 * @module components/space-management/ParkingPage/ParkingDetails/tabs/ParkingPhotosTab
 * @see ADR-588 — Space Media Tab Shell
 * @see ADR-031 — Canonical File Storage System
 */

'use client';

import { EntityMediaFilesTab } from '@/components/space-management/shared/tabs/EntityMediaFilesTab';
import { parkingMediaBinding } from '@/components/space-management/shared/tabs/entity-media-binding';
import { PHOTOS_MEDIA_CONFIG } from '@/components/space-management/shared/tabs/media-tab-configs';
import type { ParkingSpot } from '@/hooks/useFirestoreParkingSpots';

interface ParkingPhotosTabProps {
  /** Parking spot data (injected via globalProps as `parking`) */
  parking: ParkingSpot;
}

export function ParkingPhotosTab({ parking }: ParkingPhotosTabProps) {
  return (
    <EntityMediaFilesTab binding={parkingMediaBinding(parking)} media={PHOTOS_MEDIA_CONFIG} />
  );
}

export default ParkingPhotosTab;
