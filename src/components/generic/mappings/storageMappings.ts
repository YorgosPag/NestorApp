/**
 * 🏢 ENTERPRISE: Domain-scoped Storage Component Mapping
 *
 * Contains ONLY storage-related components.
 * This file is the ONLY mapping import needed for storage detail pages.
 *
 * RATIONALE: Splitting from master barrel eliminates transitive imports
 * of project/unit/contact/parking/building components from storage pages,
 * significantly reducing module graph.
 *
 * NOTE: These mappings are IDENTICAL to those in index.ts.
 * This is NOT duplication - it's domain scoping.
 * The index.ts will be kept for legacy/backward compatibility.
 *
 * @module components/generic/mappings/storageMappings
 */

// ============================================================================
// STORAGE-SPECIFIC COMPONENTS
// ADR-193: Aligned with Units prototype — removed Stats/History, added Videos
// ============================================================================

import { StorageGeneralTab } from '@/components/space-management/StoragesPage/StorageDetails/tabs/StorageGeneralTab';
import { StorageDocumentsTab } from '@/components/space-management/StoragesPage/StorageDetails/tabs/StorageDocumentsTab';
import { StoragePhotosTab } from '@/components/space-management/StoragesPage/StorageDetails/tabs/StoragePhotosTab';
import { StorageVideosTab } from '@/components/space-management/StoragesPage/StorageDetails/tabs/StorageVideosTab';

// ============================================================================
// SHARED COMPONENTS (reused from their original locations)
// ============================================================================

import PlaceholderTab from '@/components/building-management/tabs/PlaceholderTab';
import { FloorplanViewerTab } from '@/components/projects/tabs/FloorplanViewerTab';

// ============================================================================
// STORAGE COMPONENT MAPPING
// ============================================================================

export const STORAGE_COMPONENT_MAPPING = {
  'StorageGeneralTab': StorageGeneralTab,
  'StorageDocumentsTab': StorageDocumentsTab,
  'StoragePhotosTab': StoragePhotosTab,
  'StorageVideosTab': StorageVideosTab,
  'PlaceholderTab': PlaceholderTab,
  'FloorplanViewerTab': FloorplanViewerTab,
} as const;

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type StorageComponentName = keyof typeof STORAGE_COMPONENT_MAPPING;
