'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Home, Building, MapPin, Euro, Ruler, Edit3, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ExtendedPropertyDetails, Property } from '@/types/property-viewer';
import { PROPERTY_STATUS_CONFIG } from '@/lib/property-utils';
import { formatFloorLabel } from '@/components/building-management/BuildingCard/BuildingCardUtils';

interface PropertyMetaProps {
  property: ExtendedPropertyDetails;
  onUpdateProperty: (propertyId: string, updates: Partial<Property>) => void;
}

export function PropertyMeta({ property, onUpdateProperty }: PropertyMetaProps) {
  const statusInfo = PROPERTY_STATUS_CONFIG[property.status] || PROPERTY_STATUS_CONFIG.default;

  const handleEditClick = () => {
    const newName = prompt("Εισάγετε νέο όνομα για το ακίνητο:", property.name);
    if (newName && newName !== property.name) {
      onUpdateProperty(property.id, { name: newName });
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-sm leading-tight">{property.name}</h3>
          <Badge 
            variant="outline" 
            className={cn("text-xs flex-shrink-0", statusInfo.color)}
          >
            {statusInfo.label}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">{property.type}</p>
      </div>

      <Separator />

      {/* Location */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs">
          <Building className="h-3 w-3 text-muted-foreground" />
          <span>{property.building}</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <MapPin className="h-3 w-3 text-muted-foreground" />
          <span>{formatFloorLabel(property.floor)}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{property.project}</span>
        </div>
      </div>

      <Separator />

      {/* Price & Specs */}
      <div className="space-y-2">
        {property.price && (
          <div className="flex items-center gap-2 text-sm">
            <Euro className="h-4 w-4 text-green-600" />
            <span className="font-semibold text-green-600">
              {property.price.toLocaleString('el-GR')}€
            </span>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2 text-xs">
          {property.area && (
            <div className="flex items-center gap-1">
              <Ruler className="h-3 w-3 text-muted-foreground" />
              <span>{property.area}τμ</span>
            </div>
          )}
          {property.rooms && (
            <div className="flex items-center gap-1">
              <Home className="h-3 w-3 text-muted-foreground" />
              <span>{property.rooms} δωμ.</span>
            </div>
          )}
        </div>
      </div>

      {/* Description */}
      {property.description && (
        <>
          <Separator />
          <div className="space-y-1">
            <h4 className="text-xs font-medium">Περιγραφή</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {property.description}
            </p>
          </div>
        </>
      )}

      {/* Features */}
      {property.features && property.features.length > 0 && (
        <>
          <Separator />
          <div className="space-y-2">
            <h4 className="text-xs font-medium">Χαρακτηριστικά</h4>
            <div className="flex flex-wrap gap-1">
              {property.features.map((feature, index) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  {feature}
                </Badge>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Actions */}
      <Separator />
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1">
          <Eye className="h-3 w-3 mr-1" />
          Προβολή
        </Button>
        <Button variant="outline" size="sm" className="flex-1" onClick={handleEditClick}>
          <Edit3 className="h-3 w-3 mr-1" />
          Επεξ.
        </Button>
      </div>
    </div>
  );
}
