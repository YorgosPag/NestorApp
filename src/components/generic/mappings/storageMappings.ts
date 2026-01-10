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
// ============================================================================

import { StorageGeneralTab } from '@/components/space-management/StoragesPage/StorageDetails/tabs/StorageGeneralTab';
import { StorageStatsTab } from '@/components/space-management/StoragesPage/StorageDetails/tabs/StorageStatsTab';
import { StorageDocumentsTab } from '@/components/space-management/StoragesPage/StorageDetails/tabs/StorageDocumentsTab';
import { StoragePhotosTab } from '@/components/space-management/StoragesPage/StorageDetails/tabs/StoragePhotosTab';
import { StorageHistoryTab } from '@/components/space-management/StoragesPage/StorageDetails/tabs/StorageHistoryTab';

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
  'StorageStatsTab': StorageStatsTab,
  'StorageDocumentsTab': StorageDocumentsTab,
  'StoragePhotosTab': StoragePhotosTab,
  'StorageHistoryTab': StorageHistoryTab,
  'PlaceholderTab': PlaceholderTab,
  'FloorplanViewerTab': FloorplanViewerTab,
} as const;

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type StorageComponentName = keyof typeof STORAGE_COMPONENT_MAPPING;
