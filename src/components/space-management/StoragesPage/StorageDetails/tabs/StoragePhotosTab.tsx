/**
 * StoragePhotosTab — Photos tab for individual storage room detail view
 *
 * Uses centralized EntityFilesManager with media-gallery display style
 * for photo upload, viewing, and management (SSoT with apartment + parking).
 *
 * Storage path (ADR-031 canonical):
 * companies/{companyId}/entities/storage/{id}/domains/construction/categories/photos/
 *
 * Migration note (ADR-018 follow-up):
 * Previously used PhotosTabBase (in-memory category filter post-upload).
 * Now aligned with apartment/parking flow: UploadEntryPointSelector shows
 * category cards BEFORE upload (Εσωτερικό / Εξωτερικό / Πρόοδος Κατασκευής).
 *
 * @module components/space-management/StoragesPage/StorageDetails/tabs/StoragePhotosTab
 * @see ADR-031 — Canonical File Storage System
 */

'use client';

import React from 'react';
import { EntityFilesManager } from '@/components/shared/files/EntityFilesManager';
import { useAuth } from '@/auth/contexts/AuthContext';
import { useCompanyId } from '@/hooks/useCompanyId';
import { ENTITY_TYPES } from '@/config/domain-constants';
import { DEFAULT_PHOTO_ACCEPT } from '@/config/file-upload-config';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import type { Storage } from '@/types/storage/contracts';
import '@/lib/design-system';

// ============================================================================
// PROPS
// ============================================================================

interface StoragePhotosTabProps {
  storage: Storage;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function StoragePhotosTab({ storage }: StoragePhotosTabProps) {
  const { user } = useAuth();
  const { t } = useTranslation('storage');
  const colors = useSemanticColors();

  const companyId = useCompanyId()?.companyId;
  const currentUserId = user?.uid;

  if (!companyId || !currentUserId) {
    return (
      <p className={cn('p-4 text-center', colors.text.muted)}>
        {t('auth.signInToViewPhotos')}
      </p>
    );
  }

  return (
    <section className="p-2">
      <EntityFilesManager
        companyId={companyId}
        currentUserId={currentUserId}
        entityType={ENTITY_TYPES.STORAGE}
        entityId={storage.id}
        entityLabel={storage.name}
        projectId={storage.projectId}
        domain="construction"
        category="photos"
        purpose="storage-photo"
        entryPointCategoryFilter="photos"
        displayStyle="media-gallery"
        acceptedTypes={DEFAULT_PHOTO_ACCEPT}
      />
    </section>
  );
}

export default StoragePhotosTab;
