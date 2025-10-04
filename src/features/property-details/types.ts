import type { Property, ExtendedPropertyDetails, StorageUnitStub, ParkingSpotStub } from '@/types/property-viewer';

export type PropertyDetailsContentProps = {
  property: ExtendedPropertyDetails & { buyerMismatch?: boolean };
  onSelectFloor: (floorId: string | null) => void;
  onUpdateProperty: (propertyId: string, updates: Partial<Property>) => void;
  isReadOnly?: boolean;
};

export type AttachmentsData = {
  storage: StorageUnitStub[];
  parking: ParkingSpotStub[];
};
