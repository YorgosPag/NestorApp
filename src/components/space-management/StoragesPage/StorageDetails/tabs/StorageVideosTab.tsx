/**
 * StorageVideosTab — Videos tab for the storage unit detail view.
 *
 * Thin binding over the shared {@link EntityMediaFilesTab} shell (ADR-588).
 *
 * @module components/space-management/StoragesPage/StorageDetails/tabs/StorageVideosTab
 * @see ADR-588 — Space Media Tab Shell
 * @see ADR-031 — Canonical File Storage System
 */

'use client';

import { EntityMediaFilesTab } from '@/components/space-management/shared/tabs/EntityMediaFilesTab';
import { storageMediaBinding } from '@/components/space-management/shared/tabs/entity-media-binding';
import { VIDEOS_MEDIA_CONFIG } from '@/components/space-management/shared/tabs/media-tab-configs';
import type { Storage } from '@/types/storage/contracts';

interface StorageVideosTabProps {
  /** Storage data (injected via globalProps as `storage`) */
  storage: Storage;
}

export function StorageVideosTab({ storage }: StorageVideosTabProps) {
  return (
    <EntityMediaFilesTab binding={storageMediaBinding(storage)} media={VIDEOS_MEDIA_CONFIG} />
  );
}

export default StorageVideosTab;
