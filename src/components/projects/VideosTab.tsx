/**
 * =============================================================================
 * 🏢 ENTERPRISE: Project Videos Tab
 * =============================================================================
 *
 * Uses centralized EntityFilesManager for video upload with:
 * - Enterprise naming convention (ΔΟΜΗ.txt pattern)
 * - Multi-tenant Storage Rules
 * - Entry point selection for video types
 *
 * @module components/projects/VideosTab
 * @enterprise ADR-031 - Canonical File Storage System
 */

'use client';

import React from 'react';
import { EntityFilesManager } from '@/components/shared/files/EntityFilesManager';
import { useAuth } from '@/auth/contexts/AuthContext';
import { DEFAULT_VIDEO_ACCEPT } from '@/config/file-upload-config';
import type { Project } from '@/types/project';

// =============================================================================
// PROPS
// =============================================================================

interface VideosTabProps {
  /** Project data (passed automatically by UniversalTabsRenderer) */
  project?: Project;
  /** Alternative data prop */
  data?: Project;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Project Videos Tab - Enterprise File Management
 *
 * Displays project videos using centralized EntityFilesManager with:
 * - Domain: construction
 * - Category: videos
 * - Entry points: construction-video, etc.
 */
export function VideosTab({ project, data }: VideosTabProps) {
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
        <p>Επιλέξτε ένα έργο για να δείτε τα βίντεο.</p>
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
      category="videos"
      purpose="video"
      entryPointCategoryFilter="videos"
      displayStyle="media-gallery"
      acceptedTypes={DEFAULT_VIDEO_ACCEPT}
    />
  );
}
