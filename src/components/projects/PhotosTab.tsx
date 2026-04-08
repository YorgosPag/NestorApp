/**
 * =============================================================================
 * 🏢 ENTERPRISE: Project Photos Tab
 * =============================================================================
 *
 * Uses centralized EntityFilesManager for photo upload with:
 * - Enterprise naming convention (ΔΟΜΗ.txt pattern)
 * - Smart compression for images
 * - Multi-tenant Storage Rules
 * - Entry point selection for photo types
 *
 * @module components/projects/PhotosTab
 * @enterprise ADR-031 - Canonical File Storage System
 *
 * MIGRATION NOTE: Previously used PhotosTabBase template.
 * Now uses EntityFilesManager for consistent behavior across all entity types.
 */

'use client';

import React from 'react';
import { EntityFilesManager } from '@/components/shared/files/EntityFilesManager';
import { useAuth } from '@/auth/contexts/AuthContext';
import { useCompanyId } from '@/hooks/useCompanyId';
import { DEFAULT_PHOTO_ACCEPT } from '@/config/file-upload-config';
import { ENTITY_TYPES } from '@/config/domain-constants';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import type { Project } from '@/types/project';
import '@/lib/design-system';

// =============================================================================
// PROPS
// =============================================================================

interface PhotosTabProps {
  /** Project data (passed automatically by UniversalTabsRenderer) */
  project?: Project & { id: string; name?: string };
  /** Alternative data prop */
  data?: Project;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Project Photos Tab - Enterprise File Management
 *
 * Displays project photos using centralized EntityFilesManager with:
 * - Domain: construction
 * - Category: photos
 * - Entry points: construction-photo, exterior-photo, etc.
 */
export function PhotosTab({ project, data }: PhotosTabProps) {
  const { user } = useAuth();
  const spacing = useSpacingTokens();
  const colors = useSemanticColors();

  // Resolve project from props
  const resolvedProject = project || data;

  // Get companyId and userId from auth context
  const companyId = useCompanyId()?.companyId;
  const currentUserId = user?.uid;

  // If no project, companyId, or userId, show placeholder
  if (!resolvedProject?.id || !companyId || !currentUserId) {
    return (
      <div className={cn(spacing.padding.lg, "text-center", colors.text.muted)}>
        <p>Επιλέξτε ένα έργο για να δείτε τις φωτογραφίες.</p> {/* eslint-disable-line custom/no-hardcoded-strings */}
      </div>
    );
  }

  return (
    <EntityFilesManager
      companyId={companyId}
      currentUserId={currentUserId}
      entityType={ENTITY_TYPES.PROJECT}
      entityId={String(resolvedProject.id)}
      entityLabel={resolvedProject.name || `Έργο ${resolvedProject.id}`}
      domain="construction"
      category="photos"
      purpose="photo"
      entryPointCategoryFilter="photos"
      displayStyle="media-gallery"
      acceptedTypes={DEFAULT_PHOTO_ACCEPT}
    />
  );
}
