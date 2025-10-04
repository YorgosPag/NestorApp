'use client';

import React from 'react';
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Property } from '@/types/property-viewer';
import type { LayerState } from '../useLayerStates';
import { PropertyLayerItem } from '../PropertyLayerItem';
import { EmptyLayerMessage } from './EmptyLayerMessage';

interface LayerListProps {
  properties: Property[];
  selectedPolygonIds: string[];
  layerStates: Record<string, LayerState>;
  searchQuery: string;
  onPolygonSelect: (polygonId: string, isShiftClick: boolean) => void;
  onToggleVisibility: (propertyId: string) => void;
  onToggleLock: (propertyId: string) => void;
  onOpacityChange: (propertyId: string, opacity: number) => void;
  onDuplicate: (propertyId: string) => void;
  onDelete: (propertyId: string) => void;
}

export function LayerList({
  properties,
  selectedPolygonIds,
  layerStates,
  searchQuery,
  onPolygonSelect,
  onToggleVisibility,
  onToggleLock,
  onOpacityChange,
  onDuplicate,
  onDelete,
}: LayerListProps) {
  
  const handleEdit = (propertyId: string) => {
    onPolygonSelect(propertyId, false);
    // Additional edit logic can be triggered here if needed
  };
    
  if (properties.length === 0) {
    return <EmptyLayerMessage searchQuery={searchQuery} />;
  }

  return (
    <ScrollArea className="flex-1">
      <div className="p-4 space-y-2">
        {properties.map((property) => (
          <PropertyLayerItem
            key={property.id}
            property={property}
            isSelected={selectedPolygonIds.includes(property.id)}
            layerState={layerStates[property.id] || { visible: true, locked: false, opacity: 0.7 }}
            onSelect={(isShiftClick) => onPolygonSelect(property.id, isShiftClick)}
            onToggleVisibility={() => onToggleVisibility(property.id)}
            onToggleLock={() => onToggleLock(property.id)}
            onOpacityChange={(opacity) => onOpacityChange(property.id, opacity)}
            onEdit={() => handleEdit(property.id)}
            onDelete={() => onDelete(property.id)}
            onDuplicate={() => onDuplicate(property.id)}
          />
        ))}
      </div>
    </ScrollArea>
  );
}
