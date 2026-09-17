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

import React from 'react';
import { Info } from 'lucide-react';
import { EntityFilesManager } from '@/components/shared/files/EntityFilesManager';
import { EntityFilesTabPlaceholder } from '@/components/shared/files/EntityFilesTabPlaceholder';
import { useAuth } from '@/auth/contexts/AuthContext';
import { FLOORPLAN_PURPOSES } from '@/config/domain-constants';
import { FLOORPLAN_ACCEPT } from '@/config/file-upload-config';
import { tryResolveCompanyId } from '@/services/company-id-resolver';
import { useBuildingFilesTab, type BuildingFilesTabProps } from './building-files-tab';

/**
 * 🏢 ENTERPRISE: Building Floorplan Tab
 *
 * Displays building floorplans using centralized EntityFilesManager with:
 * - Domain: construction
 * - Category: floorplans
 * - DisplayStyle: floorplan-gallery (full-width DXF/PDF viewer)
 * - Purpose: 'building-floorplan' for filtering
 */
export function BuildingFloorplanTab(props: BuildingFilesTabProps) {
  const { user } = useAuth();
  // 🏢 ENTERPRISE: Centralized companyId resolution (ADR-200)
  // Priority: building.companyId → user.companyId (supports super_admin cross-tenant)
  const companyId = tryResolveCompanyId({ building: props.building || props.data, user })?.companyId;
  const { t, identity, companyName } = useBuildingFilesTab(props, { companyId, withCompanyName: true });

  if (!identity) {
    return <EntityFilesTabPlaceholder message={t('tabs.floorplan.noBuilding')} />;
  }

  return (
    <section className="flex flex-col gap-2">
      {/* IFC-compliant info banner: per-floor plans live in the Floors tab */}
      <aside className="mx-2 mt-2 flex items-center gap-2 rounded-md border border-primary/30 bg-[hsl(var(--bg-info))]/20 px-2 py-2 text-sm text-primary">
        <Info className="h-4 w-4 shrink-0" />
        <p>{t('tabs.floorplan.floorLevelBanner')}</p>
      </aside>

      <EntityFilesManager
        {...identity}
        category="floorplans"
        purpose={FLOORPLAN_PURPOSES.BUILDING}
        entryPointCategoryFilter="floorplans"
        displayStyle="floorplan-gallery"
        acceptedTypes={FLOORPLAN_ACCEPT}
        companyName={companyName}
      />
    </section>
  );
}

export default BuildingFloorplanTab;
