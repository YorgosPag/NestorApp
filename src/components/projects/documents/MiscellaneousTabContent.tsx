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
import { useAuthContext } from '@/contexts/AuthContext';
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
  const { user } = useAuthContext();

  // Resolve project from props
  const resolvedProject = project || data;

  // Get companyId from auth context
  const companyId = user?.companyId;

  // If no project or companyId, show placeholder
  if (!resolvedProject?.id || !companyId) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <p>Επιλέξτε ένα έργο για να δείτε τα έγγραφα.</p>
      </div>
    );
  }

  return (
    <EntityFilesManager
      companyId={companyId}
      entityType="project"
      entityId={String(resolvedProject.id)}
      entityLabel={resolvedProject.name || `Έργο ${resolvedProject.id}`}
      domain="construction"
      category="documents"
      purpose="document"
      showEntryPointSelector={true}
    />
  );
}
