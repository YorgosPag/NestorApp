'use client';

import React, { useState } from 'react';
import { BaseCard } from '@/components/core/BaseCard/BaseCard';
import { UnitBadge, CommonBadge } from '@/core/badges';
import { HOVER_SHADOWS, TRANSITION_PRESETS } from '@/components/ui/effects';
import { Package, MapPin, Ruler, Thermometer, Shield, Edit, Trash2 } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { badgeVariants } from '@/components/ui/badge';
import type { StorageUnit, StorageType, StorageStatus } from '@/types/storage';

interface StorageCardProps {
  unit: StorageUnit;
  isSelected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  getStatusColor?: (status: StorageStatus) => string;
  getStatusLabel?: (status: StorageStatus) => string;
  getTypeIcon?: (type: StorageType) => React.ElementType;
  getTypeLabel?: (type: StorageType) => string;
}

const defaultGetStatusLabel = (status: StorageStatus) => {
  const statusLabels: Record<StorageStatus, string> = {
    'available': 'Διαθέσιμο',
    'occupied': 'Κατειλημμένο',
    'reserved': 'Δεσμευμένο',
    'maintenance': 'Συντήρηση',
    'unavailable': 'Μη Διαθέσιμο'
  };
  return statusLabels[status] || status;
};

const defaultGetTypeLabel = (type: StorageType) => {
  const typeLabels: Record<StorageType, string> = {
    'parking': 'Πάρκινγκ',
    'storage': 'Αποθήκη',
    'basement': 'Υπόγειο',
    'garage': 'Γκαράζ',
    'warehouse': 'Αποθήκευση'
  };
  return typeLabels[type] || type;
};

const defaultGetTypeIcon = (type: StorageType) => {
  const typeIcons: Record<StorageType, React.ElementType> = {
    'parking': Package,
    'storage': Package,
    'basement': Package,
    'garage': Package,
    'warehouse': Package
  };
  return typeIcons[type] || Package;
};

const getStatusBadgeClass = (status: StorageStatus) => {
  const statusClasses: Record<StorageStatus, string> = {
    'available': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    'occupied': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
    'reserved': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
    'maintenance': 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
    'unavailable': 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
  };
  return statusClasses[status] || 'bg-gray-100 text-gray-800';
};

export function StorageCard({
  unit,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
  getStatusColor,
  getStatusLabel = defaultGetStatusLabel,
  getTypeIcon = defaultGetTypeIcon,
  getTypeLabel = defaultGetTypeLabel
}: StorageCardProps) {
  const iconSizes = useIconSizes();
  const [isFavorite, setIsFavorite] = useState(false);

  const TypeIcon = getTypeIcon(unit.type);

  const formatArea = (area?: number) => {
    if (!area) return 'Μη καθορισμένο';
    return `${area} m²`;
  };

  const formatPrice = (price?: number) => {
    if (!price) return 'Δωρεάν';
    return `€${price.toLocaleString()}/μήνα`;
  };

  return (
    <BaseCard
      // Βασικές ιδιότητες
      title={unit.identifier || unit.name}
      subtitle={`${getTypeLabel(unit.type)} ${unit.floor ? `• ${unit.floor}ος όροφος` : ''}`}
      
      // Header configuration
      headerConfig={{
        backgroundGradient: "from-amber-100 via-orange-50 to-yellow-100 dark:from-amber-950 dark:via-orange-950 dark:to-yellow-900",
        logo: <TypeIcon className={`${iconSizes.xl} text-amber-600 dark:text-amber-400`} />,
        showImageOverlay: false
      }}
      
      // Selection state
      isSelected={isSelected}
      onSelectionChange={onSelect}
      
      // Favorites
      isFavorite={isFavorite}
      onFavoriteChange={setIsFavorite}
      
      // Status badges
      statusBadges={[
        {
          label: getStatusLabel(unit.status),
          className: getStatusBadgeClass(unit.status)
        },
        {
          label: getTypeLabel(unit.type),
          className: badgeVariants({ variant: 'outline', size: 'sm' })
        }
      ]}
      
      // Content sections
      contentSections={[
        // Location details
        (unit.building || unit.section) && {
          title: 'Τοποθεσία',
          content: (
            <div className="space-y-1">
              {unit.building && (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className={`${iconSizes.sm} text-muted-foreground`} />
                  <span>{unit.building}</span>
                </div>
              )}
              {unit.section && (
                <p className="text-sm text-muted-foreground ml-6">
                  Τμήμα: {unit.section}
                </p>
              )}
              {unit.floor && (
                <p className="text-sm text-muted-foreground ml-6">
                  Όροφος: {unit.floor}
                </p>
              )}
            </div>
          )
        },
        
        // Specifications
        {
          title: 'Προδιαγραφές',
          content: (
            <div className="space-y-2">
              {unit.area && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Εμβαδόν:</span>
                  <span className="font-medium flex items-center gap-1">
                    <Ruler className={iconSizes.xs} />
                    {formatArea(unit.area)}
                  </span>
                </div>
              )}
              {unit.dimensions && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Διαστάσεις:</span>
                  <span className="font-medium">{unit.dimensions}</span>
                </div>
              )}
              {unit.height && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Ύψος:</span>
                  <span className="font-medium">{unit.height}m</span>
                </div>
              )}
            </div>
          )
        },
        
        // Features & Amenities
        (unit.hasElectricity || unit.hasWater || unit.hasSecurity || unit.hasClimateControl) && {
          title: 'Παροχές',
          content: (
            <div className="flex flex-wrap gap-1">
              {unit.hasElectricity && (
                <span className={badgeVariants({ variant: 'secondary', size: 'sm' })}>
                  Ρεύμα
                </span>
              )}
              {unit.hasWater && (
                <span className={badgeVariants({ variant: 'secondary', size: 'sm' })}>
                  Νερό
                </span>
              )}
              {unit.hasSecurity && (
                <span className={badgeVariants({ variant: 'secondary', size: 'sm' })}>
                  <Shield className={`${iconSizes.xs} mr-1`} />
                  Ασφάλεια
                </span>
              )}
              {unit.hasClimateControl && (
                <span className={badgeVariants({ variant: 'secondary', size: 'sm' })}>
                  <Thermometer className={`${iconSizes.xs} mr-1`} />
                  Κλιματισμός
                </span>
              )}
            </div>
          )
        },
        
        // Pricing
        unit.price && {
          title: 'Τιμή',
          content: (
            <div className="text-lg font-semibold text-green-600 dark:text-green-400">
              {formatPrice(unit.price)}
            </div>
          )
        },
        
        // Description/Notes
        unit.description && {
          title: 'Περιγραφή',
          content: (
            <p className="text-sm text-muted-foreground line-clamp-3">
              {unit.description}
            </p>
          )
        }
      ].filter(Boolean)}
      
      // Actions
      actions={[
        {
          label: 'Επεξεργασία',
          icon: Edit,
          onClick: onEdit,
          variant: 'outline'
        },
        {
          label: 'Διαγραφή',
          icon: Trash2,
          onClick: onDelete,
          variant: 'ghost'
        }
      ]}
      
      // Click handlers
      onClick={onSelect}
      className={`group ${TRANSITION_PRESETS.SMOOTH_ALL} ${HOVER_SHADOWS.ENHANCED}`}
    />
  );
}