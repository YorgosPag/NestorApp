// ============================================================================
// BUILDING PHOTOS TAB - MIGRATED TO PhotosTabBase
// ============================================================================
//
// ADR-018: Upload Systems Centralization
// This component now uses the centralized PhotosTabBase template.
//
// BEFORE: 72 lines of custom code
// AFTER: ~20 lines using template
//
// Benefits:
// - Zero code duplication
// - Consistent behavior across all entity types
// - Type-safe (no `any` types)
// - Uses centralized hooks and components
//
// ============================================================================

'use client';

import React from 'react';
import type { Building } from '@/types/building/contracts';
import { PhotosTabBase } from '@/components/generic/photo-system';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';

// =============================================================================
// PROPS
// =============================================================================

interface PhotosTabContentProps {
  /** Building entity (for building context) */
  building?: Building;
  /** Selected unit (for units context via GenericUnitsTabsRenderer) */
  selectedUnit?: { id: string; name?: string };
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Building/Unit Photos Tab - Uses centralized PhotosTabBase
 *
 * Migration from 72 lines to ~20 lines using enterprise template.
 *
 * Supports both:
 * - Building context (receives building prop)
 * - Units context (receives selectedUnit prop from GenericUnitsTabsRenderer)
 */
const PhotosTabContent = ({ building, selectedUnit }: PhotosTabContentProps) => {
  // 🏢 ENTERPRISE: i18n hook for translations
  const { t } = useTranslation('building');

  // Support both building and unit contexts
  const defaultName = t('header.title');
  const entity = building || selectedUnit || { id: 'placeholder', name: defaultName };

  return (
    <PhotosTabBase
      entity={entity}
      entityType="building"
      entityName={entity.name}
    />
  );
};

export default PhotosTabContent;
