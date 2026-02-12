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

import type { ComponentType } from 'react';
import type { TabComponentProps } from '@/components/generic/UniversalTabsRenderer';

// ============================================================================
// BUILDING-SPECIFIC COMPONENTS
// ============================================================================

import { GeneralTabContent } from '@/components/building-management/tabs/GeneralTabContent';
import TimelineTabContent from '@/components/building-management/tabs/TimelineTabContent';
import AnalyticsTabContent from '@/components/building-management/tabs/AnalyticsTabContent';
import { StorageTab } from '@/components/building-management/StorageTab';
import { BuildingCustomersTab } from '@/components/building-management/tabs/BuildingCustomersTab';

// ============================================================================
// 🏢 ENTERPRISE: EntityFilesManager-based tabs (ADR-031)
// ============================================================================

import { BuildingFloorplanTab } from '@/components/building-management/tabs/BuildingFloorplanTab';
import { BuildingPhotosTab } from '@/components/building-management/tabs/BuildingPhotosTab';
import { BuildingVideosTab } from '@/components/building-management/tabs/BuildingVideosTab';
import { BuildingContractsTab } from '@/components/building-management/tabs/BuildingContractsTab';

// ============================================================================
// LEGACY COMPONENTS (kept for backward compatibility)
// ============================================================================

import PlaceholderTab from '@/components/building-management/tabs/PlaceholderTab';

// ============================================================================
// BOQ MEASUREMENTS TAB (ADR-175 Phase 1B)
// ============================================================================

import { MeasurementsTabContent } from '@/components/building-management/tabs/MeasurementsTabContent';

// ============================================================================
// BUILDING COMPONENT MAPPING
// 🏢 ENTERPRISE: Explicit type for UniversalTabsRenderer compatibility
// ============================================================================

export const BUILDING_COMPONENT_MAPPING: Record<string, ComponentType<TabComponentProps>> = {
  'GeneralTabContent': GeneralTabContent as ComponentType<TabComponentProps>,
  'TimelineTabContent': TimelineTabContent as ComponentType<TabComponentProps>,
  'AnalyticsTabContent': AnalyticsTabContent as ComponentType<TabComponentProps>,
  'PhotosTabContent': BuildingPhotosTab as ComponentType<TabComponentProps>, // 🏢 ENTERPRISE: Now uses EntityFilesManager
  'VideosTabContent': BuildingVideosTab as ComponentType<TabComponentProps>, // 🏢 ENTERPRISE: Now uses EntityFilesManager
  'PlaceholderTab': PlaceholderTab as ComponentType<TabComponentProps>,
  'FloorplanViewerTab': BuildingFloorplanTab as ComponentType<TabComponentProps>, // 🏢 ENTERPRISE: Uses EntityFilesManager
  'StorageTab': StorageTab as ComponentType<TabComponentProps>,
  'BuildingCustomersTab': BuildingCustomersTab as unknown as ComponentType<TabComponentProps>,

  'MeasurementsTabContent': MeasurementsTabContent as ComponentType<TabComponentProps>,

  // 🏢 ENTERPRISE: Unified Factory aliases - all using EntityFilesManager (ADR-031)
  'BuildingGeneralTab': GeneralTabContent as ComponentType<TabComponentProps>,
  'BuildingFloorsTab': TimelineTabContent as ComponentType<TabComponentProps>,
  'BuildingFloorplansTab': BuildingFloorplanTab as ComponentType<TabComponentProps>, // 🏢 EntityFilesManager
  'BuildingDocumentsTab': BuildingContractsTab as ComponentType<TabComponentProps>, // 🏢 EntityFilesManager
  'BuildingPhotosTab': BuildingPhotosTab as ComponentType<TabComponentProps>, // 🏢 EntityFilesManager
  'BuildingVideosTab': BuildingVideosTab as ComponentType<TabComponentProps>, // 🏢 EntityFilesManager
  'BuildingActivityTab': AnalyticsTabContent as ComponentType<TabComponentProps>,
  'BuildingMeasurementsTab': MeasurementsTabContent as ComponentType<TabComponentProps>,
};

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type BuildingComponentName = keyof typeof BUILDING_COMPONENT_MAPPING;
