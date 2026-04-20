/* eslint-disable design-system/prefer-design-system-imports */
// 🌐 i18n: All labels converted to i18n keys - 2026-01-19
'use client';

import React from 'react';
import { useNotifications } from '@/providers/NotificationProvider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CommonBadge } from '@/core/badges';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { EntityDetailsHeader } from '@/core/entity-headers';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useLayoutClasses } from '@/hooks/useLayoutClasses';
import { useTypography } from '@/hooks/useTypography';
import { useButtonPatterns } from '@/hooks/useButtonPatterns';
import { useSemanticColors } from '@/hooks/useSemanticColors';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  MapPin, Euro, Ruler, Users, Calendar, Share2, Home
} from 'lucide-react';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import { formatCurrency, formatDate } from '@/lib/intl-utils';
import type { Property } from '@/types/property';
import { PropertyInfoItem } from '@/components/property-management/details/PropertyInfoItem';
import { shareProperty, trackShareEvent, type PropertyShareData } from '@/lib/share-utils';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('PropertyDetails');

interface PropertyDetailsProps {
  property: Property;
}

export function PropertyDetails({ property }: PropertyDetailsProps) {
  const { t } = useTranslation(['properties', 'properties-detail', 'properties-enums', 'properties-viewer']);
  const { success, error } = useNotifications();

  // 🏢 ENTERPRISE: Centralized systems
  const iconSizes = useIconSizes();
  const layout = useLayoutClasses();
  const typography = useTypography();
  const buttonPatterns = useButtonPatterns();
  const colors = useSemanticColors();

  // 🏢 ENTERPRISE: i18n-enabled share handler
  const handleShare = async () => {
    try {
      const propertyShareData: PropertyShareData = {
        id: property.id,
        title: `${property.code} - ${property.description}`,
        description: `${property.areas?.gross || property.areas?.net || property.area} ${t('meta.sqm')} • ${property.rooms} ${t('meta.rooms')} • ${formatCurrency(property.price)}`,
        price: property.price,
        area: property.areas?.gross || property.areas?.net || property.area,
        location: property.building,
        propertyType: 'apartment' // You might want to add this to the Property type
      };

      const shared = await shareProperty(propertyShareData, 'property_details');

      if (shared) {
        success(`🎉 ${t('details.shareSuccess')}`);

        // Track the share event
        trackShareEvent('native_share', 'property', property.id);
      } else {
        error(`❌ ${t('details.shareError')}`);
      }
    } catch (err) {
      logger.error('Share error', { error: err });
      error(`❌ ${t('details.shareError')}`);
    }
  };

  return (
    <div className={layout.cardFlexCol}>
      <EntityDetailsHeader
        icon={Home}
        title={property.code}
        subtitle={property.description}
        badges={[
          {
            type: 'status',
            value: property.status,
            variant: 'default',
            size: 'sm'
          }
        ]}
        actions={[
          {
            label: t('details.share'),
            onClick: handleShare,
            icon: Share2,
            variant: 'outline'
          }
        ]}
        variant="default"
      />
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          <Separator />
          
          <div className={`${layout.gridCols2Gap4} ${typography.body.sm}`}>
            <PropertyInfoItem icon={<NAVIGATION_ENTITIES.building.icon className={NAVIGATION_ENTITIES.building.color} />} label={t('details.building')} value={property.building} />
            <PropertyInfoItem icon={<MapPin />} label={t('details.floor')} value={property.floor} />
            <PropertyInfoItem icon={<Euro />} label={t('details.price')} value={formatCurrency(property.price)} valueClassName={`font-semibold ${colors.text.price}`} iconClassName={colors.text.price} />
            <PropertyInfoItem icon={<Ruler />} label={t('details.area')} value={`${property.area} m²`} />
            <PropertyInfoItem icon={<NAVIGATION_ENTITIES.property.icon className={NAVIGATION_ENTITIES.property.color} />} label={t('details.rooms')} value={property.rooms} />
            <PropertyInfoItem icon={<NAVIGATION_ENTITIES.property.icon className={NAVIGATION_ENTITIES.property.color} />} label={t('details.balcony')} value={property.balconyArea ? `${property.balconyArea} m²` : '-'} />
          </div>
          
          <Separator />

          {property.status === 'sold' && (
            <div className="space-y-3">
                <h4 className={typography.heading.sm}>{t('details.buyer')}</h4>
                <div className="flex items-center justify-between">
                    <div className={`${layout.flexCenterGap2} ${typography.body.sm}`}>
                        <Users className={`${iconSizes.sm} ${colors.text.muted}`} />
                        <span>{property.buyer || '-'}</span>
                    </div>
                    <Button {...buttonPatterns.actions.view} className={`${typography.body.xs} h-7`}>{t('details.viewContact')}</Button>
                </div>
                {property.saleDate && (
                  <div className={`${layout.flexCenterGap2} ${typography.special.secondary}`}>
                    <Calendar className={iconSizes.sm} />
                    <span>{t('details.saleDate')} {formatDate(property.saleDate)}</span>
                  </div>
                )}
            </div>
          )}

          {property.features && property.features.length > 0 && (
            <div className="space-y-2">
              <h4 className={typography.heading.sm}>{t('details.features')}</h4>
              <div className="flex flex-wrap gap-2">
                {property.features.map((feature, index) => (
                  <CommonBadge
                    key={index}
                    status="property"
                    customLabel={feature}
                    variant="secondary"
                  />
                ))}
              </div>
            </div>
          )}

        </div>
      </ScrollArea>
    </div>
  );
}
