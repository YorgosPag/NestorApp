/* eslint-disable design-system/prefer-design-system-imports */
/**
 * =============================================================================
 * 🏢 ENTERPRISE: Project Miscellaneous Documents Tab Content
 * =============================================================================
 *
 * Uses centralized EntityFilesManager for file upload with:
 * - Enterprise naming convention (ΔΟΜΗ.txt pattern)
 * - Smart compression for images
 * - Multi-tenant Storage Rules
 * - Entry point selection for document types
 *
 * @module components/projects/documents/MiscellaneousTabContent
 * @enterprise ADR-031 - Canonical File Storage System
 */

'use client';

import React from 'react';
import { EntityFilesManager } from '@/components/shared/files/EntityFilesManager';
import { useAuth } from '@/auth/contexts/AuthContext';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { Project } from '@/types/project';

// =============================================================================
// PROPS
// =============================================================================

interface MiscellaneousTabContentProps {
  /** Project data (passed automatically by UniversalTabsRenderer) */
  project?: Project;
  /** Alternative data prop */
  data?: Project;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Project Miscellaneous Documents Tab - Enterprise File Management
 *
 * Displays general project documents using centralized EntityFilesManager with:
 * - Domain: construction
 * - Category: documents
 * - Entry points: permits, reports, invoices, delivery notes, etc.
 */
export function MiscellaneousTabContent({ project, data }: MiscellaneousTabContentProps) {
  const { user } = useAuth();
  const { t } = useTranslation('projects');

  // Resolve project from props
  const resolvedProject = project || data;

  // Get companyId and userId from auth context
  const companyId = user?.companyId;
  const currentUserId = user?.uid;

  // If no project, companyId, or userId, show placeholder
  if (!resolvedProject?.id || !companyId || !currentUserId) {
    return (
      <div className="p-2 text-center text-muted-foreground">
        <p>{t('documents.selectForDocuments')}</p>
      </div>
    );
  }

  return (
    <EntityFilesManager
      companyId={companyId}
      currentUserId={currentUserId}
      entityType="project"
      entityId={String(resolvedProject.id)}
      entityLabel={resolvedProject.name || `Έργο ${resolvedProject.id}`}
      domain="construction"
      category="documents"
      purpose="document"
    />
  );
}
