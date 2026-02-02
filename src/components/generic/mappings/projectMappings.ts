/**
 * 🏢 ENTERPRISE: Domain-scoped Project Component Mapping
 *
 * Contains ONLY project-related components.
 * This file is the ONLY mapping import needed for /audit and project pages.
 *
 * RATIONALE: Splitting from master barrel eliminates transitive imports
 * of building/unit/contact/parking/storage components from project pages,
 * significantly reducing module graph for /audit route.
 *
 * NOTE: These mappings are IDENTICAL to those in index.ts.
 * This is NOT duplication - it's domain scoping.
 * The index.ts will be kept for legacy/backward compatibility.
 *
 * @module components/generic/mappings/projectMappings
 */

// ============================================================================
// PROJECT COMPONENTS - ONLY PROJECT DOMAIN
// ============================================================================

import { GeneralProjectTab } from '@/components/projects/general-project-tab';
import { BuildingDataTab } from '@/components/projects/BuildingDataTab';
import { ParkingTab } from '@/components/projects/parking/ParkingTab';
import { ContributorsTab } from '@/components/projects/contributors-tab';
import { DocumentsProjectTab } from '@/components/projects/documents-project-tab';
import { IkaTab } from '@/components/projects/ika-tab';
import { PhotosTab } from '@/components/projects/PhotosTab';
import { VideosTab } from '@/components/projects/VideosTab';
import { ProjectTimelineTab } from '@/components/projects/ProjectTimelineTab';
import { ProjectCustomersTab } from '@/components/projects/customers-tab';
import { ProjectStructureTab } from '@/components/projects/tabs/ProjectStructureTab';
import { FloorplanViewerTab } from '@/components/projects/tabs/FloorplanViewerTab';
import { ProjectFloorplanTab } from '@/components/projects/tabs/ProjectFloorplanTab';
// 🏢 ENTERPRISE: Multi-address locations tab (ADR-167)
import { ProjectLocationsTab } from '@/components/projects/tabs/ProjectLocationsTab';

// ============================================================================
// PROJECT COMPONENT MAPPING
// ============================================================================

export const PROJECT_COMPONENT_MAPPING = {
  'GeneralProjectTab': GeneralProjectTab,
  'BuildingDataTab': BuildingDataTab,
  'ParkingTab': ParkingTab,
  'ContributorsTab': ContributorsTab,
  'DocumentsProjectTab': DocumentsProjectTab,
  'IkaTab': IkaTab,
  'PhotosTab': PhotosTab,
  'VideosTab': VideosTab,
  'ProjectTimelineTab': ProjectTimelineTab,
  'ProjectCustomersTab': ProjectCustomersTab,
  'ProjectStructureTab': ProjectStructureTab,
  // 🏢 ENTERPRISE: ProjectFloorplanTab uses centralized EntityFilesManager pattern
  // Same storage structure as Photos, Videos, Documents (ADR-033)
  'ProjectFloorplanTab': ProjectFloorplanTab,
  // 🔄 LEGACY: FloorplanViewerTab kept for backward compatibility
  'FloorplanViewerTab': FloorplanViewerTab,
  // 🏢 ENTERPRISE: Multi-address locations management tab (ADR-167)
  'ProjectLocationsTab': ProjectLocationsTab,
} as const;

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type ProjectComponentName = keyof typeof PROJECT_COMPONENT_MAPPING;
