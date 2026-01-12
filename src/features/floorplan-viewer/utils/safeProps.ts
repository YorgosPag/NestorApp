// Safe props utilities με null protection

// 🏢 ENTERPRISE: Proper types for floor data
interface FloorData {
  id?: string;
  name?: string;
  properties?: PropertyItem[];
  metadata?: Record<string, unknown>;
  floorPlanUrl?: string | null;
  [key: string]: unknown;
}

interface PropertyItem {
  id: string;
  [key: string]: unknown;
}

interface SafeFloor {
  id: string;
  name: string;
  properties: PropertyItem[];
  metadata: Record<string, unknown>;
  floorPlanUrl: string | null;
  [key: string]: unknown;
}

export function asArray<T>(value: T[] | T | null | undefined): T[] {
  if (Array.isArray(value)) {
    return value;
  }
  if (value === null || value === undefined) {
    return [];
  }
  return [value];
}

export function ensureFloor(floor: FloorData | null | undefined): SafeFloor {
  if (!floor) {
    return {
      id: 'default',
      name: 'Default Floor',
      properties: [],
      metadata: {},
      floorPlanUrl: null
    };
  }

  return {
    id: floor.id || 'default',
    name: floor.name || 'Floor',
    properties: Array.isArray(floor.properties) ? floor.properties : [],
    metadata: floor.metadata || {},
    floorPlanUrl: floor.floorPlanUrl || null,
    ...floor
  };
}

export function isNodeEditMode(mode: string): boolean {
  return mode === 'edit' || mode === 'create';
}

export function safeGetProperty(properties: PropertyItem[], id: string | null): PropertyItem | null {
  if (!id || !Array.isArray(properties)) {
    return null;
  }
  return properties.find(p => p && p.id === id) || null;
}

export function safeUpdateProperties(
  properties: PropertyItem[],
  id: string,
  updates: Partial<PropertyItem>
): PropertyItem[] {
  if (!Array.isArray(properties)) {
    return [];
  }
  return properties.map(p =>
    (p && p.id === id) ? { ...p, ...updates } : p
  ).filter((p): p is PropertyItem => Boolean(p));
}
