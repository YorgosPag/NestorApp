/**
 * StorageFloorplanTab — Floorplan tab for the storage unit detail view.
 *
 * Thin binding over the shared {@link EntityMediaFilesTab} shell (ADR-588).
 * Bidirectional with the expandable inline floorplan in the building's
 * StorageTabContent (same Firestore path). Company display name is resolved
 * inside the shell via `useCompanyDisplayName`.
 *
 * @module components/space-management/StoragesPage/StorageDetails/tabs/StorageFloorplanTab
 * @see ADR-588 — Space Media Tab Shell
 * @see ADR-031 — Canonical File Storage System
 * @see ADR-187 — Floor-level floorplans with expandable rows (extended to spaces)
 */

'use client';

import { EntityMediaFilesTab } from '@/components/space-management/shared/tabs/EntityMediaFilesTab';
import { storageMediaBinding } from '@/components/space-management/shared/tabs/entity-media-binding';
import { FLOORPLAN_MEDIA_CONFIG } from '@/components/space-management/shared/tabs/media-tab-configs';
import type { Storage } from '@/types/storage/contracts';

interface StorageFloorplanTabProps {
  /** Storage data (injected via globalProps as `storage`) */
  storage: Storage;
}

export function StorageFloorplanTab({ storage }: StorageFloorplanTabProps) {
  return (
    <EntityMediaFilesTab binding={storageMediaBinding(storage)} media={FLOORPLAN_MEDIA_CONFIG} />
  );
}

export default StorageFloorplanTab;
