'use client';

import React, { useState } from 'react';
import { BaseCard } from '@/components/core/BaseCard/BaseCard';
import { badgeVariants } from '@/components/ui/variants';
import { getStatusBadgeClass } from '@/lib/design-system';
import { getStatusLabel } from '@/constants/statuses';
import { Eye, ArrowRight, Square, Bed, Bath, Building, MapPin } from 'lucide-react';
import { getPropertyImage } from '../utils/images';

interface PropertyCardProps {
  property: {
    id: string;
    name: string;
    type: string;
    price?: number;
    area: number;
    bedrooms?: number;
    bathrooms?: number;
    project: string;
    building: string;
    floor: string;
    status?: string;
    tags?: string[];
    address?: string;
    image?: string;
  };
  onViewFloorPlan: (id: string) => void;
  isSelected?: boolean;
  onSelectionChange?: () => void;
}

export function PropertyCardNew({ 
  property, 
  onViewFloorPlan, 
  isSelected = false,
  onSelectionChange
}: PropertyCardProps) {
  const [isFavorite, setIsFavorite] = useState(false);

  const formatPrice = (price?: number) => {
    if (!price) return 'Επικοινωνήστε';
    return `€${price.toLocaleString()}`;
  };

  return (
    <BaseCard
      // Βασικές ιδιότητες
      title={property.name}
      subtitle={`${property.project} • ${property.building} • ${property.floor}ος όροφος`}
      
      // Header configuration με image
      headerConfig={{
        backgroundImage: getPropertyImage(property),
        imageAlt: property.name,
        showImageOverlay: true,
        height: "h-48"
      }}
      
      // Selection state
      isSelected={isSelected}
      onSelectionChange={onSelectionChange}
      
      // Favorites
      isFavorite={isFavorite}
      onFavoriteChange={setIsFavorite}
      
      // Status badges
      statusBadges={[
        {
          label: property.status ? getStatusLabel(property.status as any) : 'Διαθέσιμο',
          className: getStatusBadgeClass(property.status || 'for-sale')
        },
        {
          label: property.type,
          className: badgeVariants({ variant: 'secondary', size: 'sm' })
        }
      ]}
      
      // Content sections
      contentSections={[
        // Price section
        {
          title: 'Τιμή',
          content: (
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {formatPrice(property.price)}
            </div>
          )
        },
        
        // Property details
        {
          title: 'Χαρακτηριστικά',
          content: (
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Square className="h-4 w-4" />
                {property.area} m²
              </span>
              {property.bedrooms !== undefined && property.bedrooms > 0 && (
                <span className="flex items-center gap-1">
                  <Bed className="h-4 w-4" />
                  {property.bedrooms}
                </span>
              )}
              {property.bathrooms !== undefined && property.bathrooms > 0 && (
                <span className="flex items-center gap-1">
                  <Bath className="h-4 w-4" />
                  {property.bathrooms}
                </span>
              )}
            </div>
          )
        },

        // Location section (if address is available)
        property.address && {
          title: 'Τοποθεσία',
          content: (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>{property.address}</span>
            </div>
          )
        },
        
        // Tags section
        property.tags && property.tags.length > 0 && {
          title: 'Ετικέτες',
          content: (
            <div className="flex flex-wrap gap-1">
              {property.tags.slice(0, 3).map((tag, idx) => (
                <span 
                  key={idx} 
                  className={badgeVariants({ variant: 'outline', size: 'sm' })}
                >
                  {tag}
                </span>
              ))}
              {property.tags.length > 3 && (
                <span className={badgeVariants({ variant: 'secondary', size: 'sm' })}>
                  +{property.tags.length - 3}
                </span>
              )}
            </div>
          )
        }
      ].filter(Boolean)}
      
      // Actions
      actions={[
        {
          label: 'Δείτε στην κάτοψη',
          icon: Eye,
          onClick: () => onViewFloorPlan(property.id),
          variant: 'default',
          fullWidth: true
        },
        {
          label: 'Λεπτομέρειες',
          icon: ArrowRight,
          onClick: () => console.log('View details', property.id),
          variant: 'outline'
        }
      ]}
      
      // Style overrides
      className="transition-all duration-300 hover:shadow-xl group"
    />
  );
}