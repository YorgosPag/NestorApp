'use client';
import * as React from 'react';
import type { Property } from '@/types/property-viewer';

export function useHoveredProperty(propertyId: string | null, properties: Property[]) {
  return React.useMemo(() => {
    if (!propertyId) return null;
    return properties.find(p => p.id === propertyId) || null;
  }, [propertyId, properties]);
}
