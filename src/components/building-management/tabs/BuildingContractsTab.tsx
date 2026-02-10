/**
 * =============================================================================
 * 🏢 ENTERPRISE: Building Contracts Tab
 * =============================================================================
 *
 * Uses centralized EntityFilesManager for building contracts/documents upload with:
 * - Same UI as Floorplan/Photos/Videos tabs (Αρχεία | Κάδος, Gallery/List/Tree views)
 * - Document list display
 * - Enterprise naming convention (ΔΟΜΗ.txt pattern)
 * - Multi-tenant Storage Rules
 *
 * @module components/building-management/tabs/BuildingContractsTab
 * @enterprise ADR-031 - Canonical File Storage System
 *
 * Storage Path:
 * companies/{companyId}/entities/building/{buildingId}/domains/legal/categories/contracts/files/
 */

'use client';

import React, { useState, useEffect } from 'react';
import { EntityFilesManager } from '@/components/shared/files/EntityFilesManager';
import { useAuth } from '@/auth/contexts/AuthContext';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { getCompanyById } from '@/services/companies.service';
import type { Building } from '@/types/building/contracts';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('BuildingContractsTab');

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
// CONSTANTS
// =============================================================================

/** Accepted file types for contracts/documents */
const CONTRACTS_ACCEPT = 'application/pdf,.pdf,application/msword,.doc,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx,application/vnd.ms-excel,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.xlsx';

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * 🏢 ENTERPRISE: Building Contracts Tab
 *
 * Displays building contracts/documents using centralized EntityFilesManager with:
 * - Domain: legal
 * - Category: contracts
 * - DisplayStyle: list (document list)
 * - Purpose: 'building-contract' for filtering
 */
export function BuildingContractsTab({
  building,
  data,
  title,
}: BuildingContractsTabProps) {
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
        logger.error('Failed to fetch company name', { error });
        setCompanyDisplayName(companyId);
      }
    };

    fetchCompanyName();
  }, [companyId]);

  // If no building, companyId, or userId, show placeholder
  if (!resolvedBuilding?.id || !companyId || !currentUserId) {
    return (
      <section className="p-6 text-center text-muted-foreground">
        <p>{t('tabs.contracts.noBuilding', 'Επιλέξτε ένα κτίριο για να δείτε τα συμβόλαια.')}</p>
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
      domain="legal"
      category="contracts"
      purpose="building-contract"
      entryPointCategoryFilter="contracts"
      displayStyle="standard"
      acceptedTypes={CONTRACTS_ACCEPT}
      companyName={companyDisplayName}
    />
  );
}

export default BuildingContractsTab;
