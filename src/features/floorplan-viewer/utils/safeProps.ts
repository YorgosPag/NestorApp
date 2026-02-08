// Safe props utilities με null protection

import type { FloorData } from '../types';
import type { Property } from '@/types/property-viewer';

interface SafeFloor {
  id: string;
  name: string;
  properties: Property[];
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
    ...floor,
    id: floor.id || 'default',
    name: floor.name || 'Floor',
    properties: Array.isArray(floor.properties) ? floor.properties : [],
    metadata: floor.metadata || {},
    floorPlanUrl: floor.floorPlanUrl || null
  };
}

export function isNodeEditMode(mode: string): boolean {
  return mode === 'edit' || mode === 'create';
}

export function safeGetProperty(properties: Property[], id: string | null | undefined): Property | null {
  if (!id || !Array.isArray(properties)) {
    return null;
  }
  return properties.find(p => p && p.id === id) || null;
}

export function safeUpdateProperties(
  properties: Property[],
  id: string,
  updates: Partial<Property>
): Property[] {
  if (!Array.isArray(properties)) {
    return [];
  }
  return properties.map(p =>
    (p && p.id === id) ? { ...p, ...updates } : p
  ).filter((p): p is Property => Boolean(p));
}
