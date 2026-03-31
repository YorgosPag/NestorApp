/**
 * ?? ENTERPRISE: Domain-scoped Properties Component Mapping
 *
 * Contains ONLY properties-related components.
 * This file is the ONLY mapping import needed for /properties and PropertiesSidebar.
 *
 * RATIONALE: Splitting from master barrel eliminates transitive imports
 * of project/building/contact/parking/storage components from units pages,
 * significantly reducing module graph.
 *
 * NOTE: These mappings are IDENTICAL to those in index.ts.
 * This is NOT duplication - it's domain scoping.
 * The index.ts will be kept for legacy/backward compatibility.
 *
 * @module components/generic/mappings/propertiesMappings
 */

// ============================================================================
// UNITS-SPECIFIC COMPONENTS (EntityFilesManager-based tabs)
// ============================================================================

import type { ComponentType } from 'react';
import type { TabComponentProps } from '@/components/generic/UniversalTabsRenderer';

import { PropertyDetailsContent } from '@/components/property-viewer/details/PropertyDetailsContent';
import { PropertyCustomerTab as UnitCustomerTab } from '@/components/properties/tabs/PropertyCustomerTab';
import { FloorPlanTab } from '@/features/properties-sidebar/components/FloorPlanTab';
import { DocumentsTab } from '@/features/properties-sidebar/components/DocumentsTab';
import { PhotosTab } from '@/features/properties-sidebar/components/PhotosTab';
import { VideosTab } from '@/features/properties-sidebar/components/VideosTab';

// ============================================================================
// SHARED COMPONENTS (legacy - kept for backward compatibility)
// ============================================================================

import PhotosTabContent from '@/components/building-management/tabs/PhotosTabContent';
import VideosTabContent from '@/components/building-management/tabs/VideosTabContent';
import PlaceholderTab from '@/components/building-management/tabs/PlaceholderTab';
import { FloorplanViewerTab } from '@/components/projects/tabs/FloorplanViewerTab';
import { ActivityTab } from '@/components/shared/audit/ActivityTab';

// ============================================================================
// UNITS COMPONENT MAPPING
// ============================================================================

export const PROPERTIES_COMPONENT_MAPPING: Record<string, ComponentType<TabComponentProps>> = {
  'PropertyDetailsContent': PropertyDetailsContent as ComponentType<TabComponentProps>,
  'UnitCustomerTab': UnitCustomerTab as ComponentType<TabComponentProps>,
  'FloorPlanTab': FloorPlanTab as unknown as ComponentType<TabComponentProps>,
  // ?? ENTERPRISE: New EntityFilesManager-based tabs (ADR-031)
  'DocumentsTab': DocumentsTab as unknown as ComponentType<TabComponentProps>,
  'PhotosTab': PhotosTab as unknown as ComponentType<TabComponentProps>,
  'VideosTab': VideosTab as unknown as ComponentType<TabComponentProps>,
  // Legacy mappings (kept for backward compatibility)
  'PhotosTabContent': PhotosTabContent as ComponentType<TabComponentProps>,
  'VideosTabContent': VideosTabContent as ComponentType<TabComponentProps>,
  'DocumentsPlaceholder': PlaceholderTab as ComponentType<TabComponentProps>,
  'PlaceholderTab': PlaceholderTab as ComponentType<TabComponentProps>,
  'FloorplanViewerTab': FloorplanViewerTab as unknown as ComponentType<TabComponentProps>,
  // 📜 ADR-195: Entity Audit Trail
  'ActivityTab': ActivityTab as ComponentType<TabComponentProps>,
};

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type PropertiesComponentName = keyof typeof PROPERTIES_COMPONENT_MAPPING;

