
'use client';

import React from 'react';
import { Button } from "@/components/ui/button";
import { PropertyBadge } from "@/core/badges";
import { Eye, EyeOff, Lock, Unlock, ChevronDown, ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Property } from '@/types/property-viewer';
import type { LayerState } from '../useLayerStates';
import { PROPERTY_STATUS_CONFIG, PROPERTY_TYPE_ICONS } from "@/lib/property-utils";
import { useIconSizes } from '@/hooks/useIconSizes';

interface PropertyLayerHeaderProps {
  property: Property;
  isExpanded: boolean;
  layerState: LayerState;
  onToggleExpand: () => void;
  onSelect: (isShiftClick: boolean) => void;
  onToggleVisibility: () => void;
  onToggleLock: () => void;
}

export function PropertyLayerHeader({
  property,
  isExpanded,
  layerState,
  onToggleExpand,
  onSelect,
  onToggleVisibility,
  onToggleLock,
}: PropertyLayerHeaderProps) {
  const iconSizes = useIconSizes();
  const statusInfo = PROPERTY_STATUS_CONFIG[property.status] || PROPERTY_STATUS_CONFIG.default;
  const IconComponent = PROPERTY_TYPE_ICONS[property.type] || Home;

  return (
    <div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" className={`${iconSizes.md} p-0`} onClick={onToggleExpand}>
          {isExpanded ? <ChevronDown className={iconSizes.xs} /> : <ChevronRight className={iconSizes.xs} />}
        </Button>
        <div className="flex items-center gap-2 flex-1 cursor-pointer" onClick={(e) => onSelect(e.shiftKey)}>
          <IconComponent className={`${iconSizes.sm} text-muted-foreground`} />
          <span className="text-sm font-medium truncate">{property.name}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className={`${iconSizes.lg} p-0`} onClick={onToggleVisibility}>
            {layerState.visible ? <Eye className={iconSizes.xs} /> : <EyeOff className={`${iconSizes.xs} text-muted-foreground`} />}
          </Button>
          <Button variant="ghost" size="sm" className={`${iconSizes.lg} p-0`} onClick={onToggleLock}>
            {layerState.locked ? <Lock className={`${iconSizes.xs} text-muted-foreground`} /> : <Unlock className={iconSizes.xs} />}
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs pl-7">
        <span className="text-muted-foreground">{property.type}</span>
        <PropertyBadge
          status={property.status as any}
          variant="outline"
          className={cn("text-xs", statusInfo.color)}
        />
      </div>
    </div>
  );
}
