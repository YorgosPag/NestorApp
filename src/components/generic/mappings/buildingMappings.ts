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
// SHARED COMPONENTS (reused from their original locations)
// ============================================================================

import PhotosTabContent from '@/components/building-management/tabs/PhotosTabContent';
import VideosTabContent from '@/components/building-management/tabs/VideosTabContent';
import PlaceholderTab from '@/components/building-management/tabs/PlaceholderTab';
import { FloorplanViewerTab } from '@/components/projects/tabs/FloorplanViewerTab';

// ============================================================================
// BUILDING COMPONENT MAPPING
// 🏢 ENTERPRISE: Explicit type for UniversalTabsRenderer compatibility
// ============================================================================

export const BUILDING_COMPONENT_MAPPING: Record<string, ComponentType<TabComponentProps>> = {
  'GeneralTabContent': GeneralTabContent as ComponentType<TabComponentProps>,
  'TimelineTabContent': TimelineTabContent as ComponentType<TabComponentProps>,
  'AnalyticsTabContent': AnalyticsTabContent as ComponentType<TabComponentProps>,
  'PhotosTabContent': PhotosTabContent as ComponentType<TabComponentProps>,
  'VideosTabContent': VideosTabContent as ComponentType<TabComponentProps>,
  'PlaceholderTab': PlaceholderTab as ComponentType<TabComponentProps>,
  'FloorplanViewerTab': FloorplanViewerTab as unknown as ComponentType<TabComponentProps>, // 🏢 ENTERPRISE: Double assertion for component with specific props
  'StorageTab': StorageTab as ComponentType<TabComponentProps>,
  'BuildingCustomersTab': BuildingCustomersTab as unknown as ComponentType<TabComponentProps>, // 🏢 ENTERPRISE: Double assertion for component with specific props

  // 🏢 ENTERPRISE: Unified Factory aliases - same components, different names
  'BuildingGeneralTab': GeneralTabContent as ComponentType<TabComponentProps>,
  'BuildingFloorsTab': TimelineTabContent as ComponentType<TabComponentProps>,
  'BuildingFloorplansTab': FloorplanViewerTab as ComponentType<TabComponentProps>,
  'BuildingDocumentsTab': PlaceholderTab as ComponentType<TabComponentProps>,
  'BuildingPhotosTab': PhotosTabContent as ComponentType<TabComponentProps>,
  'BuildingActivityTab': AnalyticsTabContent as ComponentType<TabComponentProps>,
};

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type BuildingComponentName = keyof typeof BUILDING_COMPONENT_MAPPING;
