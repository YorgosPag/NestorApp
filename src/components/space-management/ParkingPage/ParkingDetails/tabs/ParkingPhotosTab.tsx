/**
 * ParkingPhotosTab — Photos tab for individual parking spot detail view
 *
 * Uses centralized EntityFilesManager with media-gallery display style
 * for photo upload, viewing, and management.
 *
 * Storage path (ADR-031 canonical):
 * companies/{companyId}/entities/parking_spot/{id}/domains/construction/categories/photos/
 *
 * @module components/space-management/ParkingPage/ParkingDetails/tabs/ParkingPhotosTab
 * @see ADR-031 — Canonical File Storage System
 */

'use client';

import { EntityFilesManager } from '@/components/shared/files/EntityFilesManager';
import { useAuth } from '@/auth/contexts/AuthContext';
import { DEFAULT_PHOTO_ACCEPT } from '@/config/file-upload-config';
import type { ParkingSpot } from '@/hooks/useFirestoreParkingSpots';

// ============================================================================
// TYPES
// ============================================================================

interface ParkingPhotosTabProps {
  /** Parking spot data (injected via globalProps as `parking`) */
  parking: ParkingSpot;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ParkingPhotosTab({ parking }: ParkingPhotosTabProps) {
  const { user } = useAuth();

  const companyId = user?.companyId;
  const currentUserId = user?.uid;

  if (!companyId || !currentUserId) {
    return (
      <p className="p-4 text-center text-muted-foreground">
        Συνδεθείτε για να δείτε τις φωτογραφίες.
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
        category="photos"
        purpose="parking-photo"
        entryPointCategoryFilter="photos"
        displayStyle="media-gallery"
        acceptedTypes={DEFAULT_PHOTO_ACCEPT}
      />
    </section>
  );
}

export default ParkingPhotosTab;
