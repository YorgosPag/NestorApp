/**
 * =============================================================================
 * 🏢 ENTERPRISE: Building Floorplan Tab
 * =============================================================================
 *
 * Uses centralized EntityFilesManager for building floorplan upload with:
 * - Same UI as Photos/Videos tabs (Αρχεία | Κάδος, Gallery/List/Tree views)
 * - Full-width FloorplanGallery for DXF/PDF display
 * - Enterprise naming convention (ΔΟΜΗ.txt pattern)
 * - Multi-tenant Storage Rules
 *
 * @module components/building-management/tabs/BuildingFloorplanTab
 * @enterprise ADR-031 - Canonical File Storage System
 * @enterprise ADR-033 - Floorplan Processing Pipeline
 *
 * Storage Path:
 * companies/{companyId}/entities/building/{buildingId}/domains/construction/categories/floorplans/files/
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Info } from 'lucide-react';
import { EntityFilesManager } from '@/components/shared/files/EntityFilesManager';
import { useAuth } from '@/auth/contexts/AuthContext';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { getCompanyById } from '@/services/companies.service';
import type { Building } from '@/types/building/contracts';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('BuildingFloorplanTab');

// =============================================================================
// PROPS
// =============================================================================

interface BuildingFloorplanTabProps {
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

/** Accepted file types for floorplans (DXF, PDF, images) */
const FLOORPLAN_ACCEPT = '.dxf,.pdf,application/pdf,application/dxf,image/vnd.dxf,.jpg,.jpeg,.png,image/jpeg,image/png';

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * 🏢 ENTERPRISE: Building Floorplan Tab
 *
 * Displays building floorplans using centralized EntityFilesManager with:
 * - Domain: construction
 * - Category: floorplans
 * - DisplayStyle: floorplan-gallery (full-width DXF/PDF viewer)
 * - Purpose: 'building-floorplan' for filtering
 */
export function BuildingFloorplanTab({
  building,
  data,
  title,
}: BuildingFloorplanTabProps) {
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
          // 🏢 ENTERPRISE: Use companyName or tradeName as fallback
          const displayName = company.companyName || company.tradeName || companyId;
          setCompanyDisplayName(displayName);
        } else {
          setCompanyDisplayName(companyId); // Fallback to ID if company not found
        }
      } catch (error) {
        logger.error('Failed to fetch company name', { error });
        setCompanyDisplayName(companyId); // Fallback to ID on error
      }
    };

    fetchCompanyName();
  }, [companyId]);

  // Translated title
  const displayTitle = title
    ? (title.includes('.') ? t(title) : title)
    : t('tabs.floorplan.title', 'Κάτοψη Κτιρίου');

  // If no building, companyId, or userId, show placeholder
  if (!resolvedBuilding?.id || !companyId || !currentUserId) {
    return (
      <section className="p-2 text-center text-muted-foreground">
        <p>{t('tabs.floorplan.noBuilding', 'Επιλέξτε ένα κτίριο για να δείτε τις κατόψεις.')}</p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-2">
      {/* IFC-compliant info banner: per-floor plans live in the Floors tab */}
      <aside className="mx-2 mt-2 flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-2 py-2 text-sm text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300">
        <Info className="h-4 w-4 shrink-0" />
        <p>{t('tabs.floorplan.floorLevelBanner')}</p>
      </aside>

      <EntityFilesManager
        companyId={companyId}
        currentUserId={currentUserId}
        entityType="building"
        entityId={String(resolvedBuilding.id)}
        entityLabel={resolvedBuilding.name || `Κτίριο ${resolvedBuilding.id}`}
        projectId={resolvedBuilding.projectId}
        domain="construction"
        category="floorplans"
        purpose="building-floorplan"
        entryPointCategoryFilter="floorplans"
        displayStyle="floorplan-gallery"
        acceptedTypes={FLOORPLAN_ACCEPT}
        companyName={companyDisplayName}
      />
    </section>
  );
}

export default BuildingFloorplanTab;
