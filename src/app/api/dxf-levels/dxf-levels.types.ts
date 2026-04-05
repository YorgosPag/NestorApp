import type { ConflictResponseBody } from '@/types/versioning';

export interface DxfLevelDocument {
  id: string;
  name: string;
  order: number;
  isDefault: boolean;
  visible: boolean;
  floorId?: string | null;
  sceneFileId?: string | null;
  sceneFileName?: string | null;
  companyId?: string;
  createdBy?: string;
  [key: string]: unknown;
}

export type DxfLevelsListSuccess = {
  success: true;
  levels: DxfLevelDocument[];
  stats: {
    totalLevels: number;
    floorId?: string;
  };
  message?: string;
};

export type DxfLevelsListError = {
  success: false;
  error: string;
  details?: string;
};

export type DxfLevelsListResponse = DxfLevelsListSuccess | DxfLevelsListError;

export interface DxfLevelCreateResponse {
  levelId: string;
}

export type DxfLevelUpdateResponse =
  | { success: true; message: string; _v?: number }
  | { success: false; error: string; details?: string }
  | ConflictResponseBody;

export type DxfLevelDeleteResponse =
  | { success: true; message: string }
  | { success: false; error: string; details?: string };
