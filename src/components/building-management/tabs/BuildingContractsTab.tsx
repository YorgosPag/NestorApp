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
import { useAuth } from '@/auth/contexts/AuthContext';
import { useCompanyId } from '@/hooks/useCompanyId';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import type { Building } from '@/types/building/contracts';
import type { FloorInfo } from '@/config/upload-entry-points';

// =============================================================================
// PROPS
// =============================================================================

interface BuildingContractsTabProps {
  /** Building data (passed automatically by UniversalTabsRenderer) */
  building?: Building;
  /** Alternative data prop */
  data?: Building;
  /** Title for the tab */
  title?: string;
  /** Injected by UniversalTabsRenderer — navigate to sibling tab */
  onNavigateToTab?: (tabId: string) => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

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
export function BuildingContractsTab({
  building,
  data,
  onNavigateToTab,
}: BuildingContractsTabProps) {
  const { user } = useAuth();
  const { t } = useTranslation('building');
  const [floors, setFloors] = useState<FloorInfo[]>([]);

  // Resolve building from props
  const resolvedBuilding = building || data;

  // Get companyId and userId from auth context
  const companyId = useCompanyId()?.companyId;
  const currentUserId = user?.uid;

  // 🏢 ADR-191: Fetch floors for per-floor entry point expansion
  const fetchFloors = useCallback(async () => {
    if (!resolvedBuilding?.id) return;
    try {
      const result = await apiClient.get<{ floors: Array<{ id: string; number: number; name: string }> }>(
        `${API_ROUTES.FLOORS.LIST}?buildingId=${resolvedBuilding.id}`
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
  }, [resolvedBuilding?.id]);

  useEffect(() => {
    fetchFloors();
  }, [fetchFloors]);

  // If no building, companyId, or userId, show placeholder
  if (!resolvedBuilding?.id || !companyId || !currentUserId) {
    return (
      <section className="p-2 text-center text-muted-foreground">
        <p>{t('tabs.contracts.noBuilding', 'Επιλέξτε ένα κτίριο για να δείτε τα έγγραφα.')}</p>
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
