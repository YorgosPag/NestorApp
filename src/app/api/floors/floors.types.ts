import type { ConflictResponseBody } from '@/types/versioning';

export interface FloorDocument {
  id: string;
  number: number;
  name?: string;
  buildingId: string;
  projectId?: string;
  companyId?: string;
  [key: string]: unknown;
}

export type FloorsListSuccess = {
  success: true;
  floors: FloorDocument[];
  floorsByBuilding?: Record<string, FloorDocument[]>;
  stats: {
    totalFloors: number;
    buildingId?: string;
    projectId?: string;
    buildingsWithFloors?: number;
  };
  message?: string;
};

export type FloorsListError = {
  success: false;
  error: string;
  details?: string;
};

export type FloorsListResponse = FloorsListSuccess | FloorsListError;

export interface FloorCreateResponse {
  floorId: string;
}

export type FloorUpdateResponse =
  | { success: true; message: string; _v?: number }
  | { success: false; error: string; details?: string }
  | ConflictResponseBody;

export type FloorDeleteResponse =
  | { success: true; message: string }
  | { success: false; error: string; details?: string };
