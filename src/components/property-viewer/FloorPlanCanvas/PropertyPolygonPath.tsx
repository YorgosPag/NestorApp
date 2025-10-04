

'use client';

import { cn } from "@/lib/utils";
import type { Property } from '@/types/property-viewer';

interface PropertyPolygonPathProps {
  property: Property;
  isSelected: boolean;
  isHovered: boolean;
  isNodeEditMode: boolean;
  onHover: (propertyId: string | null) => void;
  onSelect: (propertyId: string, isShiftClick: boolean) => void;
  opacity: number;
  isConnecting: boolean;
  isFirstConnectionPoint: boolean;
}

const statusColors = {
  'for-sale': '#10b981',
  'for-rent': '#3b82f6',
  'sold': '#ef4444',
  'rented': '#f97316',
  'reserved': '#eab308',
};

export function PropertyPolygonPath({
  property,
  isSelected,
  isHovered,
  isNodeEditMode,
  onHover,
  onSelect,
  opacity,
  isConnecting,
  isFirstConnectionPoint
}: PropertyPolygonPathProps) {
  const pathData = property.vertices
    .map((vertex, index) => `${index === 0 ? 'M' : 'L'} ${vertex.x} ${vertex.y}`)
    .join(' ') + ' Z';

  const fillColor = statusColors[property.status as keyof typeof statusColors] || '#cccccc';

  let fillOpacity = opacity;
  let strokeWidth = 1;
  let strokeColor = fillColor;
  let strokeDasharray: string | undefined;

  if (isSelected) {
    fillOpacity = Math.min(1, opacity + 0.2);
    strokeWidth = 3;
    strokeColor = isNodeEditMode ? '#7c3aed' : '#1f2937';
  } else if (isHovered) {
    fillOpacity = Math.min(1, opacity + 0.15);
    strokeWidth = 2;
  }
  
  if(isConnecting) {
      strokeWidth = isFirstConnectionPoint ? 4 : (isHovered ? 4 : 2);
      strokeColor = isFirstConnectionPoint ? '#3B82F6' : (isHovered ? '#8B5CF6' : strokeColor);
      strokeDasharray = isFirstConnectionPoint ? "none" : (isHovered ? "4 4" : "none");
  } else {
      strokeDasharray = isNodeEditMode && isSelected ? "5,5" : "none";
  }

  return (
    <path
      d={pathData}
      fill={fillColor}
      fillOpacity={fillOpacity}
      stroke={strokeColor}
      strokeWidth={strokeWidth}
      strokeDasharray={strokeDasharray}
      className={cn("cursor-pointer transition-all duration-200", { "cursor-crosshair": isConnecting })}
      onMouseEnter={() => onHover(property.id)}
      onMouseLeave={() => onHover(null)}
      onClick={(e) => onSelect(property.id, e.shiftKey)}
    />
  );
}
