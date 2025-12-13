'use server';
import type { Project, ProjectCustomer, ProjectStats } from '@/types/project';
import type { Contact } from '@/types/contacts';
import type { Building } from '@/types/building/contracts';
import type { Property } from '@/types/property-viewer';

export interface ProjectStructure {
  project: Project;
  buildings: Array<Building & { units: Array<Property & { customerName?: string | null }> }>;
}

export interface IProjectsRepository {
  getProjectsByCompanyId(companyId: string): Promise<Project[]>;
  getProjectById(projectId: string): Promise<Project | null>;
  getBuildingsByProjectId(projectId: string): Promise<Building[]>;
  getUnitsByBuildingId(buildingId: string): Promise<Property[]>;
  getContactsByIds(ids: string[]): Promise<Contact[]>;
}

export interface IProjectsService {
  getProjectsByCompanyId(companyId: string): Promise<Project[]>;
  getProjectStructure(projectId: string): Promise<ProjectStructure | null>;
  getProjectCustomers(projectId: string): Promise<ProjectCustomer[]>;
  getProjectStats(projectId: string): Promise<ProjectStats>;
  debugProjectData(projectId: string): Promise<void>;
}
