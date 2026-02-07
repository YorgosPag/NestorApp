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
 *
 * MIGRATION NOTE: Previously had nested sub-tabs (Contracts, Miscellaneous).
 * Now uses unified EntityFilesManager with entry point selector.
 */

'use client';

import React from 'react';
import { EntityFilesManager } from '@/components/shared/files/EntityFilesManager';
import { useAuth } from '@/auth/contexts/AuthContext';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import type { Project } from '@/types/project';

// =============================================================================
// PROPS
// =============================================================================

interface DocumentsProjectTabProps {
  /** Project data (passed automatically by UniversalTabsRenderer) */
  project?: Project;
  /** Alternative data prop */
  data?: Project;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Project Documents Tab - Enterprise File Management
 *
 * Displays project documents using centralized EntityFilesManager with:
 * - Domain: construction (default for file queries)
 * - Category: documents (default for file queries)
 * - Entry points: ALL except photos and videos (filtered via excludeCategories)
 *
 * This tab handles: contracts, permits, invoices, reports, delivery notes, etc.
 * Photos and Videos have their own dedicated tabs for better preview experience.
 */
export function DocumentsProjectTab({ project, data }: DocumentsProjectTabProps) {
  const { user } = useAuth();
  const spacing = useSpacingTokens();
  const colors = useSemanticColors();

  // Resolve project from props
  const resolvedProject = project || data;

  // Get companyId and userId from auth context
  const companyId = user?.companyId;
  const currentUserId = user?.uid;

  // If no project, companyId, or userId, show placeholder
  if (!resolvedProject?.id || !companyId || !currentUserId) {
    return (
      <div className={cn(spacing.padding.lg, "text-center", colors.text.muted)}>
        <p>Επιλέξτε ένα έργο για να δείτε τα έγγραφα.</p>
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
      entryPointExcludeCategories={['photos', 'videos']}
    />
  );
}
