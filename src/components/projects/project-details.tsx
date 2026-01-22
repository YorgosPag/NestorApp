/**
 * =============================================================================
 * 🏢 ENTERPRISE: Project Details Component
 * =============================================================================
 *
 * Main container for project details display with tabbed interface.
 *
 * @module components/projects/project-details
 * @enterprise ADR-033 - Floorplan Processing Pipeline
 *
 * Architecture:
 * - Uses UniversalTabsRenderer for flexible tab rendering
 * - Floorplan tabs use centralized file storage (same as Photos/Videos)
 * - Each tab component is self-contained (no props drilling for floorplans)
 *
 * MIGRATION NOTE (ADR-033):
 * - Legacy FloorplanService/DxfImportModal removed
 * - ProjectFloorplanTab now handles upload internally
 * - Storage: companies/{companyId}/entities/project/{projectId}/domains/construction/categories/floorplans/
 */

'use client';

import React from 'react';
import type { Project } from '@/types/project';
import { ProjectDetailsHeader } from './ProjectDetailsHeader';
import { Briefcase } from 'lucide-react';
// 🏢 ENTERPRISE: Direct imports to avoid barrel (reduces module graph)
// UniversalTabsRenderer from generic (renderer only, no mappings)
import { UniversalTabsRenderer, convertToUniversalConfig } from '@/components/generic/UniversalTabsRenderer';
// PROJECT_COMPONENT_MAPPING from domain-scoped file (not master barrel)
import { PROJECT_COMPONENT_MAPPING } from '@/components/generic/mappings/projectMappings';
import { getSortedProjectTabs } from '@/config/project-tabs-config';
import { DetailsContainer } from '@/core/containers';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

// ============================================================================
// TYPES
// ============================================================================

interface ProjectDetailsProps {
  project: Project & { companyName: string };
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * 🏢 ENTERPRISE: Project Details Component
 *
 * Displays project information in a tabbed interface.
 * Floorplan tabs (ProjectFloorplanTab) are self-contained and handle
 * their own upload/display using centralized EntityFilesManager pattern.
 */
export function ProjectDetails({ project }: ProjectDetailsProps) {
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('projects');

  // Get project tabs from centralized config
  const projectTabs = getSortedProjectTabs();

  return (
    <DetailsContainer
      selectedItem={project}
      header={<ProjectDetailsHeader project={project!} />}
      tabsRenderer={
        <UniversalTabsRenderer
          tabs={projectTabs.map(convertToUniversalConfig)}
          data={project!}
          componentMapping={PROJECT_COMPONENT_MAPPING}
          defaultTab="general"
          theme="default"
          // 🏢 ENTERPRISE: i18n - Use building namespace for tab labels
          translationNamespace="building"
          globalProps={{
            projectId: project!.id
          }}
        />
      }
      emptyStateProps={{
        icon: Briefcase,
        title: t('emptyState.title'),
        description: t('emptyState.description')
      }}
    />
  );
}

export default ProjectDetails;
