'use client';

import React from 'react';
import type { SectionConfig } from '@/config/company-gemi-config';
import type { IndividualSectionConfig } from '@/config/individual-config';
import type { ServiceSectionConfig } from '@/config/service-config';
import { getIconComponent } from './utils/IconMapping';
import {
  createTabsFromConfig,
  createCompanyTabsFromConfig,
  createIndividualTabsFromConfig,
  createServiceTabsFromConfig,
  createTabFromSection,
  type TabConfig
} from './utils/TabConfigFactory';
import { GenericTabRenderer } from './GenericTabRenderer';

// ============================================================================
// 🔥 EXTRACTED: ALL LOGIC MOVED TO SPECIALIZED UTILITIES
// ============================================================================

/**
 * Icon mapping και photo preview components moved to:
 * - IconMapping.ts - Centralized icon resolution
 * - PhotoPreviewCard.tsx - Unified photo card component
 * - PhotosPreview.tsx - Unified photos preview layouts
 * - TabConfigFactory.ts - Unified tab creation logic
 *
 * This file now serves as a clean orchestrator and re-export point.
 */

// ============================================================================
// 🎯 UNIFIED TAB CREATION API
// ============================================================================

/**
 * NEW UNIFIED API - Uses TabConfigFactory for all contact types
 *
 * @example
 * ```tsx
 * import { createTabsFromConfig } from '@/components/generic/ConfigTabsHelper';
 *
 * // NEW: Unified API
 * const tabs = createTabsFromConfig('company', sections, {
 *   data: contact,
 *   onPhotoClick: handlePhotoClick
 * });
 * ```
 */
export { createTabsFromConfig, type TabConfig } from './utils/TabConfigFactory';

/**
 * LEGACY API - Backwards compatibility wrappers
 *
 * These functions now delegate to the unified TabConfigFactory.
 * They maintain the same interface για existing code compatibility.
 */
export {
  createCompanyTabsFromConfig,
  createIndividualTabsFromConfig,
  createServiceTabsFromConfig,
  createTabFromSection
} from './utils/TabConfigFactory';

// ============================================================================
// RE-EXPORTS για BACKWARD COMPATIBILITY
// ============================================================================

/**
 * Re-export utilities για components που χρησιμοποιούν το ConfigTabsHelper
 */
export { getIconComponent } from './utils/IconMapping';
export { PhotosPreview, CompanyPhotosPreview, IndividualPhotosPreview, ServiceLogoPreview } from './utils/PhotosPreview';
export { PhotoPreviewCard, CompanyLogoCard, RepresentativePhotoCard, IndividualPhotoCard, ServiceLogoCard } from './utils/PhotoPreviewCard';

// Default imports για το default export
import PhotosPreviewDefault from './utils/PhotosPreview';
import PhotoPreviewCardDefault from './utils/PhotoPreviewCard';

// ============================================================================
// DEFAULT EXPORT για LEGACY COMPATIBILITY
// ============================================================================

export default {
  // Legacy function names (now delegated to TabConfigFactory)
  createTabsFromConfig: createCompanyTabsFromConfig,
  createIndividualTabsFromConfig,
  createServiceTabsFromConfig,
  createTabFromSection,
  getIconComponent,

  // New unified components (reference default exports)
  PhotosPreview: PhotosPreviewDefault,
  PhotoPreviewCard: PhotoPreviewCardDefault
};