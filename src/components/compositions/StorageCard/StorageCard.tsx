'use client';

import React, { useState } from 'react';
import { BaseCard } from '@/components/core/BaseCard/BaseCard';
import { UnitBadge, CommonBadge } from '@/core/badges';
import { HOVER_SHADOWS, TRANSITION_PRESETS } from '@/components/ui/effects';
import { Package, MapPin, Ruler, Thermometer, Shield, Edit, Trash2 } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { badgeVariants } from '@/components/ui/badge';
import { formatPriceWithUnit } from '@/lib/intl-utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';
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

const getStatusBadgeClass = (status: StorageStatus, colors: ReturnType<typeof useSemanticColors>) => {
  const statusClasses: Record<StorageStatus, string> = {
    'available': `${colors.bg.success} ${colors.text.success}`,
    'occupied': `${colors.bg.error} ${colors.text.error}`,
    'reserved': `${colors.bg.warning} ${colors.text.warning}`,
    'maintenance': `${colors.bg.muted} ${colors.text.muted}`,
    'unavailable': `${colors.bg.muted} ${colors.text.muted}`
  };
  return statusClasses[status] || `${colors.bg.muted} ${colors.text.muted}`;
};

export function StorageCard({
  unit,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
  getStatusColor,
  getStatusLabel,
  getTypeIcon = defaultGetTypeIcon,
  getTypeLabel
}: StorageCardProps) {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const [isFavorite, setIsFavorite] = useState(false);
  // 🏢 ENTERPRISE: i18n support
  const { t } = useTranslation('storage');

  // 🏢 ENTERPRISE: Localized label functions
  const localizedGetStatusLabel = (status: StorageStatus): string => {
    return getStatusLabel?.(status) ?? t(`card.status.${status}`, { defaultValue: status });
  };

  const localizedGetTypeLabel = (type: StorageType): string => {
    return getTypeLabel?.(type) ?? t(`card.types.${type}`, { defaultValue: type });
  };

  const TypeIcon = getTypeIcon(unit.type);

  const formatArea = (area?: number) => {
    if (!area) return t('card.notDefined');
    return `${area} m²`;
  };

  const formatPrice = (price?: number) => {
    if (!price) return t('card.free');
    return formatPriceWithUnit(price, t('card.perMonth'));
  };

  return (
    <BaseCard
      // Βασικές ιδιότητες
      title={unit.identifier || unit.name}
      subtitle={`${localizedGetTypeLabel(unit.type)} ${unit.floor ? `• ${t('card.floor', { floor: unit.floor })}` : ''}`}
      
      // Header configuration
      headerConfig={{
        backgroundGradient: `from-amber-100 via-orange-50 to-yellow-100 dark:from-amber-950 dark:via-orange-950 dark:to-yellow-900`,
        logo: <TypeIcon className={`${iconSizes.xl} ${colors.text.accent}`} />,
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
          label: localizedGetStatusLabel(unit.status),
          className: getStatusBadgeClass(unit.status, colors)
        },
        {
          label: localizedGetTypeLabel(unit.type),
          className: badgeVariants({ variant: 'outline', size: 'sm' })
        }
      ]}
      
      // Content sections
      contentSections={[
        // Location details
        (unit.building || unit.section) && {
          title: t('card.sections.location'),
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
                  {t('card.sections.section')}: {unit.section}
                </p>
              )}
              {unit.floor && (
                <p className="text-sm text-muted-foreground ml-6">
                  {t('card.sections.floor')}: {unit.floor}
                </p>
              )}
            </div>
          )
        },

        // Specifications
        {
          title: t('card.sections.specs'),
          content: (
            <div className="space-y-2">
              {unit.area && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('card.sections.area')}:</span>
                  <span className="font-medium flex items-center gap-1">
                    <Ruler className={iconSizes.xs} />
                    {formatArea(unit.area)}
                  </span>
                </div>
              )}
              {unit.dimensions && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('card.sections.dimensions')}:</span>
                  <span className="font-medium">{unit.dimensions}</span>
                </div>
              )}
              {unit.height && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('card.sections.height')}:</span>
                  <span className="font-medium">{unit.height}m</span>
                </div>
              )}
            </div>
          )
        },

        // Features & Amenities
        (unit.hasElectricity || unit.hasWater || unit.hasSecurity || unit.hasClimateControl) && {
          title: t('card.sections.amenities'),
          content: (
            <div className="flex flex-wrap gap-1">
              {unit.hasElectricity && (
                <span className={badgeVariants({ variant: 'secondary', size: 'sm' })}>
                  {t('card.amenities.electricity')}
                </span>
              )}
              {unit.hasWater && (
                <span className={badgeVariants({ variant: 'secondary', size: 'sm' })}>
                  {t('card.amenities.water')}
                </span>
              )}
              {unit.hasSecurity && (
                <span className={badgeVariants({ variant: 'secondary', size: 'sm' })}>
                  <Shield className={`${iconSizes.xs} mr-1`} />
                  {t('card.amenities.security')}
                </span>
              )}
              {unit.hasClimateControl && (
                <span className={badgeVariants({ variant: 'secondary', size: 'sm' })}>
                  <Thermometer className={`${iconSizes.xs} mr-1`} />
                  {t('card.amenities.climate')}
                </span>
              )}
            </div>
          )
        },

        // Pricing
        unit.price && {
          title: t('card.sections.price'),
          content: (
            <div className={`text-lg font-semibold ${colors.text.success}`}>
              {formatPrice(unit.price)}
            </div>
          )
        },

        // Description/Notes
        unit.description && {
          title: t('card.sections.description'),
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
          label: t('card.actions.edit'),
          icon: Edit,
          onClick: onEdit,
          variant: 'outline'
        },
        {
          label: t('card.actions.delete'),
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