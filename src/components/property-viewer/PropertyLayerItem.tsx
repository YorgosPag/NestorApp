
'use client';

import React, { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import type { Property } from '@/types/property-viewer';
import type { LayerState } from './useLayerStates';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { PropertyLayerHeader } from './PropertyLayerItem/PropertyLayerHeader';
import { PropertyLayerDetails } from './PropertyLayerItem/PropertyLayerDetails';


interface PropertyLayerItemProps {
  property: Property;
  isSelected: boolean;
  layerState: LayerState;
  onSelect: (isShiftClick: boolean) => void;
  onToggleVisibility: () => void;
  onToggleLock: () => void;
  onOpacityChange: (opacity: number) => void;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

export function PropertyLayerItem({
  property,
  isSelected,
  layerState,
  onSelect,
  onToggleVisibility,
  onToggleLock,
  onOpacityChange,
  onEdit,
  onDelete,
  onDuplicate
}: PropertyLayerItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  useEffect(() => {
    setIsExpanded(isSelected);
  }, [isSelected]);

  return (
    <div className={cn(
      `${useBorderTokens().quick.card} p-3 space-y-2 transition-all`,
      isSelected ? "border-primary/50 bg-primary/10" : "border-border"
    )}>
      <PropertyLayerHeader
        property={property}
        isExpanded={isExpanded}
        layerState={layerState}
        onToggleExpand={() => setIsExpanded(!isExpanded)}
        onSelect={onSelect}
        onToggleVisibility={onToggleVisibility}
        onToggleLock={onToggleLock}
      />
      
      {isExpanded && (
        <PropertyLayerDetails
          property={property}
          layerState={layerState}
          onOpacityChange={onOpacityChange}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
        />
      )}
    </div>
  );
}
