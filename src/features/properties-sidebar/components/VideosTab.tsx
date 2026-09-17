/**
 * =============================================================================
 * 🏢 ENTERPRISE: Unit Videos Tab
 * =============================================================================
 *
 * Uses centralized EntityFilesManager for video upload with:
 * - Enterprise naming convention (ΔΟΜΗ.txt pattern)
 * - Multi-tenant Storage Rules
 * - Entry point selection for video types
 * - Media gallery display style
 *
 * @module features/properties-sidebar/components/VideosTab
 * @enterprise ADR-031 - Canonical File Storage System
 */

'use client';

import React from 'react';
import { EntityFilesManager } from '@/components/shared/files/EntityFilesManager';
import { DEFAULT_VIDEO_ACCEPT } from '@/config/file-upload-config';
import type { Property } from '@/types/property-viewer';
import { usePropertyFilesTab } from './property-files-tab';

interface VideosTabProps {
  selectedProperty: Property | null;
}

/** - Domain: sales · Category: videos · DisplayStyle: media-gallery */
export function VideosTab({ selectedProperty }: VideosTabProps) {
  const { identity, fallback } = usePropertyFilesTab(selectedProperty, 'videos');

  if (!identity) return fallback;

  return (
    <EntityFilesManager
      {...identity}
      domain="sales"
      category="videos"
      purpose="video"
      entryPointCategoryFilter="videos"
      displayStyle="media-gallery"
      acceptedTypes={DEFAULT_VIDEO_ACCEPT}
    />
  );
}
