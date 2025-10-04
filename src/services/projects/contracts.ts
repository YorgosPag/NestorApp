'use server';
import type { Project, ProjectCustomer, ProjectStats } from '@/types/project';
import type { Contact } from '@/types/contacts';
import type { Building } from '@/components/building-management/mockData';
import type { Property } from '@/types/property-viewer';

export interface ProjectStructure {
  project: Project;
  buildings: Array<Building & { units: Array<Property & { customerName?: string | null }> }>;
}

export interface IProjectsRepository {
  getProjectsByCompanyId(companyId: string): Promise<Project[]>;
  getProjectById(projectId: number): Promise<Project | null>;
  getBuildingsByProjectId(projectId: number): Promise<Building[]>;
  getUnitsByBuildingId(buildingId: string): Promise<Property[]>;
  getContactsByIds(ids: string[]): Promise<Contact[]>;
}

export interface IProjectsService {
  getProjectsByCompanyId(companyId: string): Promise<Project[]>;
  getProjectStructure(projectId: number): Promise<ProjectStructure | null>;
  getProjectCustomers(projectId: number): Promise<ProjectCustomer[]>;
  getProjectStats(projectId: number): Promise<ProjectStats>;
  debugProjectData(projectId: number): Promise<void>;
}
