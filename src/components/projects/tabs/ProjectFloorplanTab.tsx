/* eslint-disable design-system/prefer-design-system-imports */
/**
 * =============================================================================
 * 🏢 ENTERPRISE: Project Floorplan Tab
 * =============================================================================
 *
 * Uses centralized EntityFilesManager for floorplan upload with:
 * - Same UI as Photos/Videos tabs (Αρχεία | Κάδος, Gallery/List/Tree views)
 * - Full-width FloorplanGallery for DXF/PDF display
 * - Enterprise naming convention (ΔΟΜΗ.txt pattern)
 * - Multi-tenant Storage Rules
 *
 * @module components/projects/tabs/ProjectFloorplanTab
 * @enterprise ADR-031 - Canonical File Storage System
 * @enterprise ADR-033 - Floorplan Processing Pipeline
 *
 * Storage Path:
 * companies/{companyId}/entities/project/{projectId}/domains/construction/categories/floorplans/files/
 */

'use client';

import React, { useState, useEffect } from 'react';
import { EntityFilesManager } from '@/components/shared/files/EntityFilesManager';
import { useAuth } from '@/auth/contexts/AuthContext';
import { useCompanyId } from '@/hooks/useCompanyId';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { getCompanyById } from '@/services/companies.service'; // 🏢 ENTERPRISE: Fetch company name (ADR-031)
import { ENTITY_TYPES, FLOORPLAN_PURPOSES } from '@/config/domain-constants';
import { FLOORPLAN_ACCEPT } from '@/config/file-upload-config';
import type { Project } from '@/types/project';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { createModuleLogger } from '@/lib/telemetry';
const logger = createModuleLogger('ProjectFloorplanTab');

// =============================================================================
// PROPS
// =============================================================================

interface ProjectFloorplanTabProps {
  /** Project data (passed automatically by UniversalTabsRenderer) */
  project?: Project & { id: string | number; name?: string };
  /** Alternative data prop */
  data?: Project;
  /** Floorplan type: 'project' for general, 'parking' for parking */
  floorplanType?: 'project' | 'parking';
  /** Title for the tab */
  title?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * 🏢 ENTERPRISE: Project Floorplan Tab
 *
 * Displays project floorplans using centralized EntityFilesManager with:
 * - Domain: construction
 * - Category: floorplans
 * - DisplayStyle: floorplan-gallery (full-width DXF/PDF viewer)
 * - Purpose: 'project-floorplan' or 'parking-floorplan' for filtering
 */
export function ProjectFloorplanTab({
  project,
  data,
  floorplanType = 'project',
  title,
}: ProjectFloorplanTabProps) {
  const { user } = useAuth();
  const colors = useSemanticColors();
  const { t } = useTranslation('building');

  // Resolve project from props
  const resolvedProject = project || data;

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
          // 🏢 ENTERPRISE: Use companyName or tradeName as fallback
          const displayName = company.companyName || company.tradeName || companyId;
          setCompanyDisplayName(displayName);
        } else {
          setCompanyDisplayName(companyId); // Fallback to ID if company not found
        }
      } catch (error) {
        logger.error('[ProjectFloorplanTab] Failed to fetch company name:', { error: error });
        setCompanyDisplayName(companyId); // Fallback to ID on error
      }
    };

    fetchCompanyName();
  }, [companyId]);

  // Determine purpose based on floorplan type for filtering
  const purpose = floorplanType === 'parking' ? FLOORPLAN_PURPOSES.PARKING : FLOORPLAN_PURPOSES.PROJECT;

  // Translated title
  const _displayTitle = title
    ? (title.includes('.') ? t(title) : title)
    : floorplanType === 'parking'
      ? t('tabs.parkingFloorplan.title')
      : t('tabs.projectFloorplan.title');

  // If no project, companyId, or userId, show placeholder
  if (!resolvedProject?.id || !companyId || !currentUserId) {
    return (
      <section className={cn("p-2 text-center", colors.text.muted)}>
        <p>{t('tabs.floorplan.noProject', 'Επιλέξτε ένα έργο για να δείτε τις κατόψεις.')}</p>
      </section>
    );
  }

  return (
    <EntityFilesManager
      companyId={companyId}
      currentUserId={currentUserId}
      entityType={ENTITY_TYPES.PROJECT}
      entityId={String(resolvedProject.id)}
      entityLabel={resolvedProject.name || `Έργο ${resolvedProject.id}`}
      projectId={String(resolvedProject.id)}
      domain="construction"
      category="floorplans"
      purpose={purpose}
      entryPointCategoryFilter="floorplans"
      displayStyle="floorplan-gallery"
      acceptedTypes={FLOORPLAN_ACCEPT}
      companyName={companyDisplayName} // 🏢 ENTERPRISE: Pass company name for tree display (ADR-031)
    />
  );
}

export default ProjectFloorplanTab;
