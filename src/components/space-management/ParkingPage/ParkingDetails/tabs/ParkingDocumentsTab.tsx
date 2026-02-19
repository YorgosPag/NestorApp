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
import type { ParkingSpot } from '@/hooks/useFirestoreParkingSpots';

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

  const companyId = user?.companyId;
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
