/**
 * =============================================================================
 * 🏢 ENTERPRISE: Building Videos Tab
 * =============================================================================
 *
 * Uses centralized EntityFilesManager for building videos upload with:
 * - Same UI as Floorplan/Photos tabs (Αρχεία | Κάδος, Gallery/List/Tree views)
 * - Video gallery display
 * - Enterprise naming convention (ΔΟΜΗ.txt pattern)
 * - Multi-tenant Storage Rules
 *
 * @module components/building-management/tabs/BuildingVideosTab
 * @enterprise ADR-031 - Canonical File Storage System
 *
 * Storage Path:
 * companies/{companyId}/entities/building/{buildingId}/domains/construction/categories/videos/files/
 */

'use client';

import React, { useState, useEffect } from 'react';
import { EntityFilesManager } from '@/components/shared/files/EntityFilesManager';
import { useAuth } from '@/auth/contexts/AuthContext';
import { useCompanyId } from '@/hooks/useCompanyId';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { getCompanyById } from '@/services/companies.service';
import type { Building } from '@/types/building/contracts';
import { createModuleLogger } from '@/lib/telemetry';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { ENTITY_TYPES } from '@/config/domain-constants';
import '@/lib/design-system';

const logger = createModuleLogger('BuildingVideosTab');

// =============================================================================
// PROPS
// =============================================================================

interface BuildingVideosTabProps {
  /** Building data (passed automatically by UniversalTabsRenderer) */
  building?: Building;
  /** Alternative data prop */
  data?: Building;
  /** Title for the tab */
  title?: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

/** Accepted file types for videos */
const VIDEOS_ACCEPT = 'video/mp4,video/webm,video/quicktime,video/x-msvideo,.mp4,.webm,.mov,.avi';

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * 🏢 ENTERPRISE: Building Videos Tab
 *
 * Displays building videos using centralized EntityFilesManager with:
 * - Domain: construction
 * - Category: videos
 * - DisplayStyle: gallery (video grid)
 * - Purpose: 'building-video' for filtering
 */
export function BuildingVideosTab({
  building,
  data,
  title: _title,
}: BuildingVideosTabProps) {
  const { user } = useAuth();
  const { t } = useTranslation('building');
  const colors = useSemanticColors();

  // Resolve building from props
  const resolvedBuilding = building || data;

  // Get companyId and userId from auth context
  const companyId = useCompanyId()?.companyId;
  const currentUserId = user?.uid;

  // 🏢 ENTERPRISE: Fetch company name for Technical View display (ADR-031)
  const [companyDisplayName, setCompanyDisplayName] = useState<string | undefined>(undefined);

  useEffect(() => {
    const fetchCompanyName = async () => {
      if (!companyId) {
        setCompanyDisplayName(undefined);
        return;
      }

      try {
        const company = await getCompanyById(companyId);
        if (company && company.type === 'company') {
          const displayName = company.companyName || company.tradeName || companyId;
          setCompanyDisplayName(displayName);
        } else {
          setCompanyDisplayName(companyId);
        }
      } catch (error) {
        logger.error('Failed to fetch company name', { error });
        setCompanyDisplayName(companyId);
      }
    };

    fetchCompanyName();
  }, [companyId]);

  // If no building, companyId, or userId, show placeholder
  if (!resolvedBuilding?.id || !companyId || !currentUserId) {
    return (
      <section className={cn("p-2 text-center", colors.text.muted)}>
        <p>{t('tabs.videos.noBuilding')}</p>
      </section>
    );
  }

  return (
    <EntityFilesManager
      companyId={companyId}
      currentUserId={currentUserId}
      entityType={ENTITY_TYPES.BUILDING}
      entityId={String(resolvedBuilding.id)}
      entityLabel={resolvedBuilding.name || t('entityLabel', { id: resolvedBuilding.id })}
      projectId={resolvedBuilding.projectId}
      domain="construction"
      category="videos"
      purpose="building-video"
      entryPointCategoryFilter="videos"
      displayStyle="media-gallery"
      acceptedTypes={VIDEOS_ACCEPT}
      companyName={companyDisplayName}
    />
  );
}

export default BuildingVideosTab;
