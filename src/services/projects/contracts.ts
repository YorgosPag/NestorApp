// 🏢 ENTERPRISE: Type definitions for Projects module
// NOTE: No 'use server' - types are shared between client and server
import type { Project, ProjectCustomer, ProjectStats, ProjectUpdatePayload } from '@/types/project';
import type { Contact } from '@/types/contacts';
import type { Building } from '@/types/building/contracts';
import type { Property } from '@/types/property-viewer';
import type { Storage } from '@/types/storage/contracts';
import type { ParkingSpot } from '@/types/parking';

/**
 * 🏢 ENTERPRISE: Property with customer info for project structure
 */
export type ProjectProperty = Property & { customerName?: string | null };

/**
 * 🏢 ENTERPRISE: Storage summary for project structure (minimal fields)
 */
export type ProjectStorage = Pick<Storage, 'id' | 'name' | 'type' | 'status' | 'area' | 'floor'>;

/**
 * 🏢 ENTERPRISE: Parking summary for project structure (minimal fields)
 */
export type ProjectParking = Pick<ParkingSpot, 'id' | 'number' | 'type' | 'status' | 'floor' | 'area'>;

/**
 * 🏢 ENTERPRISE: Building with full hierarchy (Units, Storage, Parking)
 *
 * Architecture decision (from BuildingSpacesTabs):
 * ❌ NO: Parking/Storage as "attachments" or children of Properties
 * ✅ YES: Parking/Storage/Properties as equal parallel categories in Building context
 *
 * NOTE: Using intersection type (&) instead of extends to avoid conflict with Building's index signature
 */
export type ProjectBuilding = Omit<Building, 'properties'> & {
  /** Properties in this building */
  properties: ProjectProperty[];
  /** Storage areas in this building */
  storages: ProjectStorage[];
  /** Parking spots in this building */
  parkingSpots: ProjectParking[];
};

/**
 * 🏢 ENTERPRISE: Complete project structure with hierarchical data
 *
 * Hierarchy: Project → Buildings → (Properties | Storage | Parking)
 */
export interface ProjectStructure {
  project: Project;
  buildings: ProjectBuilding[];
}
