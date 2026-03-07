/**
 * @deprecated Mock parking data — will be replaced by Firestore queries.
 * ADR-191: Updated to canonical ParkingSpot interface.
 */
import type { ParkingSpot } from '@/types/parking';

export const parkingSpots: ParkingSpot[] = [
  {
    id: '1',
    number: 'G_S5.2',
    type: 'standard',
    floor: 'Ισόγειο',
    area: 13.2,
    price: 0,
    status: 'sold',
    locationZone: 'open_space',
  },
  {
    id: '2',
    number: 'B_S5.7',
    type: 'standard',
    floor: 'Ισόγειο',
    area: 12.5,
    price: 0,
    status: 'sold',
    locationZone: 'open_space',
  },
  {
    id: '3',
    number: 'A_P1.1',
    type: 'standard',
    floor: 'Υπόγειο 1',
    area: 11.5,
    price: 12000,
    status: 'available',
    locationZone: 'underground',
  },
  {
    id: '4',
    number: 'A_P2.2',
    type: 'standard',
    floor: 'Υπόγειο 1',
    area: 14.0,
    price: 15000,
    status: 'reserved',
    locationZone: 'underground',
  },
  {
    id: '5',
    number: 'C_P1',
    type: 'standard',
    floor: 'Ισόγειο',
    area: 15.0,
    price: 8000,
    status: 'available',
    locationZone: 'covered_outdoor',
  },
  {
    id: '6',
    number: 'G_P2',
    type: 'standard',
    floor: 'Ισόγειο',
    area: 12,
    price: 5000,
    status: 'available',
    locationZone: 'open_space',
  },
];
