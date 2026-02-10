

'use client';

import { cn } from "@/lib/utils";
import { colors } from '@/styles/design-tokens';
import type { Property } from '@/types/property-viewer';
import { STATUS_COLORS_MAPPING } from '@/subapps/dxf-viewer/config/color-mapping';
import type { PropertyStatus } from '@/constants/property-statuses-enterprise';

/** Polygon path interaction colors — SSoT: design-tokens */
const POLYGON_COLORS = {
  fallback: '#cccccc',                        // Neutral gray fallback (non-standard)
  editStroke: colors.purple['600'],           // #7c3aed — edit mode
  defaultStroke: colors.gray['800'],          // #1f2937 — selected default
  connectionFirst: colors.blue['500'],        // #3b82f6 — first connection point
  connectionHover: colors.purple['500'],      // #8b5cf6 — connection hover
} as const;

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

// 🏠 Phase 2.5: Use centralized STATUS_COLORS_MAPPING instead of hardcoded colors
// This ensures consistency across the entire application

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

  // 🏠 Phase 2.5: Use centralized color mapping for consistent status colors
  const statusMapping = STATUS_COLORS_MAPPING[property.status as PropertyStatus];
  const fillColor = statusMapping?.stroke || POLYGON_COLORS.fallback;

  let fillOpacity = opacity;
  let strokeWidth = 1;
  let strokeColor = fillColor;
  let strokeDasharray: string | undefined;

  if (isSelected) {
    fillOpacity = Math.min(1, opacity + 0.2);
    strokeWidth = 3;
    strokeColor = isNodeEditMode ? POLYGON_COLORS.editStroke : POLYGON_COLORS.defaultStroke;
  } else if (isHovered) {
    fillOpacity = Math.min(1, opacity + 0.15);
    strokeWidth = 2;
  }
  
  if(isConnecting) {
      strokeWidth = isFirstConnectionPoint ? 4 : (isHovered ? 4 : 2);
      strokeColor = isFirstConnectionPoint ? POLYGON_COLORS.connectionFirst : (isHovered ? POLYGON_COLORS.connectionHover : strokeColor);
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
