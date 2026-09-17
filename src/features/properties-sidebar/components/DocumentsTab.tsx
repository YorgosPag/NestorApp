/**
 * =============================================================================
 * 🏢 ENTERPRISE: Unit Documents Tab
 * =============================================================================
 *
 * Uses centralized EntityFilesManager for document upload with:
 * - Enterprise naming convention (ΔΟΜΗ.txt pattern)
 * - Multi-tenant Storage Rules
 * - Entry point selection for document types
 * - EXCLUDES photos, videos, and floorplans (they have dedicated tabs)
 *
 * @module features/properties-sidebar/components/DocumentsTab
 * @enterprise ADR-031 - Canonical File Storage System
 */

'use client';

import React from 'react';
import { EntityFilesManager } from '@/components/shared/files/EntityFilesManager';
import type { Property } from '@/types/property-viewer';
import { usePropertyFilesTab } from './property-files-tab';

interface DocumentsTabProps {
  selectedProperty: Property | null;
}

/**
 * - Domain: sales (default for unit documents) · Category: documents
 * - Entry points: ALL except photos, videos, and floorplans
 */
export function DocumentsTab({ selectedProperty }: DocumentsTabProps) {
  const { identity, fallback } = usePropertyFilesTab(selectedProperty, 'documents');

  if (!identity) return fallback;

  return (
    <EntityFilesManager
      {...identity}
      domain="sales"
      category="documents"
      purpose="document"
      entryPointExcludeCategories={['photos', 'videos', 'floorplans']}
      fetchAllDomains
    />
  );
}
