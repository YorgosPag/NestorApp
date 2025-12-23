'use client';

import { TooltipProvider } from '@/components/ui/tooltip';
import { Home, MousePointer } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { useIconSizes } from '@/hooks/useIconSizes';
import { statusConfig } from '@/features/property-hover/constants';
import { PropertyHoverHeader } from '@/features/property-hover/components/PropertyHoverHeader';
import { PropertyHoverLocation } from '@/features/property-hover/components/PropertyHoverLocation';
import { PropertyHoverPriceArea } from '@/features/property-hover/components/PropertyHoverPriceArea';
import { PropertyHoverDescription } from '@/features/property-hover/components/PropertyHoverDescription';
import { PropertyHoverInstruction } from '@/features/property-hover/components/PropertyHoverInstruction';

import { formatFloorLabel } from '@/lib/intl-utils';
import { formatPricePerSqm } from '@/components/building-management/BuildingCard/BuildingCardUtils';
import type { Property } from '@/types/property-viewer';
import { useHoveredProperty } from '@/features/property-hover/hooks/useHoveredProperty';

interface PropertyHoverInfoProps {
  propertyId: string | null;
  properties: Property[];
}

function PropertyHoverContent({ property }: { property: Property }) {
  const statusInfo = statusConfig[property.status as keyof typeof statusConfig] || statusConfig['Άγνωστο'];

  return (
    <div className="space-y-3 p-1 animate-fade-in">
      <PropertyHoverHeader
        name={property.name}
        type={property.type}
        building={property.building}
        statusLabel={statusInfo.label}
        statusColor={statusInfo.color}
      />

      <Separator />

      <PropertyHoverLocation floorLabel={formatFloorLabel(property.floor)} />

      {(property.price || property.area) && (
        <>
          <Separator />
          <PropertyHoverPriceArea
            hasPrice={property.price !== undefined}
            price={property.price}
            priceLabel={statusInfo.priceLabel}
            isRentLike={property.status === 'for-rent' || property.status === 'rented'}
            hasArea={!!property.area}
            area={property.area}
            pricePerSqm={property.price && property.area ? formatPricePerSqm(property.price, property.area) : undefined}
          />
        </>
      )}

      {property.description && (
        <>
          <Separator />
          <PropertyHoverDescription text={property.description} />
        </>
      )}

      <Separator />
      <PropertyHoverInstruction />
    </div>
  );
}

export function PropertyHoverInfo({ propertyId, properties }: PropertyHoverInfoProps) {
  const iconSizes = useIconSizes();
  const property = useHoveredProperty(propertyId, properties);

  if (!propertyId) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
        <MousePointer className={`${iconSizes.md} mb-2`} />
        <p className="text-xs text-center">Περάστε το ποντίκι</p>
        <p className="text-xs text-center">πάνω από ένα ακίνητο</p>
        <p className="text-xs text-center mt-1 text-muted-foreground/70">στην κάτοψη για να δείτε</p>
        <p className="text-xs text-center text-muted-foreground/70">γρήγορες πληροφορίες</p>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
        <Home className={`${iconSizes.md} mb-2`} />
        <p className="text-xs text-center">Δεν βρέθηκαν στοιχεία</p>
        <p className="text-xs text-center">για αυτό το ακίνητο</p>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <PropertyHoverContent property={property} />
    </TooltipProvider>
  );
}
