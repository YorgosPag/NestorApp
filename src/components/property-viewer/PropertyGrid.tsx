'use client';

import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PropertyBadge } from '@/core/badges';
import { Home, Building, MapPin, Euro, Ruler } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { COMPLEX_HOVER_EFFECTS, INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import type { Property } from '@/types/property-viewer';
import { formatFloorLabel, formatCurrency } from '@/lib/intl-utils';
import { brandClasses } from '@/styles/design-tokens';


const propertyTypeIcons: { [key: string]: React.ElementType } = {
  'Στούντιο': Home,
  'Γκαρσονιέρα': Home,
  'Διαμέρισμα 2Δ': Home,
  'Διαμέρισμα 3Δ': Home,
  'Μεζονέτα': Building,
  'Κατάστημα': Building,
  'Αποθήκη': Building,
};

function PropertyCard({ property, onSelect, isSelected }: { property: Property, onSelect: () => void, isSelected: boolean }) {
  const iconSizes = useIconSizes();
  const { quick, getStatusBorder } = useBorderTokens();

  // 🎨 ENTERPRISE BORDER TOKENS - Centralized status configuration
  const statusConfig = {
    'for-sale': {
      label: 'Προς Πώληση',
      color: `${getStatusBorder('success')} bg-green-50 dark:bg-green-950/20`,
      textColor: 'text-green-700 dark:text-green-300'
    },
    'for-rent': {
      label: 'Προς Ενοικίαση',
      color: `${brandClasses.primary.border} ${brandClasses.primary.bg} dark:bg-blue-950/20`,
      textColor: brandClasses.primary.text
    },
    'sold': {
      label: 'Πουλημένο',
      color: `${getStatusBorder('error')} bg-red-50 dark:bg-red-950/20`,
      textColor: 'text-red-700 dark:text-red-300'
    },
    'rented': {
      label: 'Ενοικιασμένο',
      color: `${getStatusBorder('warning')} bg-orange-50 dark:bg-orange-950/20`,
      textColor: 'text-orange-700 dark:text-orange-300'
    },
    'reserved': {
      label: 'Δεσμευμένο',
      color: `${getStatusBorder('warning')} bg-yellow-50 dark:bg-yellow-950/20`,
      textColor: 'text-yellow-700 dark:text-yellow-300'
    },
  };

  const statusInfo = statusConfig[property.status as keyof typeof statusConfig] || { color: `${quick.card}`, label: 'Άγνωστο', textColor: 'text-gray-700' };
  const IconComponent = propertyTypeIcons[property.type] || Home;

  return (
    <Card 
        className={cn(
            "cursor-pointer group border",
            COMPLEX_HOVER_EFFECTS.FEATURE_CARD,
            isSelected ? `ring-2 ring-primary shadow-lg ${getStatusBorder('info')}` : getStatusBorder('muted')
        )}
        onClick={onSelect}
    >
      <CardHeader className={cn("p-4 border-b", statusInfo.color)}>
        <div className="flex justify-between items-start">
            <div>
                <CardTitle className="text-base flex items-center gap-2">
                    <IconComponent className={iconSizes.sm} />
                    {property.name}
                </CardTitle>
                <p className="text-xs text-muted-foreground">{property.type}</p>
            </div>
            <PropertyBadge
              status={property.status as any}
              variant="outline"
              className={cn("text-xs", statusInfo.color, statusInfo.textColor)}
            />
        </div>
      </CardHeader>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Building className={iconSizes.xs} />
          <span>{property.building}</span>
          <MapPin className={`${iconSizes.xs} ml-2`} />
          <span>{formatFloorLabel(property.floor)}</span>
        </div>
        <div className="flex justify-between items-center text-sm">
            {property.price && (
                <div className="flex items-center gap-1 font-semibold text-green-600">
                    <Euro className={iconSizes.sm}/>
                    {formatCurrency(property.price)}
                </div>
            )}
            {property.area && (
                 <div className="flex items-center gap-1 text-muted-foreground">
                    <Ruler className={iconSizes.sm}/>
                    {property.area} τ.μ.
                </div>
            )}
        </div>
      </CardContent>
    </Card>
  );
}


export function PropertyGrid({ properties, onSelect, selectedPropertyIds }: { properties: Property[], onSelect: (id: string, shift: boolean) => void, selectedPropertyIds: string[] }) {
  const iconSizes = useIconSizes();
  if (properties.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
        <Home className={`${iconSizes.xl} mb-4`} />
        <h2 className="text-xl font-semibold">Δεν βρέθηκαν ακίνητα</h2>
        <p className="text-sm">Δοκιμάστε να αλλάξετε τα φίλτρα</p>
      </div>
    );
  }
  
  return (
    <ScrollArea className="h-full">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 p-4">
        {properties.map(prop => (
          <PropertyCard 
            key={prop.id} 
            property={prop}
            onSelect={() => onSelect(prop.id, false)}
            isSelected={selectedPropertyIds.includes(prop.id)}
          />
        ))}
      </div>
    </ScrollArea>
  );
}
