'use client';

import React, { useState } from 'react';
import { BaseCard } from '@/components/core/BaseCard/BaseCard';
import { badgeVariants } from '@/components/ui/variants';
import { getStatusColor, getStatusBadgeClass } from '@/lib/design-system';
import { getStatusLabel, getStatusColor as getStatusColorConstant } from '@/constants/statuses';
import { Building, Apartment, House, Store } from 'lucide-react';
import type { Building as BuildingType } from '../../building-management/BuildingsPageContent';

interface BuildingCardProps {
  building: BuildingType;
  isSelected: boolean;
  onClick: () => void;
}

const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'residential': return House;
    case 'commercial': return Store;
    case 'apartment': return Apartment;
    default: return Building;
  }
};

const getCategoryLabel = (category: string) => {
  const labels: Record<string, string> = {
    residential: 'Κατοικία',
    commercial: 'Εμπορικό',
    apartment: 'Διαμέρισμα',
    mixed: 'Μικτό',
  };
  return labels[category] || category;
};

export function BuildingCard({ building, isSelected, onClick }: BuildingCardProps) {
  const [isFavorite, setIsFavorite] = useState(false);
  
  const CategoryIcon = getCategoryIcon(building.category || 'mixed');

  return (
    <BaseCard
      // Βασικές ιδιότητες
      title={building.name}
      subtitle={building.description}
      
      // Header configuration
      headerConfig={{
        backgroundGradient: "from-blue-100 via-purple-50 to-blue-50 dark:from-blue-950 dark:via-purple-950 dark:to-blue-900",
        logo: <CategoryIcon className="w-8 h-8 text-blue-600 dark:text-blue-400" />,
        showProgress: true,
        progressValue: building.progress || 0,
        progressColor: getStatusColor(building.status || 'active', 'bg')
      }}
      
      // Selection state
      isSelected={isSelected}
      onSelectionChange={() => onClick()}
      
      // Favorites
      isFavorite={isFavorite}
      onFavoriteChange={setIsFavorite}
      
      // Status badges
      statusBadges={[
        {
          label: getStatusLabel(building.status as any),
          className: getStatusBadgeClass(building.status || 'active')
        },
        building.category && {
          label: getCategoryLabel(building.category),
          className: badgeVariants({ variant: 'outline', size: 'sm' })
        }
      ].filter(Boolean)}
      
      // Content sections
      contentSections={[
        // Location section
        {
          title: 'Τοποθεσία',
          content: (
            <div className="space-y-1">
              <p className="text-sm font-medium">{building.address}</p>
              <p className="text-xs text-muted-foreground">{building.city}</p>
            </div>
          )
        },
        
        // Progress section
        building.progress !== undefined && {
          title: 'Πρόοδος',
          content: (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Ολοκλήρωση</span>
                <span className="font-medium">{building.progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="h-2 rounded-full transition-all duration-300"
                  style={{ 
                    width: `${building.progress}%`,
                    backgroundColor: `hsl(var(--status-${building.status === 'completed' ? 'success' : building.status === 'construction' ? 'warning' : 'info'}))`
                  }}
                />
              </div>
            </div>
          )
        },
        
        // Metrics section  
        building.totalUnits && {
          title: 'Στοιχεία',
          content: (
            <div className="grid grid-cols-2 gap-4 text-sm">
              {building.totalUnits && (
                <div className="space-y-1">
                  <p className="text-muted-foreground">Συνολικές Μονάδες</p>
                  <p className="font-semibold">{building.totalUnits}</p>
                </div>
              )}
              {building.availableUnits !== undefined && (
                <div className="space-y-1">
                  <p className="text-muted-foreground">Διαθέσιμες</p>
                  <p className="font-semibold">{building.availableUnits}</p>
                </div>
              )}
            </div>
          )
        },
        
        // Features section
        building.features && building.features.length > 0 && {
          title: 'Χαρακτηριστικά',
          content: (
            <div className="flex flex-wrap gap-1">
              {building.features.slice(0, 3).map((feature, index) => (
                <span 
                  key={index}
                  className={badgeVariants({ variant: 'secondary', size: 'sm' })}
                >
                  {feature}
                </span>
              ))}
              {building.features.length > 3 && (
                <span className={badgeVariants({ variant: 'outline', size: 'sm' })}>
                  +{building.features.length - 3}
                </span>
              )}
            </div>
          )
        }
      ].filter(Boolean)}
      
      // Actions
      actions={[
        {
          label: 'Προβολή',
          onClick: () => onClick(),
          variant: 'default'
        }
      ]}
      
      // Click handlers
      onClick={onClick}
      className="transition-all duration-300 hover:shadow-xl group"
    />
  );
}