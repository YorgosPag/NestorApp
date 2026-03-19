/**
 * StorageDocumentsTab — Documents tab for individual storage detail view
 *
 * Uses centralized EntityFilesManager for document management.
 * Shows all file categories EXCEPT photos, videos, and floorplans
 * (those have dedicated tabs).
 *
 * Storage path (ADR-031 canonical):
 * companies/{companyId}/entities/storage/{id}/domains/construction/categories/documents/
 *
 * @module components/space-management/StoragesPage/StorageDetails/tabs/StorageDocumentsTab
 * @see ADR-031 — Canonical File Storage System
 */

'use client';

import { EntityFilesManager } from '@/components/shared/files/EntityFilesManager';
import { useAuth } from '@/auth/contexts/AuthContext';
import { useCompanyId } from '@/hooks/useCompanyId';
import type { Storage } from '@/types/storage/contracts';

// ============================================================================
// TYPES
// ============================================================================

interface StorageDocumentsTabProps {
  /** Storage data (injected via globalProps as `storage`) */
  storage: Storage;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function StorageDocumentsTab({ storage }: StorageDocumentsTabProps) {
  const { user } = useAuth();

  const companyId = useCompanyId()?.companyId;
  const currentUserId = user?.uid;

  if (!companyId || !currentUserId) {
    return (
      <p className="p-4 text-center text-muted-foreground">
        Συνδεθείτε για να δείτε τα έγγραφα.
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
        category="documents"
        purpose="storage-document"
        entryPointExcludeCategories={['photos', 'videos', 'floorplans']}
      />
    </section>
  );
}

export default StorageDocumentsTab;
