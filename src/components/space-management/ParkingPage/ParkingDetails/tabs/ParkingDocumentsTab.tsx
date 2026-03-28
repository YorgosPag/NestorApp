/* eslint-disable custom/no-hardcoded-strings */
/**
 * ParkingDocumentsTab — Documents tab for individual parking spot detail view
 *
 * Uses centralized EntityFilesManager for document management.
 * Shows all file categories EXCEPT photos, videos, and floorplans
 * (those have dedicated tabs).
 *
 * Storage path (ADR-031 canonical):
 * companies/{companyId}/entities/parking_spot/{id}/domains/construction/categories/documents/
 *
 * @module components/space-management/ParkingPage/ParkingDetails/tabs/ParkingDocumentsTab
 * @see ADR-031 — Canonical File Storage System
 */

'use client';

import { EntityFilesManager } from '@/components/shared/files/EntityFilesManager';
import { useAuth } from '@/auth/contexts/AuthContext';
import { useCompanyId } from '@/hooks/useCompanyId';
import type { ParkingSpot } from '@/hooks/useFirestoreParkingSpots';
import '@/lib/design-system';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';

// ============================================================================
// TYPES
// ============================================================================

interface ParkingDocumentsTabProps {
  /** Parking spot data (injected via globalProps as `parking`) */
  parking: ParkingSpot;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ParkingDocumentsTab({ parking }: ParkingDocumentsTabProps) {
  const { user } = useAuth();
  const colors = useSemanticColors();

  const companyId = useCompanyId()?.companyId;
  const currentUserId = user?.uid;

  if (!companyId || !currentUserId) {
    return (
      <p className={cn("p-4 text-center", colors.text.muted)}>
        Συνδεθείτε για να δείτε τα έγγραφα.
      </p>
    );
  }

  return (
    <section className="p-2">
      <EntityFilesManager
        companyId={companyId}
        currentUserId={currentUserId}
        entityType="parking_spot"
        entityId={parking.id}
        entityLabel={parking.number}
        projectId={parking.projectId}
        domain="construction"
        category="documents"
        purpose="parking-document"
        entryPointExcludeCategories={['photos', 'videos', 'floorplans']}
      />
    </section>
  );
}

export default ParkingDocumentsTab;
