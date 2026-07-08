/**
 * ParkingVideosTab — Videos tab for the parking spot detail view.
 *
 * Thin binding over the shared {@link EntityMediaFilesTab} shell (ADR-588).
 *
 * @module components/space-management/ParkingPage/ParkingDetails/tabs/ParkingVideosTab
 * @see ADR-588 — Space Media Tab Shell
 * @see ADR-031 — Canonical File Storage System
 */

'use client';

import { EntityMediaFilesTab } from '@/components/space-management/shared/tabs/EntityMediaFilesTab';
import { parkingMediaBinding } from '@/components/space-management/shared/tabs/entity-media-binding';
import { VIDEOS_MEDIA_CONFIG } from '@/components/space-management/shared/tabs/media-tab-configs';
import type { ParkingSpot } from '@/hooks/useFirestoreParkingSpots';

interface ParkingVideosTabProps {
  /** Parking spot data (injected via globalProps as `parking`) */
  parking: ParkingSpot;
}

export function ParkingVideosTab({ parking }: ParkingVideosTabProps) {
  return (
    <EntityMediaFilesTab binding={parkingMediaBinding(parking)} media={VIDEOS_MEDIA_CONFIG} />
  );
}

export default ParkingVideosTab;
