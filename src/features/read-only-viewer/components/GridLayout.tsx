'use client';

import React from 'react';
import { PropertyGrid } from '@/components/property-viewer/PropertyGrid';
import type { Property } from '@/types/property-viewer';

export function GridLayout({
  filteredProperties,
  handlePolygonSelect,
  selectedPropertyIds,
}: {
  filteredProperties: Property[];
  handlePolygonSelect: (id: string, isShiftClick: boolean) => void;
  selectedPropertyIds: string[];
}) {
  // ΕΠΙΣΤΡΕΦΕΙ ΑΚΡΙΒΩΣ ΤΟ ΙΔΙΟ MARKUP ΤΟΥ grid-branch
  return (
    <PropertyGrid
      properties={filteredProperties}
      onSelect={handlePolygonSelect}
      selectedPropertyIds={selectedPropertyIds}
      isReadOnly={true}
    />
  );
}
