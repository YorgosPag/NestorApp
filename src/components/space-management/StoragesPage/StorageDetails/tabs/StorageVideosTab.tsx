/* eslint-disable design-system/prefer-design-system-imports, custom/no-hardcoded-strings */
/**
 * StorageVideosTab — Videos tab for individual storage detail view
 *
 * Uses centralized EntityFilesManager with media-gallery display style
 * for video upload, viewing, and management.
 *
 * Storage path (ADR-031 canonical):
 * companies/{companyId}/entities/storage/{id}/domains/construction/categories/videos/
 *
 * @module components/space-management/StoragesPage/StorageDetails/tabs/StorageVideosTab
 * @see ADR-031 — Canonical File Storage System
 * @see ADR-193 — Storage/Parking Tabs Alignment with Units
 */

'use client';

import { EntityFilesManager } from '@/components/shared/files/EntityFilesManager';
import { useAuth } from '@/auth/contexts/AuthContext';
import { useCompanyId } from '@/hooks/useCompanyId';
import { DEFAULT_VIDEO_ACCEPT } from '@/config/file-upload-config';
import type { Storage } from '@/types/storage/contracts';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';

// ============================================================================
// TYPES
// ============================================================================

interface StorageVideosTabProps {
  /** Storage data (injected via globalProps as `storage`) */
  storage: Storage;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function StorageVideosTab({ storage }: StorageVideosTabProps) {
  const { user } = useAuth();
  const colors = useSemanticColors();

  const companyId = useCompanyId()?.companyId;
  const currentUserId = user?.uid;

  if (!companyId || !currentUserId) {
    return (
      <p className={cn("p-2 text-center", colors.text.muted)}>
        Συνδεθείτε για να δείτε τα βίντεο.
      </p>
    );
  }

  return (
    <section className="p-2">
      <EntityFilesManager
        companyId={companyId}
        currentUserId={currentUserId}
        entityType="storage"
        entityId={storage.id}
        entityLabel={storage.name}
        projectId={storage.projectId}
        domain="construction"
        category="videos"
        purpose="storage-video"
        entryPointCategoryFilter="videos"
        displayStyle="media-gallery"
        acceptedTypes={DEFAULT_VIDEO_ACCEPT}
      />
    </section>
  );
}

export default StorageVideosTab;
