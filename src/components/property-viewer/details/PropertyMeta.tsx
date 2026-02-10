'use client';

import React from 'react';
import { PropertyBadge } from '@/core/badges';
import { CommonBadge } from '@/core/badges';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useIconSizes } from '@/hooks/useIconSizes';
// 🏢 ENTERPRISE: Centralized entity icons/colors (ZERO hardcoded values)
import { NAVIGATION_ENTITIES, NAVIGATION_ACTIONS } from '@/components/navigation/config/navigation-entities';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import type { ExtendedPropertyDetails, Property } from '@/types/property-viewer';
import type { PropertyStatus } from '@/core/types/BadgeTypes';
import { PROPERTY_STATUS_CONFIG } from '@/lib/property-utils';
import { formatFloorLabel } from '@/lib/intl-utils';

interface PropertyMetaProps {
  property: ExtendedPropertyDetails;
  onUpdateProperty: (propertyId: string, updates: Partial<Property>) => void;
  /** 🏢 ENTERPRISE: Edit mode state - controlled by parent */
  isEditMode?: boolean;
  /** 🏢 ENTERPRISE: Toggle edit mode callback */
  onToggleEditMode?: () => void;
  /** 🏢 ENTERPRISE: Navigate to Floor Plan tab */
  onNavigateToFloorPlan?: () => void;
}

export function PropertyMeta({
  property,
  onUpdateProperty,
  isEditMode = false,
  onToggleEditMode,
  onNavigateToFloorPlan
}: PropertyMetaProps) {
  const iconSizes = useIconSizes();
  const spacing = useSpacingTokens();
  const statusInfo = PROPERTY_STATUS_CONFIG[property.status] || PROPERTY_STATUS_CONFIG.default;
  // 🏢 ENTERPRISE: i18n support - properties + units namespaces
  const { t } = useTranslation('properties');
  const { t: tUnits } = useTranslation('units');

  // 🏢 ENTERPRISE: Use new areas schema with legacy fallback
  const displayArea = property.areas?.gross ?? property.area;

  // 🏢 ENTERPRISE: Edit button now toggles full edit mode (not prompt-based rename)
  const handleEditClick = () => {
    if (onToggleEditMode) {
      onToggleEditMode();
    }
  };

  // 🏢 ENTERPRISE: View button navigates to Floor Plan tab
  const handleViewClick = () => {
    if (onNavigateToFloorPlan) {
      onNavigateToFloorPlan();
    }
  };

  return (
    <div className={spacing.spaceBetween.sm}>
      {/* Header - 🏢 ENTERPRISE: Edit button moved to entity header (UnitDetailsHeader) */}
      <div className={spacing.spaceBetween.sm}>
        <div className={`flex items-start justify-between ${spacing.gap.sm}`}>
          <h3 className="font-semibold text-sm leading-tight">{property.name}</h3>
          <PropertyBadge
            status={property.status as PropertyStatus}
            variant="outline"
            size="sm"
            className="text-xs flex-shrink-0"
          />
        </div>
        {/* 🏢 ENTERPRISE: Type translation via i18n (Fix "apartment" → "Διαμέρισμα") */}
        <p className="text-xs text-muted-foreground">
          {tUnits(`types.${property.type}`, { defaultValue: property.type })}
        </p>
      </div>

      <Separator />

      {/* Location */}
      <div className={spacing.spaceBetween.sm}>
        <div className={`flex items-center ${spacing.gap.sm} text-xs`}>
          {/* 🏢 ENTERPRISE: Using centralized building icon/color */}
          <NAVIGATION_ENTITIES.building.icon className={cn(iconSizes.xs, NAVIGATION_ENTITIES.building.color)} />
          <span>{property.building}</span>
        </div>
        <div className={`flex items-center ${spacing.gap.sm} text-xs`}>
          {/* 🏢 ENTERPRISE: Using centralized floor icon/color */}
          <NAVIGATION_ENTITIES.floor.icon className={cn(iconSizes.xs, NAVIGATION_ENTITIES.floor.color)} />
          <span>{formatFloorLabel(property.floor)}</span>
        </div>
        <div className={`flex items-center ${spacing.gap.sm} text-xs text-muted-foreground`}>
          <span>{property.project}</span>
        </div>
      </div>

      <Separator />

      {/* Specs */}
      <div className={spacing.spaceBetween.sm}>
        {/* ❌ REMOVED: Price display (commercial data - domain separation)
        {property.price && (
          <div className={`flex items-center ${spacing.gap.sm} text-sm`}>
            <NAVIGATION_ENTITIES.price.icon className={cn(iconSizes.sm, NAVIGATION_ENTITIES.price.color)} />
            <span className={cn("font-semibold", NAVIGATION_ENTITIES.price.color)}>
              {formatCurrency(property.price)}
            </span>
          </div>
        )}
        Migration: PR1.1 - Units Detail Cleanup - Price moved to /sales
        */}
        <div className={`grid grid-cols-2 ${spacing.gap.sm} text-xs`}>
          {/* 🏢 ENTERPRISE: Use new areas.gross with legacy fallback (Fix τ.μ. inconsistency) */}
          {displayArea && (
            <div className={`flex items-center ${spacing.gap.sm}`}>
              <NAVIGATION_ENTITIES.area.icon className={cn(iconSizes.xs, NAVIGATION_ENTITIES.area.color)} />
              <span>{displayArea}{t('meta.sqm')}</span>
            </div>
          )}
          {property.rooms && (
            <div className={`flex items-center ${spacing.gap.sm}`}>
              <NAVIGATION_ENTITIES.unit.icon className={cn(iconSizes.xs, NAVIGATION_ENTITIES.unit.color)} />
              <span>{property.rooms} {t('meta.rooms')}</span>
            </div>
          )}
        </div>
      </div>

      {/* Description */}
      {property.description && (
        <>
          <Separator />
          <div className={spacing.spaceBetween.sm}>
            <h4 className="text-xs font-medium">{t('meta.description')}</h4>
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
          <div className={spacing.spaceBetween.sm}>
            <h4 className="text-xs font-medium">{t('meta.features')}</h4>
            <div className={`flex flex-wrap ${spacing.gap.sm}`}>
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

      {/* Actions - 🏢 ENTERPRISE: Only Floor Plan button here (Edit moved to header) */}
      {onNavigateToFloorPlan && (
        <>
          <Separator />
          <div className={`flex ${spacing.gap.sm}`}>
            <Button variant="outline" size="sm" className="flex-1" onClick={handleViewClick}>
              <NAVIGATION_ACTIONS.view.icon className={cn(iconSizes.xs, NAVIGATION_ACTIONS.view.color, spacing.margin.right.sm)} />
              {t('meta.floorPlan', { defaultValue: 'Κάτοψη' })}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
