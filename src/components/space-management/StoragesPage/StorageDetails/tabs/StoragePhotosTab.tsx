// ============================================================================
// STORAGE PHOTOS TAB - MIGRATED TO PhotosTabBase
// ============================================================================
//
// ADR-018: Upload Systems Centralization
// This component now uses the centralized PhotosTabBase template.
//
// BEFORE: 244 lines of custom code with categories
// AFTER: ~30 lines using template with showStats and showCategories
//
// Benefits:
// - Zero code duplication
// - Consistent behavior across all entity types
// - Type-safe (no `any` types)
// - Centralized category definitions in photos-tab-config
// - Stats and category filtering built into template
//
// ============================================================================

'use client';

import React from 'react';
import type { Storage } from '@/types/storage/contracts';
import { PhotosTabBase } from '@/components/generic/photo-system';

// =============================================================================
// PROPS
// =============================================================================

interface StoragePhotosTabProps {
  storage: Storage;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Storage Photos Tab - Uses centralized PhotosTabBase
 *
 * Migration from 244 lines to ~30 lines using enterprise template.
 *
 * Features automatically provided by PhotosTabBase:
 * - Stats section (showStats: true in config)
 * - Category filtering (showCategories: true in config)
 * - Entity info display (showEntityInfo: true in config)
 * - Upload with progress
 * - Photo grid with PhotoItem
 */
export function StoragePhotosTab({ storage }: StoragePhotosTabProps) {
  return (
    <PhotosTabBase
      entity={storage}
      entityType="storage"
      entityName={storage.name}
    />
  );
}