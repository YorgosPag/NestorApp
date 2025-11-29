"use client";

import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { PropertyBadge } from '@/core/badges';
import { Home, Building, MapPin, Euro, Ruler } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatFloorLabel } from "@/components/building-management/BuildingCard/BuildingCardUtils";
import type { Property } from '@/types/property-viewer';
import { PROPERTY_STATUS_CONFIG, PROPERTY_TYPE_ICONS } from '@/lib/property-utils';

interface PropertyListItemProps { 
  property: Property; 
  isSelected: boolean; 
  onSelect: (isShiftClick: boolean) => void;
}

const PropertyListItemComponent = ({ 
  property, 
  isSelected, 
  onSelect 
}: PropertyListItemProps) => {
  const statusInfo = PROPERTY_STATUS_CONFIG[property.status] || PROPERTY_STATUS_CONFIG.default;
  const IconComponent = PROPERTY_TYPE_ICONS[property.type as keyof typeof PROPERTY_TYPE_ICONS] || Home;

  return (
    <Card 
      className={cn(
        "cursor-pointer transition-all duration-200 hover:shadow-md border",
        isSelected 
          ? "ring-2 ring-primary border-primary shadow-md" 
          : "hover:border-primary/50"
      )}
      onClick={(e) => onSelect(e.shiftKey || e.metaKey)}
    >
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <IconComponent className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <h4 className="font-medium text-sm truncate">{property.name}</h4>
          </div>
          <PropertyBadge
            status={property.status as any}
            size="sm"
            className="text-xs flex-shrink-0"
          />
        </div>
        <p className="text-xs text-muted-foreground">{property.type}</p>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3" />
          <span className="truncate">{property.building}</span>
          <span>•</span>
          <span>{formatFloorLabel(property.floor)}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          {property.price ? (
            <div className="flex items-center gap-1 text-green-600">
              <Euro className="h-3 w-3" />
              <span className="font-medium">
                {property.price.toLocaleString('el-GR')}€
              </span>
            </div>
          ) : <div />}
          {property.area && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <Ruler className="h-3 w-3" />
              <span>{property.area}τμ</span>
            </div>
          )}
        </div>
        <div className="pt-1 border-t">
          <span className="text-xs text-muted-foreground">{property.project}</span>
        </div>
      </CardContent>
    </Card>
  );
}

export const PropertyListItem = React.memo(PropertyListItemComponent, (prev, next) => {
    return prev.property.id === next.property.id && prev.isSelected === next.isSelected;
});
