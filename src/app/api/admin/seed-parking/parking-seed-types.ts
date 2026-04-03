import type { ParkingSpotStatus, ParkingSpotType } from '@/types/parking';

export interface ParkingTargetBuilding {
  id: string;
  name: string;
  projectId: string;
}

export interface ParkingSpotTemplate {
  number: string;
  type: ParkingSpotType;
  status: ParkingSpotStatus;
  floor: string;
  location: string;
  area: number;
  price: number;
  notes?: string;
}

export interface ExistingParkingSpotRecord extends Record<string, unknown> {
  id: string;
}

export interface CreatedParkingSpotRecord {
  id: string;
  number: string;
}

export interface ParkingPreviewRecord {
  number: string;
  previewId: string;
  buildingId: string;
  type: ParkingSpotType;
  status: ParkingSpotStatus;
}

export interface ForeignKeyMigrationChange {
  buildingId?: { from: string; to: string };
  projectId?: { from: string; to: string };
}

export interface ForeignKeyMigrationDetail {
  id: string;
  action: 'migrated' | 'skipped' | 'already_correct' | 'error';
  changes?: ForeignKeyMigrationChange;
  error?: string;
}

export interface ForeignKeyMigrationStats {
  total: number;
  migrated: number;
  skipped: number;
  alreadyCorrect: number;
  errors: number;
  details: ForeignKeyMigrationDetail[];
}
