
export type ConnectionType = 'sameBuilding' | 'sameFloor' | 'related' | 'parking';

export interface Connection {
  id: string;
  from: string; // propertyId
  to: string;   // propertyId
  type: ConnectionType;
}

export interface PropertyGroup {
    id: string;
    name: string;
    propertyIds: string[];
    color: string;
}
