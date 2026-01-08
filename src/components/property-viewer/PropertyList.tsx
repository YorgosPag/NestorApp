
"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import type { Property } from '@/types/property-viewer';
// 🏢 ENTERPRISE: Using centralized domain card
import { PropertyListCard } from '@/domain';
import { PropertyListSkeleton } from "./list/PropertyListSkeleton";
import { PropertyListEmptyState } from "./list/PropertyListEmptyState";

interface PropertyListProps {
  properties: Property[];
  selectedPropertyIds: string[];
  onSelectProperty: (propertyId: string, isShiftClick: boolean) => void;
  isLoading: boolean;
}

export function PropertyList({ 
  properties, 
  selectedPropertyIds, 
  onSelectProperty, 
  isLoading 
}: PropertyListProps) {
  if (isLoading) {
    return <PropertyListSkeleton />;
  }

  if (properties.length === 0) {
    return <PropertyListEmptyState />;
  }

  const safeSelectedPropertyIds = Array.isArray(selectedPropertyIds) ? selectedPropertyIds : [];

  return (
    <div className="p-2">
      <div className="space-y-2">
        {properties.map((property) => (
          <PropertyListCard
            key={property.id}
            property={property}
            isSelected={safeSelectedPropertyIds.includes(property.id)}
            onSelect={(isShiftClick) => onSelectProperty(property.id, isShiftClick ?? false)}
          />
        ))}
      </div>
    </div>
  );
}
