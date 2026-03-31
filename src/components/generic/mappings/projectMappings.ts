/**
 * 🏢 ENTERPRISE: Domain-scoped Project Component Mapping
 *
 * Contains ONLY project-related components.
 * This file is the ONLY mapping import needed for /projects pages.
 *
 * RATIONALE: Splitting from master barrel eliminates transitive imports
 * of building/unit/contact/parking/storage components from project pages,
 * significantly reducing module graph for /projects route.
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
// ADR-191: ParkingTab removed from project level — parking belongs to Building tabs
// Entity Associations replaces legacy ContributorsTab (stub)
import { ProjectAssociationsTab } from '@/components/projects/tabs/ProjectAssociationsTab';
import { DocumentsProjectTab } from '@/components/projects/documents-project-tab';
import { IkaTab } from '@/components/projects/ika-tab';
import { PhotosTab } from '@/components/projects/PhotosTab';
import { VideosTab } from '@/components/projects/VideosTab';
import { ProjectTimelineTab } from '@/components/projects/ProjectTimelineTab';
import { ProjectCustomersTab } from '@/components/projects/customers-tab';
import { ProjectStructureTab } from '@/components/projects/tabs/ProjectStructureTab';
import { FloorplanViewerTab } from '@/components/projects/tabs/FloorplanViewerTab';
import { ProjectFloorplanTab } from '@/components/projects/tabs/ProjectFloorplanTab';
import { ProjectParkingTab } from '@/components/projects/tabs/ProjectParkingTab';
// 🏢 ENTERPRISE: Multi-address locations tab (ADR-167)
import { ProjectLocationsTab } from '@/components/projects/tabs/ProjectLocationsTab';
// 🏢 ENTERPRISE: Project-level measurements aggregation (read-only, data from buildings)
import { ProjectMeasurementsTab } from '@/components/projects/tabs/ProjectMeasurementsTab';
// 🏢 ENTERPRISE: Centralized audit trail / history tab (ADR-195)
import { ActivityTab } from '@/components/shared/audit/ActivityTab';
// 🏢 ENTERPRISE: Brokerage agreements tab (ADR-230 / SPEC-230B)
import { ProjectBrokersTab } from '@/components/projects/tabs/ProjectBrokersTab';
// 🏢 ENTERPRISE: Ownership percentage table (ADR-235)
import { OwnershipTableTab } from '@/components/projects/tabs/OwnershipTableTab';
// 🏢 ENTERPRISE: Landowners management tab (ADR-244 / SPEC-244A)
import { ProjectLandownersTab } from '@/components/projects/tabs/ProjectLandownersTab';

// ============================================================================
// PROJECT COMPONENT MAPPING
// ============================================================================

export const PROJECT_COMPONENT_MAPPING = {
  'GeneralProjectTab': GeneralProjectTab,
  'BuildingDataTab': BuildingDataTab,
  // 'ParkingTab': removed (ADR-191 — parking at Building level only)
  // Entity Associations replaces legacy ContributorsTab (stub)
  'ProjectAssociationsTab': ProjectAssociationsTab,
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
  // ADR-191: Unified parking tab with floorplans + list sub-tabs
  'ProjectParkingTab': ProjectParkingTab,
  // 🔄 LEGACY: FloorplanViewerTab kept for backward compatibility
  'FloorplanViewerTab': FloorplanViewerTab,
  // 🏢 ENTERPRISE: Multi-address locations management tab (ADR-167)
  'ProjectLocationsTab': ProjectLocationsTab,
  // 🏢 ENTERPRISE: Project-level measurements aggregation (read-only)
  'ProjectMeasurementsTab': ProjectMeasurementsTab,
  // 🏢 ENTERPRISE: Centralized audit trail / history tab (ADR-195)
  'ActivityTab': ActivityTab,
  // 🏢 ENTERPRISE: Brokerage agreements tab (ADR-230 / SPEC-230B)
  'ProjectBrokersTab': ProjectBrokersTab,
  // 🏢 ENTERPRISE: Ownership percentage table (ADR-235)
  'OwnershipTableTab': OwnershipTableTab,
  // 🏢 ENTERPRISE: Landowners management tab (ADR-244 / SPEC-244A)
  'ProjectLandownersTab': ProjectLandownersTab,
} as const;

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type ProjectComponentName = keyof typeof PROJECT_COMPONENT_MAPPING;
