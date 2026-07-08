/**
 * ParkingFloorplanTab — Floorplan tab for the parking spot detail view.
 *
 * Thin binding over the shared {@link EntityMediaFilesTab} shell (ADR-588).
 * Bidirectional with the expandable inline floorplan in the building's
 * ParkingTabContent (same Firestore path). Company display name is resolved
 * inside the shell via `useCompanyDisplayName`.
 *
 * @module components/space-management/ParkingPage/ParkingDetails/tabs/ParkingFloorplanTab
 * @see ADR-588 — Space Media Tab Shell
 * @see ADR-031 — Canonical File Storage System
 * @see ADR-187 — Floor-level floorplans with expandable rows (extended to spaces)
 */

'use client';

import { EntityMediaFilesTab } from '@/components/space-management/shared/tabs/EntityMediaFilesTab';
import { parkingMediaBinding } from '@/components/space-management/shared/tabs/entity-media-binding';
import { FLOORPLAN_MEDIA_CONFIG } from '@/components/space-management/shared/tabs/media-tab-configs';
import type { ParkingSpot } from '@/hooks/useFirestoreParkingSpots';

interface ParkingFloorplanTabProps {
  /** Parking spot data (injected via globalProps as `parking`) */
  parking: ParkingSpot;
}

export function ParkingFloorplanTab({ parking }: ParkingFloorplanTabProps) {
  return (
    <EntityMediaFilesTab binding={parkingMediaBinding(parking)} media={FLOORPLAN_MEDIA_CONFIG} />
  );
}

export default ParkingFloorplanTab;
