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
import { FLOORPLAN_PURPOSES, ENTITY_TYPES } from '@/config/domain-constants';
import { FLOORPLAN_ACCEPT } from '@/config/file-upload-config';
import type { Building } from '@/types/building/contracts';
import { tryResolveCompanyId } from '@/services/company-id-resolver';
import { createModuleLogger } from '@/lib/telemetry';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import '@/lib/design-system';

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
  title: _title,
}: BuildingFloorplanTabProps) {
  const { user } = useAuth();
  const { t } = useTranslation('building');
  const colors = useSemanticColors();

  // Resolve building from props
  const resolvedBuilding = building || data;

  // Get userId from auth context
  const currentUserId = user?.uid;
  // 🏢 ENTERPRISE: Centralized companyId resolution (ADR-200)
  // Priority: building.companyId → user.companyId (supports super_admin cross-tenant)
  const companyId = tryResolveCompanyId({ building: resolvedBuilding, user })?.companyId;

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

  // If no building, companyId, or userId, show placeholder
  if (!resolvedBuilding?.id || !companyId || !currentUserId) {
    return (
      <section className={cn("p-2 text-center", colors.text.muted)}>
        <p>{t('tabs.floorplan.noBuilding')}</p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-2">
      {/* IFC-compliant info banner: per-floor plans live in the Floors tab */}
      {/* eslint-disable-next-line design-system/enforce-semantic-colors */}
      <aside className="mx-2 mt-2 flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-2 py-2 text-sm text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300">
        <Info className="h-4 w-4 shrink-0" />
        <p>{t('tabs.floorplan.floorLevelBanner')}</p>
      </aside>

      <EntityFilesManager
        companyId={companyId}
        currentUserId={currentUserId}
        entityType={ENTITY_TYPES.BUILDING}
        entityId={String(resolvedBuilding.id)}
        entityLabel={resolvedBuilding.name || t('entityLabel', { id: resolvedBuilding.id })}
        projectId={resolvedBuilding.projectId}
        domain="construction"
        category="floorplans"
        purpose={FLOORPLAN_PURPOSES.BUILDING}
        entryPointCategoryFilter="floorplans"
        displayStyle="floorplan-gallery"
        acceptedTypes={FLOORPLAN_ACCEPT}
        companyName={companyDisplayName}
      />
    </section>
  );
}

export default BuildingFloorplanTab;
