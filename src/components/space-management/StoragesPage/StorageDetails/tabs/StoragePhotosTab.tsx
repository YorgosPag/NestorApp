/**
 * StoragePhotosTab — Photos tab for the storage unit detail view.
 *
 * Thin binding over the shared {@link EntityMediaFilesTab} shell (ADR-588).
 *
 * @module components/space-management/StoragesPage/StorageDetails/tabs/StoragePhotosTab
 * @see ADR-588 — Space Media Tab Shell
 * @see ADR-031 — Canonical File Storage System
 */

'use client';

import { EntityMediaFilesTab } from '@/components/space-management/shared/tabs/EntityMediaFilesTab';
import { storageMediaBinding } from '@/components/space-management/shared/tabs/entity-media-binding';
import { PHOTOS_MEDIA_CONFIG } from '@/components/space-management/shared/tabs/media-tab-configs';
import type { Storage } from '@/types/storage/contracts';

interface StoragePhotosTabProps {
  /** Storage data (injected via globalProps as `storage`) */
  storage: Storage;
}

export function StoragePhotosTab({ storage }: StoragePhotosTabProps) {
  return (
    <EntityMediaFilesTab binding={storageMediaBinding(storage)} media={PHOTOS_MEDIA_CONFIG} />
  );
}

export default StoragePhotosTab;
