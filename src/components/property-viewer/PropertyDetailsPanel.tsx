'use client';

import React from 'react';
import { Layers, Home } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Property } from '@/types/property-viewer';
import { PropertyDetailsContent } from './details/PropertyDetailsContent';
import type { ExtendedPropertyDetails } from '@/types/property-viewer';

interface PropertyDetailsPanelProps {
  propertyIds: string[];
  onSelectFloor: (floorId: string | null) => void;
  properties: Property[];
  onUpdateProperty: (propertyId: string, updates: Partial<Property>) => void;
  isReadOnly?: boolean; // NEW: Read-only mode prop
}

export function PropertyDetailsPanel({
  propertyIds,
  onSelectFloor,
  properties,
  onUpdateProperty,
  isReadOnly = false // NEW: Default to false
}: PropertyDetailsPanelProps) {
  const iconSizes = useIconSizes();
  // Safe check για το propertyIds - εξασφαλίζουμε ότι είναι array
  const safePropertyIds = Array.isArray(propertyIds) ? propertyIds : [];
  const safeProperties = Array.isArray(properties) ? properties : [];
  
  // Safe functions με fallbacks - disable updates in read-only mode
  const safeOnSelectFloor = onSelectFloor || (() => {});
  const safeOnUpdateProperty = isReadOnly ? (() => {}) : (onUpdateProperty || (() => {}));

  if (safePropertyIds.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
        <Home className={`${iconSizes.xl} mb-2`} />
        <p className="text-sm text-center">Επιλέξτε ένα ακίνητο</p>
        <p className="text-xs text-center">για να δείτε τα στοιχεία του</p>
      </div>
    );
  }

  if (safePropertyIds.length > 1) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
        <Layers className={`${iconSizes.xl} mb-2`} />
        <p className="text-sm font-medium text-center">{safePropertyIds.length} ακίνητα επιλέχθηκαν</p>
        <p className="text-xs text-center mt-2">Επιλέξτε ένα μόνο ακίνητο για να δείτε τις λεπτομέρειες.</p>
      </div>
    );
  }

  const propertyId = safePropertyIds[0];
  const property = safeProperties.find(p => p && p.id === propertyId);
  
  if (!property) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
        <Home className={`${iconSizes.xl} mb-2`} />
        <p className="text-sm text-center">Δεν βρέθηκαν στοιχεία</p>
        <p className="text-xs text-center">για το επιλεγμένο ακίνητο</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <PropertyDetailsContent 
        property={property as ExtendedPropertyDetails} 
        onSelectFloor={safeOnSelectFloor} 
        onUpdateProperty={safeOnUpdateProperty}
        isReadOnly={isReadOnly} // NEW: Pass read-only state
      />
    </ScrollArea>
  );
}