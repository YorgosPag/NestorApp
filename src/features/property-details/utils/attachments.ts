'use client';

import type { ExtendedPropertyDetails, StorageUnitStub, ParkingSpotStub } from '@/types/property-viewer';

// Mock data παραμένει εδώ για να μην μολύνει το component
const mockStorage: StorageUnitStub[] = [
  { id: 'storage-1', code: 'A-01', area: 12, floor: 'Υπόγειο' },
  { id: 'storage-2', code: 'A-02', area: 15, floor: 'Υπόγειο' },
];

const mockParking: ParkingSpotStub[] = [
  { id: 'parking-1', code: 'P-05', type: 'open', level: 'Ισόγειο' },
];

export function resolveAttachments(property: ExtendedPropertyDetails) {
  const attachedStorage = property.attachments?.storageRooms
    ?.map((id) => mockStorage.find((s) => s.id === id))
    .filter(Boolean) as StorageUnitStub[] | undefined;

  const attachedParking = property.attachments?.parkingSpots
    ?.map((id) => mockParking.find((p) => p.id === id))
    .filter(Boolean) as ParkingSpotStub[] | undefined;

  return {
    storage: attachedStorage ?? [],
    parking: attachedParking ?? [],
  };
}
