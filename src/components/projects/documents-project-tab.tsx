/**
 * =============================================================================
 * 🏢 ENTERPRISE: Project Documents Tab
 * =============================================================================
 *
 * Uses centralized EntityFilesManager for document upload with:
 * - Enterprise naming convention (ΔΟΜΗ.txt pattern)
 * - Multi-tenant Storage Rules
 * - Entry point selection for document types (contracts, permits, invoices, etc.)
 * - EXCLUDES photos and videos (they have dedicated tabs)
 *
 * @module components/projects/documents-project-tab
 * @enterprise ADR-031 - Canonical File Storage System
 */

'use client';

import React from 'react';
import { EntityFilesManager } from '@/components/shared/files/EntityFilesManager';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  ProjectFilesTabPlaceholder,
  useProjectFilesTab,
  type ProjectFilesTabProps,
} from './project-files-tab';

interface DocumentsProjectTabProps extends ProjectFilesTabProps {
  /** Injected by UniversalTabsRenderer — navigate to sibling tab */
  onNavigateToTab?: (tabId: string) => void;
}

/**
 * Project Documents Tab - Enterprise File Management
 *
 * - Domain: construction · Category: documents
 * - Entry points: ALL except photos and videos (filtered via excludeCategories)
 */
export function DocumentsProjectTab({ onNavigateToTab, ...props }: DocumentsProjectTabProps) {
  const { t } = useTranslation(['files', 'files-media', 'projects']);
  const { identity } = useProjectFilesTab(props);

  if (!identity) {
    return <ProjectFilesTabPlaceholder message={t('projects:documents.selectProject')} />;
  }

  return (
    <EntityFilesManager
      {...identity}
      category="documents"
      purpose="document"
      fetchAllDomains
      entryPointExcludeCategories={['photos', 'videos']}
      enableBuildingLink
      onNavigateToFloors={onNavigateToTab ? () => onNavigateToTab('structure') : undefined}
      navigateToFloorsLabel={t('studies.goToBuildings')}
    />
  );
}
