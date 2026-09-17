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
 * @enterprise ADR-709 - Immutable Storage Path
 *
 * Storage Path:
 * companies/{companyId}/entities/project/{projectId}/domains/construction/categories/floorplans/files/
 *
 * ADR-709: `projectId` below is FileRecord metadata only — it no longer reaches
 * the storage path. Until then this docblock and the prop below disagreed, and
 * the prop won: files landed under `projects/{id}/entities/project/{id}/`.
 */

'use client';

import React from 'react';
import { EntityFilesManager } from '@/components/shared/files/EntityFilesManager';
import { EntityFilesTabPlaceholder } from '@/components/shared/files/EntityFilesTabPlaceholder';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { FLOORPLAN_PURPOSES } from '@/config/domain-constants';
import { FLOORPLAN_ACCEPT } from '@/config/file-upload-config';
import { useProjectFilesTab, type ProjectFilesTabProps } from '../project-files-tab';

interface ProjectFloorplanTabProps extends ProjectFilesTabProps {
  /** Floorplan type: 'project' for general, 'parking' for parking */
  floorplanType?: 'project' | 'parking';
  /** Title for the tab */
  title?: string;
}

/**
 * 🏢 ENTERPRISE: Project Floorplan Tab
 *
 * - Domain: construction · Category: floorplans
 * - DisplayStyle: floorplan-gallery (full-width DXF/PDF viewer)
 * - Purpose: 'project-floorplan' or 'parking-floorplan' for filtering
 */
export function ProjectFloorplanTab({
  floorplanType = 'project',
  title: _title,
  ...props
}: ProjectFloorplanTabProps) {
  const { t } = useTranslation(['building', 'building-address', 'building-filters', 'building-storage', 'building-tabs', 'building-timeline']);
  const { identity, companyName, projectId } = useProjectFilesTab(props, { withCompanyName: true });

  // Determine purpose based on floorplan type for filtering
  const purpose = floorplanType === 'parking' ? FLOORPLAN_PURPOSES.PARKING : FLOORPLAN_PURPOSES.PROJECT;

  if (!identity) {
    return (
      <EntityFilesTabPlaceholder
        message={t('tabs.floorplan.noProject', 'Επιλέξτε ένα έργο για να δείτε τις κατόψεις.')}
      />
    );
  }

  return (
    <EntityFilesManager
      {...identity}
      projectId={String(projectId)}
      category="floorplans"
      purpose={purpose}
      entryPointCategoryFilter="floorplans"
      displayStyle="floorplan-gallery"
      acceptedTypes={FLOORPLAN_ACCEPT}
      companyName={companyName}
    />
  );
}

export default ProjectFloorplanTab;
