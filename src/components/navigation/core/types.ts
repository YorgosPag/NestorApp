/**
 * Core types for the centralized Navigation System
 * Extracted from DXF Viewer for reusability across the application
 */

export interface NavigationCompany {
  id: string;
  companyName: string;
  industry?: string;
  vatNumber?: string;
}

export interface NavigationProject {
  id: string;
  name: string;
  company: string;
  companyId?: string; // The ID of the company that owns this project
  buildings: NavigationBuilding[];
  parkingSpots?: NavigationParkingSpot[];
}

export interface NavigationBuilding {
  id: string;
  name: string;
  floors: NavigationFloor[];
  storageAreas?: NavigationUnit[];
}

export interface NavigationFloor {
  id: string;
  number: number;
  name: string;
  units: NavigationUnit[];
}

export interface NavigationUnit {
  id: string;
  name: string;
  type: 'studio' | 'apartment' | 'maisonette' | 'commercial';
  floor: number;
  area: number;
  status: 'owner' | 'sold' | 'forRent' | 'forSale' | 'reserved';
}

export interface NavigationParkingSpot {
  id: string;
  number: string;
  type: 'standard' | 'disabled' | 'electric';
  status: 'owner' | 'sold' | 'forRent' | 'forSale' | 'reserved';
  location: 'ground' | 'basement' | 'pilotis';
}

export interface NavigationState {
  companies: NavigationCompany[];
  selectedCompany: NavigationCompany | null;
  projects: NavigationProject[];
  selectedProject: NavigationProject | null;
  selectedBuilding: NavigationBuilding | null;
  selectedFloor: NavigationFloor | null;
  currentLevel: NavigationLevel;
  loading: boolean;
  projectsLoading: boolean;
  error: string | null;
}

export type NavigationLevel = 'companies' | 'projects' | 'buildings' | 'floors' | 'units';

export interface NavigationActions {
  loadCompanies: () => Promise<void>;
  selectCompany: (companyId: string) => void;
  loadProjectsForCompany: (companyId: string) => Promise<void>;
  selectProject: (projectId: string) => void;
  selectBuilding: (buildingId: string) => void;
  selectFloor: (floorId: string) => void;
  navigateToLevel: (level: NavigationLevel) => void;
  reset: () => void;
  navigateToExistingPages: (type: 'properties' | 'projects' | 'buildings' | 'floorplan', filters?: any) => void;
}

export interface NavigationOption {
  id: string;
  label: string;
  type: 'company' | 'project' | 'building' | 'floor' | 'unit' | 'storage' | 'parking';
  icon: string;
  subtitle?: string;
  extraInfo?: string;
  parentId?: string;
  metadata?: {
    floorNumber?: number;
    category?: 'parking' | 'storage' | 'general';
  };
}

export interface BreadcrumbItem {
  id: string;
  label: string;
  icon: string;
  level: NavigationLevel;
  onClick: () => void;
}