/**
 * =============================================================================
 * 🏢 ENTERPRISE: Building Documents Tab
 * =============================================================================
 *
 * Uses centralized EntityFilesManager for building document upload with:
 * - Same UI as Floorplan/Photos/Videos tabs (Αρχεία | Κάδος, Gallery/List/Tree views)
 * - Entry point selection for document types (contracts, permits, studies, etc.)
 * - EXCLUDES photos and videos (they have dedicated tabs)
 * - Enterprise naming convention (ΔΟΜΗ.txt pattern)
 * - Multi-tenant Storage Rules
 *
 * @module components/building-management/tabs/BuildingContractsTab
 * @enterprise ADR-031 - Canonical File Storage System
 *
 * Storage Path:
 * companies/{companyId}/entities/building/{buildingId}/domains/construction/categories/documents/files/
 */

'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { EntityFilesManager } from '@/components/shared/files/EntityFilesManager';
import { EntityFilesTabPlaceholder } from '@/components/shared/files/EntityFilesTabPlaceholder';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import type { FloorInfo } from '@/config/upload-entry-points';
import { useBuildingFilesTab, type BuildingFilesTabProps } from './building-files-tab';

interface BuildingContractsTabProps extends BuildingFilesTabProps {
  /** Injected by UniversalTabsRenderer — navigate to sibling tab */
  onNavigateToTab?: (tabId: string) => void;
}

/**
 * 🏢 ENTERPRISE: Building Documents Tab
 *
 * Displays building documents using centralized EntityFilesManager with:
 * - Domain: construction
 * - Category: documents
 * - Entry points: ALL except photos and videos (filtered via excludeCategories)
 *
 * This tab handles: contracts, permits, studies, invoices, reports, etc.
 * Photos and Videos have their own dedicated tabs for better preview experience.
 */
export function BuildingContractsTab({ onNavigateToTab, ...props }: BuildingContractsTabProps) {
  const { t, identity } = useBuildingFilesTab(props);
  const [floors, setFloors] = useState<FloorInfo[]>([]);
  const buildingId = (props.building || props.data)?.id;

  // 🏢 ADR-191: Fetch floors for per-floor entry point expansion
  const fetchFloors = useCallback(async () => {
    if (!buildingId) return;
    try {
      const result = await apiClient.get<{ floors: Array<{ id: string; number: number; name: string }> }>(
        `${API_ROUTES.FLOORS.LIST}?buildingId=${buildingId}`
      );
      if (result?.floors) {
        const sorted = [...result.floors]
          .sort((a, b) => a.number - b.number)
          .map((f) => ({ id: f.id, number: f.number, name: f.name }));
        setFloors(sorted);
      }
    } catch {
      // Non-blocking: floors are optional for the documents tab
    }
  }, [buildingId]);

  useEffect(() => {
    fetchFloors();
  }, [fetchFloors]);

  if (!identity) {
    return <EntityFilesTabPlaceholder message={t('tabs.contracts.noBuilding')} />;
  }

  return (
    <EntityFilesManager
      {...identity}
      category="documents"
      purpose="document"
      entryPointExcludeCategories={['photos', 'videos']}
      fetchAllDomains
      floors={floors}
      onNavigateToFloors={onNavigateToTab ? () => onNavigateToTab('floors') : undefined}
    />
  );
}

export default BuildingContractsTab;
