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

import React from 'react';
import { EntityFilesManager } from '@/components/shared/files/EntityFilesManager';
import { useAuth } from '@/auth/contexts/AuthContext';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { Building } from '@/types/building/contracts';

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
}: BuildingContractsTabProps) {
  const { user } = useAuth();
  const { t } = useTranslation('building');

  // Resolve building from props
  const resolvedBuilding = building || data;

  // Get companyId and userId from auth context
  const companyId = user?.companyId;
  const currentUserId = user?.uid;

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
    />
  );
}

export default BuildingContractsTab;
