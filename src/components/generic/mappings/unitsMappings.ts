/**
 * ?? ENTERPRISE: Domain-scoped Units Component Mapping
 *
 * Contains ONLY units-related components.
 * This file is the ONLY mapping import needed for /units and UnitsSidebar.
 *
 * RATIONALE: Splitting from master barrel eliminates transitive imports
 * of project/building/contact/parking/storage components from units pages,
 * significantly reducing module graph.
 *
 * NOTE: These mappings are IDENTICAL to those in index.ts.
 * This is NOT duplication - it's domain scoping.
 * The index.ts will be kept for legacy/backward compatibility.
 *
 * @module components/generic/mappings/unitsMappings
 */

// ============================================================================
// UNITS-SPECIFIC COMPONENTS (EntityFilesManager-based tabs)
// ============================================================================

import type { ComponentType } from 'react';
import type { TabComponentProps } from '@/components/generic/UniversalTabsRenderer';

import { PropertyDetailsContent } from '@/components/property-viewer/details/PropertyDetailsContent';
import { UnitCustomerTab } from '@/components/units/tabs/UnitCustomerTab';
import { FloorPlanTab } from '@/features/units-sidebar/components/FloorPlanTab';
import { DocumentsTab } from '@/features/units-sidebar/components/DocumentsTab';
import { PhotosTab } from '@/features/units-sidebar/components/PhotosTab';
import { VideosTab } from '@/features/units-sidebar/components/VideosTab';

// ============================================================================
// SHARED COMPONENTS (legacy - kept for backward compatibility)
// ============================================================================

import PhotosTabContent from '@/components/building-management/tabs/PhotosTabContent';
import VideosTabContent from '@/components/building-management/tabs/VideosTabContent';
import PlaceholderTab from '@/components/building-management/tabs/PlaceholderTab';
import { FloorplanViewerTab } from '@/components/projects/tabs/FloorplanViewerTab';

// ============================================================================
// UNITS COMPONENT MAPPING
// ============================================================================

export const UNITS_COMPONENT_MAPPING: Record<string, ComponentType<TabComponentProps>> = {
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
};

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type UnitsComponentName = keyof typeof UNITS_COMPONENT_MAPPING;

