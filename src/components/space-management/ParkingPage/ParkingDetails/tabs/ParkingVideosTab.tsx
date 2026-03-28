/**
 * ParkingVideosTab — Videos tab for individual parking spot detail view
 *
 * Uses centralized EntityFilesManager with media-gallery display style
 * for video upload, viewing, and management.
 *
 * Storage path (ADR-031 canonical):
 * companies/{companyId}/entities/parking_spot/{id}/domains/construction/categories/videos/
 *
 * @module components/space-management/ParkingPage/ParkingDetails/tabs/ParkingVideosTab
 * @see ADR-031 — Canonical File Storage System
 */

'use client';

import { EntityFilesManager } from '@/components/shared/files/EntityFilesManager';
import { useAuth } from '@/auth/contexts/AuthContext';
import { useCompanyId } from '@/hooks/useCompanyId';
import { DEFAULT_VIDEO_ACCEPT } from '@/config/file-upload-config';
import type { ParkingSpot } from '@/hooks/useFirestoreParkingSpots';
import '@/lib/design-system';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';

// ============================================================================
// TYPES
// ============================================================================

interface ParkingVideosTabProps {
  /** Parking spot data (injected via globalProps as `parking`) */
  parking: ParkingSpot;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ParkingVideosTab({ parking }: ParkingVideosTabProps) {
  const { user } = useAuth();
  const { t } = useTranslation('parking');
  const colors = useSemanticColors();

  const companyId = useCompanyId()?.companyId;
  const currentUserId = user?.uid;

  if (!companyId || !currentUserId) {
    return (
      <p className={cn("p-4 text-center", colors.text.muted)}>
        {t('auth.signInToViewVideos')}
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
        category="videos"
        purpose="parking-video"
        entryPointCategoryFilter="videos"
        displayStyle="media-gallery"
        acceptedTypes={DEFAULT_VIDEO_ACCEPT}
      />
    </section>
  );
}

export default ParkingVideosTab;
