/**
 * StorageDocumentsTab — Documents tab for the storage unit detail view.
 *
 * Thin binding over the shared {@link EntityMediaFilesTab} shell (ADR-588).
 * Shows all file categories EXCEPT photos, videos and floorplans (dedicated tabs).
 *
 * @module components/space-management/StoragesPage/StorageDetails/tabs/StorageDocumentsTab
 * @see ADR-588 — Space Media Tab Shell
 * @see ADR-031 — Canonical File Storage System
 */

'use client';

import { EntityMediaFilesTab } from '@/components/space-management/shared/tabs/EntityMediaFilesTab';
import { storageMediaBinding } from '@/components/space-management/shared/tabs/entity-media-binding';
import { DOCUMENTS_MEDIA_CONFIG } from '@/components/space-management/shared/tabs/media-tab-configs';
import type { Storage } from '@/types/storage/contracts';

interface StorageDocumentsTabProps {
  /** Storage data (injected via globalProps as `storage`) */
  storage: Storage;
}

export function StorageDocumentsTab({ storage }: StorageDocumentsTabProps) {
  return (
    <EntityMediaFilesTab binding={storageMediaBinding(storage)} media={DOCUMENTS_MEDIA_CONFIG} />
  );
}

export default StorageDocumentsTab;
