'use client';

import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PropertyBadge, CommonBadge } from '@/core/badges';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { EntityDetailsHeader } from '@/core/entity-headers';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useLayoutClasses } from '@/hooks/useLayoutClasses';
import { useTypography } from '@/hooks/useTypography';
import { useButtonPatterns } from '@/hooks/useButtonPatterns';
import { useSemanticColors } from '@/hooks/useSemanticColors';
import {
  Home, Building, MapPin, Euro, Ruler, Users, Phone, Mail, FileText, ExternalLink, Calendar
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Property } from '@/types/property';
import { PROPERTY_STATUS_CONFIG } from '@/lib/property-utils';
import { PropertyInfoItem } from './details/PropertyInfoItem';

interface PropertyDetailsProps {
  property: Property;
}

export function PropertyDetails({ property }: PropertyDetailsProps) {
  const statusInfo = PROPERTY_STATUS_CONFIG[property.status] || PROPERTY_STATUS_CONFIG.default;

  // 🏢 ENTERPRISE: Centralized systems
  const iconSizes = useIconSizes();
  const layout = useLayoutClasses();
  const typography = useTypography();
  const buttonPatterns = useButtonPatterns();
  const colors = useSemanticColors();

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
        variant="default"
      />
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          <Separator />
          
          <div className={`${layout.gridCols2Gap4} ${typography.body.sm}`}>
            <PropertyInfoItem icon={<Building />} label="Κτίριο" value={property.building} />
            <PropertyInfoItem icon={<MapPin />} label="Όροφος" value={property.floor} />
            <PropertyInfoItem icon={<Euro />} label="Τιμή" value={`${property.price.toLocaleString('el-GR')} €`} valueClassName={`font-semibold ${colors.text.price}`} iconClassName={colors.text.price} />
            <PropertyInfoItem icon={<Ruler />} label="Εμβαδόν" value={`${property.area} m²`} />
            <PropertyInfoItem icon={<Home />} label="Δωμάτια" value={property.rooms} />
            <PropertyInfoItem icon={<Home />} label="Μπαλκόνι" value={property.balconyArea ? `${property.balconyArea} m²` : '-'} />
          </div>
          
          <Separator />

          {property.status === 'sold' && (
            <div className="space-y-3">
                <h4 className={typography.heading.sm}>Αγοραστής</h4>
                <div className="flex items-center justify-between">
                    <div className={`${layout.flexCenterGap2} ${typography.body.sm}`}>
                        <Users className={`${iconSizes.sm} text-muted-foreground`} />
                        <span>{property.buyer || '-'}</span>
                    </div>
                    <Button {...buttonPatterns.actions.view} className={`${typography.body.xs} h-7`}>Προβολή Επαφής</Button>
                </div>
                {property.saleDate && (
                  <div className={`${layout.flexCenterGap2} ${typography.special.secondary}`}>
                    <Calendar className={iconSizes.sm} />
                    <span>Ημ/νία Πώλησης: {new Date(property.saleDate).toLocaleDateString('el-GR')}</span>
                  </div>
                )}
            </div>
          )}

          {property.features && property.features.length > 0 && (
            <div className="space-y-2">
              <h4 className={typography.heading.sm}>Χαρακτηριστικά</h4>
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
