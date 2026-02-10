

'use client';

import type { Property } from '@/types/property-viewer';
import { PolygonMeasurementInfo } from './PolygonMeasurementInfo';
import { getCentroid } from '@/lib/geometry';
import { PropertyPolygonPath } from './PropertyPolygonPath';
import { PropertyPolygonLabels } from './PropertyPolygonLabels';
import { PropertyMultiLevelIndicator } from './PropertyMultiLevelIndicator';
import { PropertyPolygonTooltip } from './PropertyPolygonTooltip';
import { SelectionOverlay } from './SelectionOverlay';

interface PropertyPolygonProps {
  property: Property;
  isSelected: boolean;
  isHovered: boolean;
  isNodeEditMode: boolean;
  onHover: (propertyId: string | null) => void;
  onSelect: (propertyId: string, isShiftClick: boolean) => void;
  showMeasurements: boolean;
  showLabels: boolean;
  scale: number;
  visible: boolean;
  opacity: number;
  isConnecting: boolean;
  isFirstConnectionPoint: boolean;
  onNavigateLevels: (property: Property) => void;
}

export function PropertyPolygon({
  property,
  isSelected,
  isHovered,
  isNodeEditMode,
  showLabels,
  isConnecting,
  onNavigateLevels,
  showMeasurements,
  scale,
  ...pathProps
}: PropertyPolygonProps) {
  if (!pathProps.visible) return null;

  const centroid = getCentroid(property.vertices);
  const isMultiLevel = property.isMultiLevel || property.type === 'Μεζονέτα';

  return (
    <g className="property-polygon">
      <PropertyPolygonPath 
        property={property}
        isSelected={isSelected}
        isHovered={isHovered}
        isNodeEditMode={isNodeEditMode}
        isConnecting={isConnecting}
        {...pathProps}
      />
      
      {isSelected && isNodeEditMode && (
          <SelectionOverlay vertices={property.vertices} />
      )}

      {showLabels && (
        <PropertyPolygonLabels 
          name={property.name}
          type={property.type}
          centroid={centroid}
        />
      )}
      
      {isMultiLevel && (
        <PropertyMultiLevelIndicator
          property={property}
          centroid={centroid}
          onNavigateLevels={onNavigateLevels}
        />
      )}

      {isHovered && !isNodeEditMode && (
        <PropertyPolygonTooltip 
            property={property} 
            centroid={centroid} 
        />
      )}

      {showMeasurements && (
        <PolygonMeasurementInfo polygon={property} scale={scale} />
      )}
    </g>
  );
}
