import type { ProjectAddress } from '@/types/project/addresses';

export interface BuildingAddressesCardProps {
  buildingId: string;
  projectId?: string;
  addresses?: ProjectAddress[];
  legacyAddress?: string;
  legacyCity?: string;
}

export type BuildingAddressEditorMode = 'create' | 'edit';
