// ============================================================================
// PROJECT PHOTOS TAB - MIGRATED TO PhotosTabBase
// ============================================================================
//
// ADR-018: Upload Systems Centralization
// This component now uses the centralized PhotosTabBase template.
//
// BEFORE: 106 lines of custom code
// AFTER: ~25 lines using template
//
// Benefits:
// - Zero code duplication
// - Consistent behavior across all entity types
// - Type-safe (no `any` types)
// - Uses centralized hooks and components
// - Uses PhotoItem instead of raw img elements
//
// ============================================================================

'use client';

import React from 'react';
import { PhotosTabBase } from '@/components/generic/photo-system';

// =============================================================================
// PROPS
// =============================================================================

interface PhotosTabProps {
  project?: { id: string; name?: string };
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Project Photos Tab - Uses centralized PhotosTabBase
 *
 * Migration from 106 lines to ~25 lines using enterprise template.
 */
export function PhotosTab({ project }: PhotosTabProps = {}) {
  // If no project provided, use placeholder
  const entity = project || { id: 'placeholder', name: 'Έργο' };

  return (
    <PhotosTabBase
      entity={entity}
      entityType="project"
      entityName={entity.name}
    />
  );
}
