/**
 * ParkingDocumentsTab — Documents tab for the parking spot detail view.
 *
 * Thin binding over the shared {@link EntityMediaFilesTab} shell (ADR-588).
 * Shows all file categories EXCEPT photos, videos and floorplans (dedicated tabs).
 *
 * @module components/space-management/ParkingPage/ParkingDetails/tabs/ParkingDocumentsTab
 * @see ADR-588 — Space Media Tab Shell
 * @see ADR-031 — Canonical File Storage System
 */

'use client';

import { EntityMediaFilesTab } from '@/components/space-management/shared/tabs/EntityMediaFilesTab';
import { parkingMediaBinding } from '@/components/space-management/shared/tabs/entity-media-binding';
import { DOCUMENTS_MEDIA_CONFIG } from '@/components/space-management/shared/tabs/media-tab-configs';
import type { ParkingSpot } from '@/hooks/useFirestoreParkingSpots';

interface ParkingDocumentsTabProps {
  /** Parking spot data (injected via globalProps as `parking`) */
  parking: ParkingSpot;
}

export function ParkingDocumentsTab({ parking }: ParkingDocumentsTabProps) {
  return (
    <EntityMediaFilesTab binding={parkingMediaBinding(parking)} media={DOCUMENTS_MEDIA_CONFIG} />
  );
}

export default ParkingDocumentsTab;
