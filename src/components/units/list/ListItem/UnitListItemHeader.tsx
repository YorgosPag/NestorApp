'use client';

import React from 'react';
import { Badge } from "@/components/ui/badge";
import { MapPin } from "lucide-react";
import { cn } from '@/lib/utils';
import type { Property } from '@/types/property-viewer';

interface UnitListItemHeaderProps {
  unit: Property;
  getCategoryIcon: (category: string) => React.ElementType;
  getStatusColor: (status: string) => string;
  getStatusLabel: (status: string) => string;
  getCategoryLabel: (category: string) => string;
}

export function UnitListItemHeader({ 
  unit, 
  getCategoryIcon, 
  getStatusColor, 
  getStatusLabel, 
  getCategoryLabel 
}: UnitListItemHeaderProps) {
  const CategoryIcon = getCategoryIcon(unit.type);

  return (
    <div className="mb-3">
      <div className="flex items-start gap-2 mb-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="flex-shrink-0">
            <CategoryIcon className="w-4 h-4 text-muted-foreground" />
          </div>
          <h4 className="font-medium text-sm text-foreground leading-tight line-clamp-2">
            {unit.name}
          </h4>
        </div>
      </div>
      
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <Badge 
          variant="secondary" 
          className={cn("text-xs text-white border-0", getStatusColor(unit.status))}
        >
          {getStatusLabel(unit.status)}
        </Badge>
        <Badge variant="outline" className="text-xs">
          {getCategoryLabel(unit.type)}
        </Badge>
      </div>

      {unit.building && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
          <MapPin className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">{unit.building} - Όροφος {unit.floor}</span>
        </div>
      )}
    </div>
  );
}