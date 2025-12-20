
import { PropertyStatus } from '@/constants/property-statuses-enterprise';

// Use centralized PropertyStatus with additional 'rented' status for units
export type UnitStatus = PropertyStatus | 'rented';
export type UnitType = 'Στούντιο' | 'Γκαρσονιέρα' | 'Διαμέρισμα 2Δ' | 'Διαμέρισμα 3Δ' | 'Μεζονέτα' | 'Κατάστημα' | 'Αποθήκη';

export interface Unit {
  id: string;
  name: string;
  type: UnitType;
  building: string;
  floor: number;
  status: UnitStatus;
  price?: number;
  area?: number;
  project: string;
  description?: string;
  buildingId: string;
  floorId: string;
  soldTo?: string | null; // ID of the contact
  saleDate?: string;
}

export type UnitSortKey = 'name' | 'price' | 'area';
