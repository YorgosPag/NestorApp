// 🏢 ENTERPRISE: Type definitions for Projects module
// NOTE: No 'use server' - types are shared between client and server
import type { Project, ProjectCustomer, ProjectStats, ProjectUpdatePayload } from '@/types/project';
import type { Contact } from '@/types/contacts';
import type { Building } from '@/types/building/contracts';
import type { Property } from '@/types/property-viewer';
import type { Storage } from '@/types/storage/contracts';
import type { ParkingSpot } from '@/types/parking';

/**
 * 🏢 ENTERPRISE: Unit with customer info for project structure
 */
export type ProjectUnit = Property & { customerName?: string | null };

/**
 * 🏢 ENTERPRISE: Storage summary for project structure (minimal fields)
 */
export type ProjectStorage = Pick<Storage, 'id' | 'name' | 'type' | 'status' | 'area' | 'floor'>;

/**
 * 🏢 ENTERPRISE: Parking summary for project structure (minimal fields)
 */
export type ProjectParking = Pick<ParkingSpot, 'id' | 'code' | 'type' | 'status' | 'level' | 'area'>;

/**
 * 🏢 ENTERPRISE: Building with full hierarchy (Units, Storage, Parking)
 *
 * Architecture decision (from BuildingSpacesTabs):
 * ❌ NO: Parking/Storage as "attachments" or children of Units
 * ✅ YES: Parking/Storage/Units as equal parallel categories in Building context
 *
 * NOTE: Using intersection type (&) instead of extends to avoid conflict with Building's index signature
 */
export type ProjectBuilding = Omit<Building, 'units'> & {
  /** Units in this building */
  units: ProjectUnit[];
  /** Storage areas in this building */
  storages: ProjectStorage[];
  /** Parking spots in this building */
  parkingSpots: ProjectParking[];
};

/**
 * 🏢 ENTERPRISE: Complete project structure with hierarchical data
 *
 * Hierarchy: Project → Buildings → (Units | Storage | Parking)
 */
export interface ProjectStructure {
  project: Project;
  buildings: ProjectBuilding[];
}

export interface IProjectsRepository {
  getProjectsByCompanyId(companyId: string): Promise<Project[]>;
  getProjectById(projectId: string): Promise<Project | null>;
  getBuildingsByProjectId(projectId: string): Promise<Building[]>;
  getUnitsByBuildingId(buildingId: string): Promise<Property[]>;
  getContactsByIds(ids: string[]): Promise<Contact[]>;
  /** 🏢 ENTERPRISE: Update project in Firestore */
  updateProject?(projectId: string, updates: ProjectUpdatePayload): Promise<void>;
}

export interface IProjectsService {
  getProjectsByCompanyId(companyId: string): Promise<Project[]>;
  getProjectStructure(projectId: string): Promise<ProjectStructure | null>;
  getProjectCustomers(projectId: string): Promise<ProjectCustomer[]>;
  getProjectStats(projectId: string): Promise<ProjectStats>;
  debugProjectData(projectId: string): Promise<void>;
}
