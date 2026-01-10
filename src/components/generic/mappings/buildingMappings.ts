/**
 * 🏢 ENTERPRISE: Domain-scoped Building Component Mapping
 *
 * Contains ONLY building-related components.
 * This file is the ONLY mapping import needed for building detail pages.
 *
 * RATIONALE: Splitting from master barrel eliminates transitive imports
 * of project/unit/contact/parking/storage components from building pages,
 * significantly reducing module graph.
 *
 * NOTE: These mappings are IDENTICAL to those in index.ts.
 * This is NOT duplication - it's domain scoping.
 * The index.ts will be kept for legacy/backward compatibility.
 *
 * @module components/generic/mappings/buildingMappings
 */

// ============================================================================
// BUILDING-SPECIFIC COMPONENTS
// ============================================================================

import { GeneralTabContent } from '@/components/building-management/tabs/GeneralTabContent';
import TimelineTabContent from '@/components/building-management/tabs/TimelineTabContent';
import AnalyticsTabContent from '@/components/building-management/tabs/AnalyticsTabContent';
import { StorageTab } from '@/components/building-management/StorageTab';
import { BuildingCustomersTab } from '@/components/building-management/tabs/BuildingCustomersTab';

// ============================================================================
// SHARED COMPONENTS (reused from their original locations)
// ============================================================================

import PhotosTabContent from '@/components/building-management/tabs/PhotosTabContent';
import VideosTabContent from '@/components/building-management/tabs/VideosTabContent';
import PlaceholderTab from '@/components/building-management/tabs/PlaceholderTab';
import { FloorplanViewerTab } from '@/components/projects/tabs/FloorplanViewerTab';

// ============================================================================
// BUILDING COMPONENT MAPPING
// ============================================================================

export const BUILDING_COMPONENT_MAPPING = {
  'GeneralTabContent': GeneralTabContent,
  'TimelineTabContent': TimelineTabContent,
  'AnalyticsTabContent': AnalyticsTabContent,
  'PhotosTabContent': PhotosTabContent,
  'VideosTabContent': VideosTabContent,
  'PlaceholderTab': PlaceholderTab,
  'FloorplanViewerTab': FloorplanViewerTab,
  'StorageTab': StorageTab,
  'BuildingCustomersTab': BuildingCustomersTab,

  // 🏢 ENTERPRISE: Unified Factory aliases - same components, different names
  'BuildingGeneralTab': GeneralTabContent,
  'BuildingFloorsTab': TimelineTabContent,
  'BuildingFloorplansTab': FloorplanViewerTab,
  'BuildingDocumentsTab': PlaceholderTab,
  'BuildingPhotosTab': PhotosTabContent,
  'BuildingActivityTab': AnalyticsTabContent,
} as const;

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type BuildingComponentName = keyof typeof BUILDING_COMPONENT_MAPPING;
