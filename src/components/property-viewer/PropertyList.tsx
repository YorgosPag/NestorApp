
"use client";

import { useEffect, useRef } from 'react';
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
  /** Hovered property ID — bidirectional sync (SPEC-237C) */
  hoveredPropertyId?: string | null;
  /** Hover callback — bidirectional sync (SPEC-237C) */
  onHoverProperty?: (propertyId: string | null) => void;
}

export function PropertyList({
  properties,
  selectedPropertyIds,
  onSelectProperty,
  isLoading,
  hoveredPropertyId,
  onHoverProperty,
}: PropertyListProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // SPEC-237C: Auto-scroll to hovered card (canvas → list sync)
  useEffect(() => {
    if (!hoveredPropertyId || !scrollContainerRef.current) return;
    const el = scrollContainerRef.current.querySelector(`[data-property-id="${hoveredPropertyId}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [hoveredPropertyId]);

  if (isLoading) {
    return <PropertyListSkeleton />;
  }

  if (properties.length === 0) {
    return <PropertyListEmptyState />;
  }

  const safeSelectedPropertyIds = Array.isArray(selectedPropertyIds) ? selectedPropertyIds : [];

  return (
    <div className="p-2" ref={scrollContainerRef}>
      <div className="space-y-2">
        {properties.map((property) => (
          <div key={property.id} data-property-id={property.id}>
            <PropertyListCard
              property={property}
              isSelected={safeSelectedPropertyIds.includes(property.id)}
              isHovered={property.id === hoveredPropertyId}
              onSelect={(isShiftClick) => onSelectProperty(property.id, isShiftClick ?? false)}
              onMouseEnter={() => onHoverProperty?.(property.id)}
              onMouseLeave={() => onHoverProperty?.(null)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
