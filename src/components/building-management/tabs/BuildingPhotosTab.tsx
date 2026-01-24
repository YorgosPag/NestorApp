/**
 * =============================================================================
 * 🏢 ENTERPRISE: Building Photos Tab
 * =============================================================================
 *
 * Uses centralized EntityFilesManager for building photos upload with:
 * - Same UI as Floorplan/Videos tabs (Αρχεία | Κάδος, Gallery/List/Tree views)
 * - Photo gallery display
 * - Enterprise naming convention (ΔΟΜΗ.txt pattern)
 * - Multi-tenant Storage Rules
 *
 * @module components/building-management/tabs/BuildingPhotosTab
 * @enterprise ADR-031 - Canonical File Storage System
 *
 * Storage Path:
 * companies/{companyId}/entities/building/{buildingId}/domains/construction/categories/photos/files/
 */

'use client';

import React, { useState, useEffect } from 'react';
import { EntityFilesManager } from '@/components/shared/files/EntityFilesManager';
import { useAuth } from '@/auth/contexts/AuthContext';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { getCompanyById } from '@/services/companies.service';
import type { Building } from '@/types/building/contracts';

// =============================================================================
// PROPS
// =============================================================================

interface BuildingPhotosTabProps {
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

/** Accepted file types for photos */
const PHOTOS_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif';

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * 🏢 ENTERPRISE: Building Photos Tab
 *
 * Displays building photos using centralized EntityFilesManager with:
 * - Domain: construction
 * - Category: photos
 * - DisplayStyle: gallery (photo grid)
 * - Purpose: 'building-photo' for filtering
 */
export function BuildingPhotosTab({
  building,
  data,
  title,
}: BuildingPhotosTabProps) {
  const { user } = useAuth();
  const { t } = useTranslation('building');

  // Resolve building from props
  const resolvedBuilding = building || data;

  // Get companyId and userId from auth context
  const companyId = user?.companyId;
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
        console.error('[BuildingPhotosTab] Failed to fetch company name:', error);
        setCompanyDisplayName(companyId);
      }
    };

    fetchCompanyName();
  }, [companyId]);

  // If no building, companyId, or userId, show placeholder
  if (!resolvedBuilding?.id || !companyId || !currentUserId) {
    return (
      <section className="p-6 text-center text-muted-foreground">
        <p>{t('tabs.photos.noBuilding', 'Επιλέξτε ένα κτίριο για να δείτε τις φωτογραφίες.')}</p>
      </section>
    );
  }

  return (
    <EntityFilesManager
      companyId={companyId}
      currentUserId={currentUserId}
      entityType="building"
      entityId={String(resolvedBuilding.id)}
      entityLabel={resolvedBuilding.name || `Κτίριο ${resolvedBuilding.id}`}
      projectId={resolvedBuilding.projectId}
      domain="construction"
      category="photos"
      purpose="building-photo"
      entryPointCategoryFilter="photos"
      displayStyle="media-gallery"
      acceptedTypes={PHOTOS_ACCEPT}
      companyName={companyDisplayName}
    />
  );
}

export default BuildingPhotosTab;
