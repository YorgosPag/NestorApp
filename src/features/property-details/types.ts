import type { Property, ExtendedPropertyDetails, StorageUnitStub, ParkingSpotStub } from '@/types/property-viewer';

export type PropertyDetailsContentProps = {
  property: ExtendedPropertyDetails & { buyerMismatch?: boolean };
  onSelectFloor: (floorId: string | null) => void;
  onUpdateProperty: (propertyId: string, updates: Partial<Property>) => void;
  isReadOnly?: boolean;
  /** Edit mode state from parent (UnitsSidebar) — Pattern A */
  isEditMode?: boolean;
  onToggleEditMode?: () => void;
  onExitEditMode?: () => void;
  /** Inline new unit creation */
  isCreatingNewUnit?: boolean;
  onPropertyCreated?: (propertyId: string) => void;
};

export type AttachmentsData = {
  storage: StorageUnitStub[];
  parking: ParkingSpotStub[];
};
