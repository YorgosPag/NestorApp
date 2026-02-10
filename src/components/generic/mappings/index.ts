/**
 * Centralized Component Mappings για Universal Tabs Renderer
 *
 * Αυτό το αρχείο συγκεντρώνει όλα τα component mappings που χρησιμοποιούσαν
 * οι διαφορετικοί Generic Renderers. Enterprise centralization.
 */

// ============================================================================
// PROJECT COMPONENT MAPPING
// ============================================================================

import { GeneralProjectTab } from '../../projects/general-project-tab';
import { BuildingDataTab } from '../../projects/BuildingDataTab';
import { ParkingTab } from '../../projects/parking/ParkingTab';
import { ContributorsTab } from '../../projects/contributors-tab';
import { DocumentsProjectTab } from '../../projects/documents-project-tab';
import { IkaTab } from '../../projects/ika-tab';
import { PhotosTab } from '../../projects/PhotosTab';
import { VideosTab } from '../../projects/VideosTab';
import { ProjectTimelineTab } from '../../projects/ProjectTimelineTab';
import { ProjectCustomersTab } from '../../projects/customers-tab';
import { ProjectStructureTab } from '../../projects/tabs/ProjectStructureTab';
import { FloorplanViewerTab } from '../../projects/tabs/FloorplanViewerTab';

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
  'FloorplanViewerTab': FloorplanViewerTab,
} as const;

// ============================================================================
// BUILDING COMPONENT MAPPING
// ============================================================================

import { GeneralTabContent } from '../../building-management/tabs/GeneralTabContent';
import TimelineTabContent from '../../building-management/tabs/TimelineTabContent';
import AnalyticsTabContent from '../../building-management/tabs/AnalyticsTabContent';
import PhotosTabContent from '../../building-management/tabs/PhotosTabContent';
import VideosTabContent from '../../building-management/tabs/VideosTabContent';
import PlaceholderTab from '../../building-management/tabs/PlaceholderTab';
import { FloorplanViewerTab as BuildingFloorplanViewerTab } from '../../projects/tabs/FloorplanViewerTab';
import { StorageTab } from '../../building-management/StorageTab';
import { BuildingCustomersTab } from '../../building-management/tabs/BuildingCustomersTab';

export const BUILDING_COMPONENT_MAPPING = {
  'GeneralTabContent': GeneralTabContent,
  'TimelineTabContent': TimelineTabContent,
  'AnalyticsTabContent': AnalyticsTabContent,
  'PhotosTabContent': PhotosTabContent,
  'VideosTabContent': VideosTabContent,
  'PlaceholderTab': PlaceholderTab,
  'FloorplanViewerTab': BuildingFloorplanViewerTab,
  'StorageTab': StorageTab,
  'BuildingCustomersTab': BuildingCustomersTab,

  // 🏢 ENTERPRISE: Unified Factory aliases - same components, different names
  'BuildingGeneralTab': GeneralTabContent,
  'BuildingFloorsTab': TimelineTabContent,  // Based on unified factory mapping
  'BuildingFloorplansTab': BuildingFloorplanViewerTab,
  'BuildingDocumentsTab': PlaceholderTab,
  'BuildingPhotosTab': PhotosTabContent,
  'BuildingActivityTab': AnalyticsTabContent,  // Based on unified factory mapping
} as const;

// ============================================================================
// STORAGE COMPONENT MAPPING
// ============================================================================

import { StorageGeneralTab } from '../../space-management/StoragesPage/StorageDetails/tabs/StorageGeneralTab';
import { StorageStatsTab } from '../../space-management/StoragesPage/StorageDetails/tabs/StorageStatsTab';
import { StorageDocumentsTab } from '../../space-management/StoragesPage/StorageDetails/tabs/StorageDocumentsTab';
import { StoragePhotosTab } from '../../space-management/StoragesPage/StorageDetails/tabs/StoragePhotosTab';
import { StorageHistoryTab } from '../../space-management/StoragesPage/StorageDetails/tabs/StorageHistoryTab';

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
// UNITS COMPONENT MAPPING
// ============================================================================

import { PropertyDetailsContent } from '../../property-viewer/details/PropertyDetailsContent';
import { UnitCustomerTab } from '../../units/tabs/UnitCustomerTab';
import { FloorPlanTab } from '../../../features/units-sidebar/components/FloorPlanTab';

export const UNITS_COMPONENT_MAPPING = {
  'PropertyDetailsContent': PropertyDetailsContent,
  'UnitCustomerTab': UnitCustomerTab,
  'FloorPlanTab': FloorPlanTab,
  'PhotosTabContent': PhotosTabContent,
  'VideosTabContent': VideosTabContent,
  'DocumentsPlaceholder': PlaceholderTab,
  'PlaceholderTab': PlaceholderTab,
  'FloorplanViewerTab': FloorplanViewerTab,
} as const;

// ============================================================================
// CONTACT COMPONENT MAPPING
// ============================================================================

import { ContactBasicInfoTab } from '../../contacts/tabs/ContactBasicInfoTab';
import { ContactCommunicationTab } from '../../contacts/tabs/ContactCommunicationTab';
import { ContactRelationshipsTab } from '../../contacts/tabs/ContactRelationshipsTab';
import { ContactPhotosTab } from '../../contacts/tabs/ContactPhotosTab';
import { ContactBankingTab } from '../../contacts/tabs/ContactBankingTab';
import { PlaceholderContactTab } from '../../contacts/tabs/PlaceholderContactTab';

export const CONTACT_COMPONENT_MAPPING = {
  'ContactBasicInfoTab': ContactBasicInfoTab,
  'ContactCommunicationTab': ContactCommunicationTab,
  'ContactPersonalInfoTab': PlaceholderContactTab, // Future implementation
  'ContactCompanyInfoTab': PlaceholderContactTab,  // Future implementation
  'ContactServicesInfoTab': PlaceholderContactTab, // Future implementation
  'ContactAddressesTab': PlaceholderContactTab,    // Future implementation
  'ContactRelationshipsTab': ContactRelationshipsTab,
  'ContactBankingTab': ContactBankingTab,          // 🏢 ENTERPRISE: Banking accounts (2026-02-01)
  'ContactPhotosTab': ContactPhotosTab,
  'ContactLogoTab': PlaceholderContactTab,         // Future implementation
  'ContactHistoryTab': PlaceholderContactTab,      // Future implementation
  'PlaceholderContactTab': PlaceholderContactTab,
} as const;

// ============================================================================
// PARKING COMPONENT MAPPING
// ============================================================================

import { createModuleLogger } from '@/lib/telemetry';
import { ParkingGeneralTab } from '../../space-management/ParkingPage/ParkingDetails/tabs/ParkingGeneralTab';

export const PARKING_COMPONENT_MAPPING = {
  'ParkingGeneralTab': ParkingGeneralTab,
  'ParkingStatsTab': PlaceholderTab,
  'ParkingDocumentsTab': PlaceholderTab,
  'ParkingPhotosTab': PlaceholderTab,
  'ParkingHistoryTab': PlaceholderTab,
  'PlaceholderTab': PlaceholderTab,
} as const;

// ============================================================================
// MASTER COMPONENT MAPPING (ALL COMBINED)
// ============================================================================

/**
 * Master mapping που περιέχει όλα τα components από όλους τους τύπους.
 * Χρησιμοποιήστε αυτό όταν θέλετε maximum flexibility.
 */
export const MASTER_COMPONENT_MAPPING = {
  ...PROJECT_COMPONENT_MAPPING,
  ...BUILDING_COMPONENT_MAPPING,
  ...STORAGE_COMPONENT_MAPPING,
  ...UNITS_COMPONENT_MAPPING,
  ...CONTACT_COMPONENT_MAPPING,
  ...PARKING_COMPONENT_MAPPING,
} as const;

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type ProjectComponentName = keyof typeof PROJECT_COMPONENT_MAPPING;
export type BuildingComponentName = keyof typeof BUILDING_COMPONENT_MAPPING;
export type StorageComponentName = keyof typeof STORAGE_COMPONENT_MAPPING;
export type UnitsComponentName = keyof typeof UNITS_COMPONENT_MAPPING;
export type ContactComponentName = keyof typeof CONTACT_COMPONENT_MAPPING;
export type ParkingComponentName = keyof typeof PARKING_COMPONENT_MAPPING;
export type MasterComponentName = keyof typeof MASTER_COMPONENT_MAPPING;

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Factory function για να πάρεις το σωστό mapping based on type
 */
export function getComponentMapping(type: 'project' | 'building' | 'storage' | 'units' | 'contact' | 'master') {
  switch (type) {
    case 'project':
      return PROJECT_COMPONENT_MAPPING;
    case 'building':
      return BUILDING_COMPONENT_MAPPING;
    case 'storage':
      return STORAGE_COMPONENT_MAPPING;
    case 'units':
      return UNITS_COMPONENT_MAPPING;
    case 'contact':
      return CONTACT_COMPONENT_MAPPING;
    case 'master':
      return MASTER_COMPONENT_MAPPING;
    default:
      createModuleLogger('ComponentMappings').warn('Unknown component mapping type, falling back to master', { type });
      return MASTER_COMPONENT_MAPPING;
  }
}