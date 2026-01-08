'use client';

import React from 'react';
import { PropertyBadge } from '@/core/badges';
import { CommonBadge } from '@/core/badges';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Home, MapPin, Euro, Ruler, Edit3, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIconSizes } from '@/hooks/useIconSizes';
// 🏢 ENTERPRISE: Centralized entity icons/colors (ZERO hardcoded values)
import { NAVIGATION_ENTITIES } from '@/components/navigation/config/navigation-entities';
import type { ExtendedPropertyDetails, Property } from '@/types/property-viewer';
import { PROPERTY_STATUS_CONFIG } from '@/lib/property-utils';
import { formatFloorLabel, formatCurrency } from '@/lib/intl-utils';

interface PropertyMetaProps {
  property: ExtendedPropertyDetails;
  onUpdateProperty: (propertyId: string, updates: Partial<Property>) => void;
}

export function PropertyMeta({ property, onUpdateProperty }: PropertyMetaProps) {
  const iconSizes = useIconSizes();
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
          <PropertyBadge
            status={property.status as any}
            variant="outline"
            size="sm"
            className="text-xs flex-shrink-0"
          />
        </div>
        <p className="text-xs text-muted-foreground">{property.type}</p>
      </div>

      <Separator />

      {/* Location */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs">
          {/* 🏢 ENTERPRISE: Using centralized building icon/color */}
          <NAVIGATION_ENTITIES.building.icon className={cn(iconSizes.xs, NAVIGATION_ENTITIES.building.color)} />
          <span>{property.building}</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <MapPin className={`${iconSizes.xs} text-muted-foreground`} />
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
            <Euro className={`${iconSizes.sm} text-green-600`} />
            <span className="font-semibold text-green-600">
              {formatCurrency(property.price)}
            </span>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2 text-xs">
          {property.area && (
            <div className="flex items-center gap-1">
              <Ruler className={`${iconSizes.xs} text-muted-foreground`} />
              <span>{property.area}τμ</span>
            </div>
          )}
          {property.rooms && (
            <div className="flex items-center gap-1">
              <Home className={`${iconSizes.xs} text-muted-foreground`} />
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
                <CommonBadge
                  key={index}
                  status="property"
                  customLabel={feature}
                  variant="secondary"
                  className="text-xs"
                />
              ))}
            </div>
          </div>
        </>
      )}

      {/* Actions */}
      <Separator />
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1">
          <Eye className={`${iconSizes.xs} mr-1`} />
          Προβολή
        </Button>
        <Button variant="outline" size="sm" className="flex-1" onClick={handleEditClick}>
          <Edit3 className={`${iconSizes.xs} mr-1`} />
          Επεξ.
        </Button>
      </div>
    </div>
  );
}
