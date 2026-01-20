/**
 * =============================================================================
 * 🏢 ENTERPRISE: Project Contracts Tab Content
 * =============================================================================
 *
 * Uses centralized EntityFilesManager for file upload with:
 * - Enterprise naming convention (ΔΟΜΗ.txt pattern)
 * - Smart compression for images
 * - Multi-tenant Storage Rules
 * - Entry point selection for document types
 *
 * @module components/projects/documents/ContractsTabContent
 * @enterprise ADR-031 - Canonical File Storage System
 */

'use client';

import React from 'react';
import { EntityFilesManager } from '@/components/shared/files/EntityFilesManager';
import { useAuth } from '@/auth/contexts/AuthContext';
import type { Project } from '@/types/project';

// =============================================================================
// PROPS
// =============================================================================

interface ContractsTabContentProps {
  /** Project data (passed automatically by UniversalTabsRenderer) */
  project?: Project;
  /** Alternative data prop */
  data?: Project;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Project Contracts Tab - Enterprise File Management
 *
 * Displays contracts using centralized EntityFilesManager with:
 * - Domain: legal
 * - Category: contracts
 * - Entry points from upload-entry-points.ts (project-contract, signed-contract, etc.)
 */
export function ContractsTabContent({ project, data }: ContractsTabContentProps) {
  const { user } = useAuth();

  // Resolve project from props
  const resolvedProject = project || data;

  // Get companyId and userId from auth context
  const companyId = user?.companyId;
  const currentUserId = user?.uid;

  // If no project, companyId, or userId, show placeholder
  if (!resolvedProject?.id || !companyId || !currentUserId) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <p>Επιλέξτε ένα έργο για να δείτε τα συμβόλαια.</p>
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
      domain="legal"
      category="contracts"
      purpose="contract"
    />
  );
}
